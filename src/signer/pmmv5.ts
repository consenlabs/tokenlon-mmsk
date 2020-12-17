import {
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  SignerType,
} from '0x-v2-order-utils'
import * as ethUtils from 'ethereumjs-util'
import { utils } from 'ethers'
import { getWallet } from '../config'
import { ecSignOrderHash } from '../utils/sign'
import { orderBNToString } from '../utils/format'
import { GetFormatedSignedOrderParams } from './types'
import { getOrderAndFeeFactor } from './pmmv4'
import { BigNumber } from '0x-v2-utils'

// changes of PMMV5
// - taker address point to PMM contract
// - fee factor from salt
// - user address from fee recipient

export const generateSaltWithFeeFactor = (feeFactor: number) => {
  const feeHex = utils.hexZeroPad('0x' + feeFactor.toString(16), 2)
  // append 001e = 30 (fee factor to salt)
  return new BigNumber(generatePseudoRandomSalt().toString(16).slice(0, -4) + feeHex.slice(2), 16)
}

// Move fee factor to salt field
export const buildSignedOrder = (params: GetFormatedSignedOrderParams) => {
  const { userAddr, config } = params
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  const wallet = getWallet()

  order.takerAddress = config.addressBookV5.PMM.toLowerCase()
  order.senderAddress = config.addressBookV5.PMM.toLowerCase()
  order.feeRecipientAddress = userAddr

  // inject fee factor to salt
  const o = {
    ...order,
    salt: generateSaltWithFeeFactor(feeFactor),
  }
  const orderHash = orderHashUtils.getOrderHashHex(o)

  // TODO: add fee factor or not depend on the MMP version
  const hash = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(orderHash),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )
  // TODO: adapter to EOA
  const signature = ecSignOrderHash(wallet.privateKey, hash, wallet.address, SignerType.Default)
  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
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
