import { Interface, FunctionFragment } from '@ethersproject/abi'
import { Provider } from '@ethersproject/abstract-provider'
import { BigNumber } from '@ethersproject/bignumber'
import { Contract } from '@ethersproject/contracts'
import multicall2Abi from '../../abis/multicall2.json'
import { MULTICALL2_ADDRESSES } from '../../constants'

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/
const LOWER_HEX_REGEX = /^0x[a-f0-9]*$/

export function toCallKey(call: Call): string {
  if (!ADDRESS_REGEX.test(call.target)) {
    throw new Error(`Invalid address: ${call.target}`)
  }
  if (!LOWER_HEX_REGEX.test(call.callData)) {
    throw new Error(`Invalid hex: ${call.callData}`)
  }
  let key = `${call.target}-${call.callData}`
  if (call.gasRequired) {
    if (!Number.isSafeInteger(call.gasRequired)) {
      throw new Error(`Invalid number: ${call.gasRequired}`)
    }
    key += `-${call.gasRequired}`
  }
  return key
}


export interface Call {
  target: string
  callData: string
  gasRequired?: number
}

export interface ListenerOptions {
  // how often this data should be fetched, by default 1
  readonly blocksPerFetch?: number
}

export interface Result extends ReadonlyArray<any> {
  readonly [key: string]: any
}

type MethodArg = string | number | BigNumber
type MethodArgs = Array<MethodArg | MethodArg[]>

export type OptionalMethodInputs = Array<MethodArg | MethodArg[] | undefined> | undefined

function isMethodArg(x: unknown): x is MethodArg {
  return BigNumber.isBigNumber(x) || ['string', 'number'].indexOf(typeof x) !== -1
}

function isValidMethodArgs(x: unknown): x is MethodArgs | undefined {
  return (
    x === undefined ||
    (Array.isArray(x) &&
      x.every((xi) => isMethodArg(xi) || (Array.isArray(xi) && xi.every(isMethodArg))))
  )
}

interface CallResult {
  readonly valid: boolean
  readonly data: string | undefined
  readonly blockNumber: number | undefined
}

// use this options object
export const NEVER_RELOAD: ListenerOptions = {
  blocksPerFetch: Infinity,
}

export interface CallState {
  readonly valid: boolean
  // the result, or undefined if loading or errored/no data
  readonly result: Result | undefined
  // true if the result has never been fetched
  readonly loading: boolean
  // true if the result is not for the latest block
  readonly syncing: boolean
  // true if the call was made and is synced, but the return data is invalid
  readonly error: boolean
}

const INVALID_CALL_STATE: CallState = {
  valid: false,
  result: undefined,
  loading: false,
  syncing: false,
  error: false,
}
const LOADING_CALL_STATE: CallState = {
  valid: true,
  result: undefined,
  loading: true,
  syncing: true,
  error: false,
}

function toCallState(
  callResult: CallResult | undefined,
  contractInterface: Interface | undefined,
  fragment: FunctionFragment | undefined,
  latestBlockNumber: number | undefined
): CallState {
  if (!callResult) return INVALID_CALL_STATE
  const { valid, data, blockNumber } = callResult
  if (!valid) return INVALID_CALL_STATE
  if (valid && !blockNumber) return LOADING_CALL_STATE
  if (!contractInterface || !fragment || !latestBlockNumber) return LOADING_CALL_STATE
  const success = data && data.length > 2
  const syncing = (blockNumber ?? 0) < latestBlockNumber
  let result: Result | undefined = undefined
  if (success && data) {
    try {
      result = contractInterface.decodeFunctionResult(fragment, data)
    } catch (error) {
      // console.debug('Result data parsing failed', fragment, data)
      return {
        valid: true,
        loading: false,
        error: true,
        syncing,
        result,
      }
    }
  }
  return {
    valid: true,
    loading: false,
    syncing,
    result: result,
    error: !success,
  }
}

export async function useMultipleContractSingleData(
  provider: Provider,
  addresses: (string | undefined)[],
  contractInterface: Interface,
  methodName: string,
  callInputs?: OptionalMethodInputs,
  options?: ListenerOptions,
  gasRequired?: number
): Promise<CallState[]> {
  const chainId = 1
  const fragment = contractInterface.getFunction(methodName)
  const callData: string | undefined =
    fragment && isValidMethodArgs(callInputs)
      ? contractInterface.encodeFunctionData(fragment, callInputs)
      : undefined

  const calls =
    fragment && addresses && addresses.length > 0 && callData
      ? addresses.map<Call | undefined>((target) => {
          return target && callData
            ? {
                target,
                callData,
                ...(gasRequired ? { gasRequired } : {}),
              }
            : undefined
        })
      : []

  const latestBlockNumber = await provider.getBlockNumber()
  const multicall2 = new Contract(MULTICALL2_ADDRESSES[chainId], multicall2Abi, provider)
  let results: any = await multicall2.callStatic.tryBlockAndAggregate(false, calls)
  results = results.returnData.map((result: any) => {
    let data
    if (result?.returnData && result?.returnData !== '0x') {
      data = result.returnData
    }

    return { valid: true, data, blockNumber: results?.blockNumber }
  })
  return results.map((result: any) =>
    toCallState(result, contractInterface, fragment, latestBlockNumber)
  )
}

export async function useSingleContractMultipleData(
  provider: Provider,
  contract: Contract | null | undefined,
  methodName: string,
  callInputs: OptionalMethodInputs[],
  /* tslint:disable:no-unused-variable */
  options?: ListenerOptions,
  gasRequired?: number
): Promise<CallState[]> {
  const chainId = 1
  const fragment = contract?.interface?.getFunction(methodName)

  const calls =
    contract &&
    fragment &&
    callInputs?.length > 0 &&
    callInputs.every((inputs) => isValidMethodArgs(inputs))
      ? callInputs.map<Call>((inputs) => {
          return {
            target: contract.address,
            callData: contract.interface.encodeFunctionData(fragment, inputs),
            ...(gasRequired ? { gasRequired } : {}),
          }
        })
      : []
  const latestBlockNumber = await provider.getBlockNumber()
  const multicall2 = new Contract(MULTICALL2_ADDRESSES[chainId], multicall2Abi, provider)
  let results: any = await multicall2.callStatic.tryBlockAndAggregate(false, calls)
  results = results.returnData.map((result: any) => {
    let data
    if (result?.returnData && result?.returnData !== '0x') {
      data = result.returnData
    }

    return { valid: true, data, blockNumber: results?.blockNumber }
  })
  return results.map((result: any) =>
    toCallState(result, contract?.interface, fragment, latestBlockNumber)
  )
}
