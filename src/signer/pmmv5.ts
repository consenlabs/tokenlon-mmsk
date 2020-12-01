import {
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  SignerType,
} from '0x-v2-order-utils'
import * as ethUtils from 'ethereumjs-util'
import { getWallet } from '../config'
import { ecSignOrderHash } from '../utils/sign'
import { orderBNToString } from '../utils/format'
import { GetFormatedSignedOrderParams } from './types'
import { getOrderAndFeeFactor } from '../0x/v2'
import { BigNumber } from '0x-v2-utils'

// changes of PMMV5
// - taker address point to PMM contract
// - fee factor from salt
// - user address from fee recipient

// Move fee factor to salt field
export const buildSignedOrder = (params: GetFormatedSignedOrderParams) => {
  const { userAddr } = params
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  const wallet = getWallet()

  // TODO: read from config for PMM contract address
  order.takerAddress = '0x74e6Bd3FFEa08F5c63B5Fb0cc80a5D29FDEFA866'.toLowerCase()
  order.feeRecipientAddress = userAddr

  // inject fee factor to salt
  let salt = generatePseudoRandomSalt()
  // remove low 5 precision
  salt = new BigNumber(salt.toString().slice(0, -5)).times(10000).plus(feeFactor)
  const o = {
    ...order,
    salt,
  }
  const orderHash = orderHashUtils.getOrderHashHex(o)

  const hash = ethUtils.bufferToHex(
    Buffer.concat([ethUtils.toBuffer(orderHash), ethUtils.toBuffer(userAddr.toLowerCase())])
  )
  // TODO: adapter to EOA
  const signature = ecSignOrderHash(wallet.privateKey, hash, wallet.address, SignerType.Default)
  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(userAddr.toLowerCase()),
    ])
  )
  const makerWalletSignature = signatureUtils.convertToSignatureWithType(
    walletSign,
    SignatureType.Wallet
  )

  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}
