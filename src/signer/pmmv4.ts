import {
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  SignerType,
} from '0x-v2-order-utils'
import * as ethUtils from 'ethereumjs-util'
import { orderBNToString } from '../utils/format'
import { ecSignOrderHash } from './ecsign'
import { Wallet } from 'ethers'

export function signWithUserAndFee(
  signer: Wallet,
  orderHash: string,
  userAddr: string,
  feeFactor: number
) {
  const hash = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(orderHash),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )

  const signature = ecSignOrderHash(signer.privateKey, hash, signer.address, SignerType.Default)

  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )
  return walletSign
}

export const buildSignedOrder = (signer: Wallet, order, userAddr, feeFactor) => {
  const o = {
    ...order,
    salt: generatePseudoRandomSalt(),
  }
  const orderHash = orderHashUtils.getOrderHashHex(o)
  const walletSign = signWithUserAndFee(signer, orderHash, userAddr, feeFactor)
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
