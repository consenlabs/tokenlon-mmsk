import { Token, Currency, CurrencyAmount, TokenAmount, TradeType } from '@uniswap/sdk-core'
import { encodeRouteToPath, Route, Trade } from '@uniswap/v3-sdk'
import { BigNumber, Contract } from 'ethers'
import { Provider } from '@ethersproject/abstract-provider'
import { useSingleContractMultipleData } from '../state/multicall/hooks'
import { useAllV3Routes } from './useAllV3Routes'
import { QUOTER_ADDRESSES } from '../constants/v3'
import { abi as QuoterABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'

export enum V3TradeState {
  LOADING,
  INVALID,
  NO_ROUTE_FOUND,
  VALID,
  SYNCING,
}

/**
 * Returns the best v3 trade for a desired exact input swap
 * @param amountIn the amount to swap in
 * @param currencyOut the desired output currency
 */
export async function findBestV3TradeExactIn(
  provider: Provider,
  amountIn?: CurrencyAmount,
  currencyOut?: Currency
): Promise<{ state: V3TradeState; trade: Trade | null }> {
  const chainId = 1
  const quoter = new Contract(QUOTER_ADDRESSES[chainId], QuoterABI, provider)
  const { routes, loading: routesLoading } = await useAllV3Routes(provider, amountIn?.currency, currencyOut)

  const quoteExactInInputs = routes.map((route) => [
    encodeRouteToPath(route, false),
    amountIn ? `0x${amountIn.raw.toString(16)}` : undefined,
  ])

  const quotesResults = await useSingleContractMultipleData(provider, quoter, 'quoteExactInput', quoteExactInInputs)

  if (!amountIn || !currencyOut) {
    return {
      state: V3TradeState.INVALID,
      trade: null,
    }
  }

  if (routesLoading || quotesResults.some(({ loading }) => loading)) {
    return {
      state: V3TradeState.LOADING,
      trade: null,
    }
  }

  const { bestRoute, amountOut } = quotesResults.reduce(
    (currentBest: { bestRoute: Route | null; amountOut: BigNumber | null }, { result }, i) => {
      if (!result) return currentBest

      if (currentBest.amountOut === null) {
        return {
          bestRoute: routes[i],
          amountOut: result.amountOut,
        }
      } else if (currentBest.amountOut.lt(result.amountOut)) {
        return {
          bestRoute: routes[i],
          amountOut: result.amountOut,
        }
      }

      return currentBest
    },
    {
      bestRoute: null,
      amountOut: null,
    }
  )

  if (!bestRoute || !amountOut) {
    return {
      state: V3TradeState.NO_ROUTE_FOUND,
      trade: null,
    }
  }

  const isSyncing = quotesResults.some(({ syncing }) => syncing)

  return {
    state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
    trade: Trade.createUncheckedTrade({
      route: bestRoute,
      tradeType: TradeType.EXACT_INPUT,
      inputAmount: amountIn,
      outputAmount:
        currencyOut instanceof Token
          ? new TokenAmount(currencyOut, amountOut.toString())
          : CurrencyAmount.ether(amountOut.toString()),
    }),
  }
}

/**
 * Returns the best v3 trade for a desired exact output swap
 * @param currencyIn the desired input currency
 * @param amountOut the amount to swap out
 */
export async function findBestV3TradeExactOut(
  provider: Provider,
  currencyIn?: Currency,
  amountOut?: CurrencyAmount
): Promise<{ state: V3TradeState; trade: Trade | null }> {
  const chainId = 1
  const quoter = new Contract(QUOTER_ADDRESSES[chainId], QuoterABI, provider)
  const { routes, loading: routesLoading } = await useAllV3Routes(provider, currencyIn, amountOut?.currency)

  const quoteExactOutInputs = routes.map((route) => [
    encodeRouteToPath(route, true),
    amountOut ? `0x${amountOut.raw.toString(16)}` : undefined,
  ])
  const quotesResults = await useSingleContractMultipleData(provider, quoter, 'quoteExactOutput', quoteExactOutInputs)

  if (!amountOut || !currencyIn || quotesResults.some(({ valid }) => !valid)) {
    return {
      state: V3TradeState.INVALID,
      trade: null,
    }
  }

  if (routesLoading || quotesResults.some(({ loading }) => loading)) {
    return {
      state: V3TradeState.LOADING,
      trade: null,
    }
  }

  const { bestRoute, amountIn } = quotesResults.reduce(
    (currentBest: { bestRoute: Route | null; amountIn: BigNumber | null }, { result }, i) => {
      if (!result) return currentBest

      if (currentBest.amountIn === null) {
        return {
          bestRoute: routes[i],
          amountIn: result.amountIn,
        }
      } else if (currentBest.amountIn.gt(result.amountIn)) {
        return {
          bestRoute: routes[i],
          amountIn: result.amountIn,
        }
      }

      return currentBest
    },
    {
      bestRoute: null,
      amountIn: null,
    }
  )

  if (!bestRoute || !amountIn) {
    return {
      state: V3TradeState.NO_ROUTE_FOUND,
      trade: null,
    }
  }

  const isSyncing = quotesResults.some(({ syncing }) => syncing)

  return {
    state: isSyncing ? V3TradeState.SYNCING : V3TradeState.VALID,
    trade: Trade.createUncheckedTrade({
      route: bestRoute,
      tradeType: TradeType.EXACT_OUTPUT,
      inputAmount:
        currencyIn instanceof Token
          ? new TokenAmount(currencyIn, amountIn.toString())
          : CurrencyAmount.ether(amountIn.toString()),
      outputAmount: amountOut,
    }),
  }
}
