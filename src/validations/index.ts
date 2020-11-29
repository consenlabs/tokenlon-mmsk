import * as _ from 'lodash'
import { utils } from 'ethers'
import { Wallet } from '../types'
import * as ethUtils from 'ethereumjs-util'
import { BigNumber } from '@0xproject/utils'
import { isSupportedBaseQuote, getSupportedTokens } from '../utils/token'

export const isValidWallet = (wallet: Wallet): boolean => {
  if (!wallet) {
    console.error('wallet not found')
    return false
  }
  const { address, privateKey } = wallet
  if (!utils.isAddress(address)) {
    console.error(`address(${address}) is not valid`)
    return false
  }
  const addr = ethUtils.privateToAddress(new Buffer(privateKey, 'hex'))
  return `0x${addr.toString('hex')}`.toLowerCase() === address.toLowerCase()
}

export const isBigNumber = (v: any) => {
  return (
    v instanceof BigNumber ||
    (v && v.isBigNumber === true) ||
    (v && v._isBigNumber === true) ||
    false
  )
}

function validateRequiredFields(values, fields): boolean {
  return fields.every((key) => values[key] && typeof values[key] === 'string')
}

/*
 ** Validate newOrder request
 * - amount and uniqId should be present
 * - amount should great than zero
 * - user address should be validate
 */
export function validateNewOrderRequest(
  amount: number,
  uniqId: string | number,
  userAddress: string
): string {
  let errorMessage = null
  if (_.isNaN(+amount) || +amount <= 0) {
    errorMessage = `order's amount ${amount} must be a number > 0`
  } else if (!_.isString(uniqId)) {
    errorMessage = `query.uniqId ${uniqId}  must be string type`
  } else if (!utils.isAddress(userAddress)) {
    errorMessage = `userAddress:${userAddress} is not a valid address`
  }
  return errorMessage
}

/*
 ** Return a error message when query invalid
 * - should have string type fields base, quote, side
 * - side in [BUY,SELL]
 * - base and quote in supported token list
 * - amount should great than zero
 */
export function validateRequest(params): string {
  const { side, base, quote, amount } = params
  let errorMessage = null
  if (!validateRequiredFields(params, ['base', 'quote', 'side'])) {
    errorMessage = `base, quote, side must be string type, with ${JSON.stringify(params)}`
  } else if (side !== 'BUY' && side !== 'SELL') {
    errorMessage = "side must be one of 'BUY' and 'SELL'"
  } else if (!isSupportedBaseQuote(getSupportedTokens(), base, quote)) {
    errorMessage = `Don't support { Base:${base}, Quote:${quote} } trade`
  } else if (amount && (_.isNaN(+amount) || +amount < 0)) {
    errorMessage = `getRate's amount ${amount} must be a number >= 0, or you should not send this amount parameter`
  }
  return errorMessage
}
