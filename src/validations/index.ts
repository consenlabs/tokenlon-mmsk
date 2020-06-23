import * as _ from 'lodash'
import * as Web3Export from 'web3'
import { Wallet } from '../types'
import * as ethUtils from 'ethereumjs-util'
import { BigNumber } from '@0xproject/utils'
import { isSupportedBaseQuote, getSupportedTokens } from '../utils/token'

const Web3 = Web3Export.default ? Web3Export.default : Web3Export

export const isValidWallet = (wallet: Wallet): boolean => {
  if (!wallet) return false
  const { address, privateKey } = wallet
  if (!Web3.utils.isAddress(address)) return false
  const addr = ethUtils.privateToAddress(new Buffer(privateKey, 'hex'))
  return `0x${addr.toString('hex')}`.toLowerCase() === address.toLowerCase()
}

export const isBigNumber = (v: any) => {
  return v instanceof BigNumber ||
    (v && v.isBigNumber === true) ||
    (v && v._isBigNumber === true) ||
    false
}

export const checkParams = (query, isNewOrderAPI?: boolean) => {
  let message = ''
  if (!['base', 'quote', 'side'].every((key) => {
    return _.isString(query[key])
  })) {
    message = 'base, quote, side must be string type'

  } else if (query.side !== 'BUY' && query.side !== 'SELL') {
    message = 'side must be one of \'BUY\' and \'SELL\''

  } else if (!isSupportedBaseQuote(getSupportedTokens(), query)) {
    message = `Don't support ${query.base} - ${query.quote} trade`

  } else if (query.amount && (_.isNaN(+query.amount) || +query.amount < 0)) {
    message = `getRate's amount ${query.amount} must be a number >= 0, or you should not send this amount parameter`

  } else if (isNewOrderAPI) {
    if (_.isNaN(+query.amount) || +query.amount <= 0) {
      message = `order's amount ${query.amount} must be a number > 0`

    } else if (!_.isString(query.uniqId)) {
      message = `query.uniqId ${query.uniqId}  must be string type`

    } else if (!Web3.utils.isAddress(query.userAddr)) {
      message = `userAddr ${query.userAddr} is not a valid address`
    }
  }
  return {
    result: !message,
    message,
  }
}
