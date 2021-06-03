import { ZERO_PERCENT, ONE_HUNDRED_PERCENT, BASES_TO_CHECK_TRADES_AGAINST, CUSTOM_BASES, BETTER_TRADE_LESS_HOPS_THRESHOLD } from './constants'
import { Token, Currency, Pair, TokenAmount, CurrencyAmount, Trade, Percent, currencyEquals, JSBI, ChainId } from '@uniswap/sdk'
import { parseUnits } from '@ethersproject/units'
import { JsonRpcProvider } from '@ethersproject/providers'
import { PairState, usePairs, wrappedCurrency } from './data/Reserves'
import { flatMap } from 'lodash'

const MAX_HOPS = 3

export function tryParseAmount(value?: string, currency?: Currency): CurrencyAmount | undefined {
  if (!value || !currency) {
    return undefined
  }
  try {
    const typedValueParsed = parseUnits(value, currency.decimals).toString()
    if (typedValueParsed !== '0') {
      return currency instanceof Token
        ? new TokenAmount(currency, JSBI.BigInt(typedValueParsed))
        : CurrencyAmount.ether(JSBI.BigInt(typedValueParsed))
    }
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    console.debug(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return undefined
}

const useAllCommonPairs = async (provider: JsonRpcProvider, chainId: ChainId, currencyA?: Currency, currencyB?: Currency, isSushiSwap = false): Promise<Pair[]> => {
  const bases: Token[] = chainId ? BASES_TO_CHECK_TRADES_AGAINST[chainId] : [];

  const [tokenA, tokenB] = chainId
    ? [wrappedCurrency(currencyA, chainId), wrappedCurrency(currencyB, chainId)]
    : [undefined, undefined];

  const basePairs: any = flatMap(bases, (base: any): [Token, Token][] =>
    bases.map((otherBase) => [base, otherBase])
  ).filter(([t0, t1]: any) => t0.address !== t1.address)

  const allPairCombinations: any = () => {
    return (tokenA && tokenB)
      ? [
          // the direct pair
          [tokenA, tokenB],
          // token A against all bases
          ...bases.map((base): [Token, Token] => [tokenA, base]),
          // token B against all bases
          ...bases.map((base): [Token, Token] => [tokenB, base]),
          // each base against all bases
          ...basePairs,
        ]
          .filter((tokens): tokens is [Token, Token] =>
            Boolean(tokens[0] && tokens[1])
          )
          .filter(([t0, t1]) => t0.address !== t1.address)
          .filter(([tokenA, tokenB]) => {
            if (!chainId) return true;
            const customBases = CUSTOM_BASES[chainId];
            if (!customBases) return true;
  
            const customBasesA: Token[] | undefined =
              customBases[tokenA.address];
            const customBasesB: Token[] | undefined =
              customBases[tokenB.address];
  
            if (!customBasesA && !customBasesB) return true;
  
            if (
              customBasesA &&
              !customBasesA.find((base) => tokenB.equals(base))
            )
              return false;
            if (
              customBasesB &&
              !customBasesB.find((base) => tokenA.equals(base))
            )
              return false;
  
            return true;
          })
      : []
  }
  const allPairs = await usePairs(allPairCombinations(), provider, chainId, isSushiSwap);

  // only pass along valid pairs, non-duplicated pairs
  return Object.values(
    allPairs
      // filter out invalid pairs
      .filter((result: any): result is [PairState.EXISTS, Pair] =>
        Boolean(result[0] === PairState.EXISTS && result[1])
      )
      // filter out duplicated pairs
      .reduce<{ [pairAddress: string]: Pair }>((memo, [, curr]) => {
        memo[curr.liquidityToken.address] =
          memo[curr.liquidityToken.address] ?? curr;
        return memo;
      }, {}))
}

export const findBestTradeExactIn = async (provider: JsonRpcProvider, chainId: ChainId, currencyAmountIn?: CurrencyAmount, currencyOut?: Currency, isSushiSwap = false): Promise<Trade | null> => {
  const allowedPairs = await useAllCommonPairs(provider, chainId, currencyAmountIn?.currency, currencyOut, isSushiSwap)
  let bestTradeSoFar: Trade | null = null
  if (currencyAmountIn && currencyOut && allowedPairs.length > 0) {
    // search through trades with varying hops, find best trade out of them
    for (let i = 1; i <= MAX_HOPS; i++) {
      const currentTrade: Trade | null =
        Trade.bestTradeExactIn(allowedPairs, currencyAmountIn, currencyOut, { maxHops: i, maxNumResults: 1 })[0] ??
        null
      // if current trade is best yet, save it
      if (isTradeBetter(bestTradeSoFar, currentTrade, BETTER_TRADE_LESS_HOPS_THRESHOLD)) {
        bestTradeSoFar = currentTrade
      }
    }
    return bestTradeSoFar
  }

  return null
}

export const findBestTradeExactOut = async (provider: JsonRpcProvider, chainId: ChainId, currencyIn?: Currency, currencyAmountOut?: CurrencyAmount, isSushiSwap = false): Promise<Trade | null> => {
  const allowedPairs = await useAllCommonPairs(provider, chainId, currencyIn, currencyAmountOut?.currency, isSushiSwap)
  let bestTradeSoFar: Trade | null = null
  if (currencyIn && currencyAmountOut && allowedPairs.length > 0) {
    // search through trades with varying hops, find best trade out of them
    for (let i = 1; i <= MAX_HOPS; i++) {
      const currentTrade =
        Trade.bestTradeExactOut(allowedPairs, currencyIn, currencyAmountOut, { maxHops: i, maxNumResults: 1 })[0] ??
        null
      if (isTradeBetter(bestTradeSoFar, currentTrade, BETTER_TRADE_LESS_HOPS_THRESHOLD)) {
        bestTradeSoFar = currentTrade
      }
    }
    return bestTradeSoFar
  }
  return null
}

// returns whether tradeB is better than tradeA by at least a threshold percentage amount
export function isTradeBetter(
  tradeA: Trade | undefined | null,
  tradeB: Trade | undefined | null,
  minimumDelta: Percent = ZERO_PERCENT
): boolean | undefined {
  if (tradeA && !tradeB) return false
  if (tradeB && !tradeA) return true
  if (!tradeA || !tradeB) return undefined

  if (
    tradeA.tradeType !== tradeB.tradeType ||
    !currencyEquals(tradeA.inputAmount.currency, tradeB.inputAmount.currency) ||
    !currencyEquals(tradeB.outputAmount.currency, tradeB.outputAmount.currency)
  ) {
    throw new Error('Trades are not comparable')
  }

  if (minimumDelta.equalTo(ZERO_PERCENT)) {
    return tradeA.executionPrice.lessThan(tradeB.executionPrice)
  } else {
    return tradeA.executionPrice.raw.multiply(minimumDelta.add(ONE_HUNDRED_PERCENT)).lessThan(tradeB.executionPrice)
  }
}
