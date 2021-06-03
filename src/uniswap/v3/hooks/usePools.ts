import { computePoolAddress } from '@uniswap/v3-sdk'
import { Token, Currency } from '@uniswap/sdk-core'
import { useMultipleContractSingleData } from '../state/multicall/hooks'
import { wrappedCurrency } from '../utils/wrappedCurrency'
import { Pool, FeeAmount } from '@uniswap/v3-sdk'
import { V3_CORE_FACTORY_ADDRESSES } from '../constants/v3'
import { abi as IUniswapV3PoolStateABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/pool/IUniswapV3PoolState.sol/IUniswapV3PoolState.json'
import { Interface } from '@ethersproject/abi'
import { Provider } from '@ethersproject/abstract-provider'

const POOL_STATE_INTERFACE = new Interface(IUniswapV3PoolStateABI)

export enum PoolState {
  LOADING,
  NOT_EXISTS,
  EXISTS,
  INVALID,
}

export async function usePools(
  provider: Provider,
  poolKeys: [Currency | undefined, Currency | undefined, FeeAmount | undefined][]
): Promise<[PoolState, Pool | null][]> {
  const chainId = 1

  const transformed: ([Token, Token, FeeAmount] | null)[] = poolKeys.map(([currencyA, currencyB, feeAmount]) => {
    if (!chainId || !currencyA || !currencyB || !feeAmount) return null
    const tokenA = wrappedCurrency(currencyA, chainId)
    const tokenB = wrappedCurrency(currencyB, chainId)
    if (!tokenA || !tokenB || tokenA.equals(tokenB)) return null
    const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA]
    return [token0, token1, feeAmount]
  })

  const v3CoreFactoryAddress = chainId && V3_CORE_FACTORY_ADDRESSES[chainId]
  const poolAddresses: (string | undefined)[] = transformed.map((value) => {
    if (!v3CoreFactoryAddress || !value) return undefined
    return computePoolAddress({
      factoryAddress: v3CoreFactoryAddress,
      tokenA: value[0],
      tokenB: value[1],
      fee: value[2],
    })
  })

  const slot0s = await useMultipleContractSingleData(provider, poolAddresses, POOL_STATE_INTERFACE, 'slot0')
  const liquidities = await useMultipleContractSingleData(provider, poolAddresses, POOL_STATE_INTERFACE, 'liquidity')
  return poolKeys.map((_key, index) => {
    const [token0, token1, fee] = transformed[index] ?? []
    if (!token0 || !token1 || !fee) return [PoolState.INVALID, null]

    const { result: slot0, loading: slot0Loading, valid: slot0Valid } = slot0s[index]
    const { result: liquidity, loading: liquidityLoading, valid: liquidityValid } = liquidities[index]

    if (!slot0Valid || !liquidityValid) return [PoolState.INVALID, null]
    if (slot0Loading || liquidityLoading) return [PoolState.LOADING, null]

    if (!slot0 || !liquidity) return [PoolState.NOT_EXISTS, null]

    if (!slot0.sqrtPriceX96 || slot0.sqrtPriceX96.eq(0)) return [PoolState.NOT_EXISTS, null]

    try {
      return [PoolState.EXISTS, new Pool(token0, token1, fee, slot0.sqrtPriceX96, liquidity[0], slot0.tick)]
    } catch (error) {
      console.error('Error when constructing the pool', error)
      return [PoolState.NOT_EXISTS, null]
    }
  })
}
