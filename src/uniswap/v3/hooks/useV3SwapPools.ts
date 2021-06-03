import { Currency, Token } from '@uniswap/sdk-core'
import { FeeAmount, Pool } from '@uniswap/v3-sdk'
import { Provider } from '@ethersproject/abstract-provider'
import { useAllCurrencyCombinations } from './useAllCurrencyCombinations'
import { PoolState, usePools } from './usePools'

/**
 * Returns all the existing pools that should be considered for swapping between an input currency and an output currency
 * @param currencyIn the input currency
 * @param currencyOut the output currency
 */
export async function useV3SwapPools(
  provider: Provider,
  currencyIn?: Currency,
  currencyOut?: Currency
): Promise<{
  pools: Pool[]
  loading: boolean
}> {
  const allCurrencyCombinations = useAllCurrencyCombinations(currencyIn, currencyOut)

  const allCurrencyCombinationsWithAllFees: [Token, Token, FeeAmount][] =
  allCurrencyCombinations
    .reduce<[Token, Token, FeeAmount][]>((list, [tokenA, tokenB]) => {
    return list.concat([
      [tokenA, tokenB, FeeAmount.LOW],
      [tokenA, tokenB, FeeAmount.MEDIUM],
      [tokenA, tokenB, FeeAmount.HIGH],
    ])
  }, [])
  const pools = await usePools(provider, allCurrencyCombinationsWithAllFees)

  return {
    pools: pools
      .filter((tuple): tuple is [PoolState.EXISTS, Pool] => {
        return tuple[0] === PoolState.EXISTS && tuple[1] !== null
      })
      .map(([, pool]) => pool),
    loading: pools.some(([state]) => state === PoolState.LOADING),
  }
}
