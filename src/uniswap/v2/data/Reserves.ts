import { abi as IUniswapV2PairABI } from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import { abi as UniswapV2Factory  } from '@uniswap/v2-core/build/UniswapV2Factory.json'
import { Interface } from '@ethersproject/abi'
import {
  ChainId,
  Currency,
  CurrencyAmount,
  Pair,
  ETHER,
  Token,
  TokenAmount,
  WETH,
} from '@uniswap/sdk'
import { multicall } from '../multicall'
import { JsonRpcProvider } from '@ethersproject/providers'

export function wrappedCurrency(
  currency: Currency | undefined,
  chainId: ChainId | undefined
): Token | undefined {
  return chainId && currency === ETHER
    ? WETH[chainId]
    : currency instanceof Token
    ? currency
    : undefined
}

export function wrappedCurrencyAmount(
  currencyAmount: CurrencyAmount | undefined,
  chainId: ChainId | undefined
): TokenAmount | undefined {
  const token = currencyAmount && chainId ? wrappedCurrency(currencyAmount.currency, chainId) : undefined
  return token && currencyAmount ? new TokenAmount(token, currencyAmount.raw) : undefined
}

export function unwrappedToken(token: Token): Currency {
  if (token.equals(WETH[token.chainId])) return ETHER
  return token
}

const PAIR_INTERFACE = new Interface(IUniswapV2PairABI)

export enum PairState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export const SUSHISWAP_FACTORY_ADDRESS = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'

export const usePairs = async (
  currencies: [Currency | undefined, Currency | undefined][],
  provider: JsonRpcProvider,
  chainId: number,
  isSushiSwap = false
): Promise<[PairState, Pair | null][]> => {
  const tokens = currencies.map(([currencyA, currencyB]) => [
    wrappedCurrency(currencyA, chainId),
    wrappedCurrency(currencyB, chainId),
  ])
  const blockTag = 'latest'
  let pairAddresses: (string | undefined)[] = []
  if (isSushiSwap) {
    const calls = []
    for (const token of tokens) {
      const [tokenA, tokenB] = token
      calls.push([SUSHISWAP_FACTORY_ADDRESS, 'getPair', [tokenA?.address, tokenB?.address]])
    }
    // SushiSwap factory address
    const result: string[][] = await multicall(
      provider,
      chainId,
      UniswapV2Factory,
      calls,
      { blockTag }
    )
    pairAddresses = pairAddresses.concat(result.map(r => r[0]))
  } else {
    for (const token of tokens) {
      const [tokenA, tokenB] = token
      const pairAddress = tokenA && tokenB && !tokenA.equals(tokenB) ? Pair.getAddress(tokenA, tokenB) : undefined
      pairAddresses.push(pairAddress)
    }
  }
  const calls: any = [
    ...pairAddresses.map((address: string) => {
      return [address, 'getReserves', []]
    })
  ]
  let results: any = await multicall(
    provider,
    chainId,
    IUniswapV2PairABI,
    calls,
    { blockTag },
    false
  )

  results = results.map((data: any, i: number) => {
    let result
    const success = data && data.length > 2
    if (success && data) {
      try {
        result = PAIR_INTERFACE.decodeFunctionResult(calls[i][1], data)
      } catch (error) {
        return {
          valid: true,
          loading: false,
          error: true,
          syncing: true,
          result
        }
      }
    }
    return {
      valid: true,
      loading: false,
      syncing: true,
      result: result,
      error: !success
    }
  })

  return results.map((result: any, i: any) => {
    const { result: reserves, loading } = result
    const tokenA = tokens[i][0]
    const tokenB = tokens[i][1]

    if (loading) return [PairState.LOADING, null]
    if (!tokenA || !tokenB || tokenA.equals(tokenB)) return [PairState.INVALID, null]
    if (!reserves) return [PairState.NOT_EXISTS, null]
    const { reserve0, reserve1 } = reserves
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    return [
      PairState.EXISTS,
      new Pair(new TokenAmount(token0, reserve0.toString()), new TokenAmount(token1, reserve1.toString()))
    ]
  })
}
