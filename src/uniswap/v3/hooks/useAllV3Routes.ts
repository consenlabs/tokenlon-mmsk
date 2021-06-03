import { ChainId, Currency } from '@uniswap/sdk-core'
import { Pool, Route } from '@uniswap/v3-sdk'
import { wrappedCurrency } from '../utils/wrappedCurrency'
import { useV3SwapPools } from './useV3SwapPools'
import { Provider } from '@ethersproject/abstract-provider'

function computeAllRoutes(
  currencyIn: Currency,
  currencyOut: Currency,
  pools: Pool[],
  chainId: ChainId,
  currentPath: Pool[] = [],
  allPaths: Route[] = [],
  startCurrencyIn: Currency = currencyIn,
  maxHops = 2
): Route[] {
  const tokenIn = wrappedCurrency(currencyIn, chainId)
  const tokenOut = wrappedCurrency(currencyOut, chainId)

  if (!tokenIn || !tokenOut) {
    throw new Error('Could not wrap currencies')
  }

  for (const pool of pools) {
    if (currentPath.indexOf(pool) !== -1 || !pool.involvesToken(tokenIn)) continue

    const outputToken = pool.token0.equals(tokenIn) ? pool.token1 : pool.token0
    if (outputToken.equals(tokenOut)) {
      allPaths.push(new Route([...currentPath, pool], startCurrencyIn, currencyOut))
    } else if (maxHops > 1) {
      computeAllRoutes(
        outputToken,
        currencyOut,
        pools,
        chainId,
        [...currentPath, pool],
        allPaths,
        startCurrencyIn,
        maxHops - 1
      )
    }
  }

  return allPaths
}

/**
 * Returns all the routes from an input currency to an output currency
 * @param currencyIn the input currency
 * @param currencyOut the output currency
 */
export async function useAllV3Routes(provider: Provider, currencyIn?: Currency, currencyOut?: Currency): Promise<{ loading: boolean; routes: Route[] }> {
  const chainId = 1
  const { pools, loading: poolsLoading } = await useV3SwapPools(provider, currencyIn, currencyOut)

  const singleHopOnly = false

  if (poolsLoading || !chainId || !pools || !currencyIn || !currencyOut) return { loading: true, routes: [] }

  const routes = computeAllRoutes(currencyIn, currencyOut, pools, chainId, [], [], currencyIn, singleHopOnly ? 1 : 2)
  return { loading: false, routes }
}
