import {
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  SignerType,
} from '0x-v2-order-utils'
import ethUtils from 'ethereumjs-util'
import { getWallet } from '../config'
import { ecSignOrderHash } from '../utils/sign'
import { orderBNToString } from '../utils/format'
import { GetFormatedSignedOrderParams } from './types'
import { getOrderAndFeeFactor } from '../0x/v2'

// Move fee factor to salt field
export const buildSignedOrder = (params: GetFormatedSignedOrderParams) => {
  const { userAddr } = params
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  const wallet = getWallet()

  const o = {
    ...order,
    salt: generatePseudoRandomSalt(),
  }
  const buf = Buffer.allocUnsafe(2)
  buf.writeUInt16LE(feeFactor, 0) // Big endian

  const orderHash = orderHashUtils.getOrderHashHex(o)

  const hash = ethUtils.bufferToHex(
    Buffer.concat([ethUtils.toBuffer(orderHash), ethUtils.toBuffer(userAddr.toLowerCase())])
  )

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
