import { Wallet } from 'ethers'
import { orderBNToString } from '../utils'
import { generateSaltWithFeeFactor, signWithUserAndFee } from './pmmv5'
import { RFQOrder } from './types'
import { getOrderSignDigest } from './orderHash'
import * as ethUtils from 'ethereumjs-util'

// spec of RFQV1
// - taker address point to userAddr
// - fee factor from salt
// - SignatureType EthSign for EOA address
// - SignatureType Wallet for contract address

export enum SignatureType {
  Illegal = 0, // 0x00, default value
  Invalid = 1, // 0x01
  EIP712 = 2, // 0x02
  EthSign = 3, // 0x03
  WalletBytes = 4, // 0x04  standard 1271 wallet type
  WalletBytes32 = 5, // 0x05  standard 1271 wallet type
  Wallet = 6, // 0x06  0x wallet type for signature compatibility
  NSignatureTypes = 7, // 0x07, number of signature types. Always leave at end.
}

// Signature:
// +------|---------|---------|-------------------|---------+
// |  R   |    S    |    V    | reserved 32 bytes | type(3) |
// +------|---------|---------|-------------------|---------+
export async function signByEOA(orderHash: string, wallet: Wallet): Promise<string> {
  // signature: R+S+V
  let signature = await wallet.signMessage(orderHash)
  var signatureBuffer = Buffer.concat([
    ethUtils.toBuffer(signature),
    ethUtils.toBuffer('0x' + '00'.repeat(32)),
    ethUtils.toBuffer(SignatureType.EthSign),
  ])
  signature = '0x' + signatureBuffer.toString('hex')
  return signature
}

// For V4 Maket Maker Proxy (MMP)
// Signature:
// +------|---------|---------|---------|---------|---------+
// |  V   |    R    |    S    |userAddr |feeFactor| type(6) |
// +------|---------|---------|---------|---------|---------+
export function signByMMPSigner(
  orderHash: string,
  userAddr: string,
  feeFactor: number,
  wallet: Wallet
): string {
  let signature = signWithUserAndFee(wallet, orderHash, userAddr, feeFactor)
  const signatureBuffer = Buffer.concat([
    ethUtils.toBuffer(signature),
    ethUtils.toBuffer(SignatureType.Wallet),
  ])
  signature = '0x' + signatureBuffer.toString('hex')
  return signature
}

export const buildSignedOrder = async (
  signer: Wallet,
  order: RFQOrder,
  chainId: number,
  rfqAddr: string
) => {
  // inject fee factor to salt
  const userAddr = order.takerAddr
  const feeFactor = order.feeFactor
  order.salt = generateSaltWithFeeFactor(feeFactor)
  const orderHash = getOrderSignDigest(order, chainId, rfqAddr)
  const makerWalletSignature =
    signer.address.toLowerCase() == order.makerAddr.toLowerCase()
      ? await signByEOA(orderHash, signer)
      : signByMMPSigner(orderHash, userAddr, feeFactor, signer)

  const signedOrder = {
    ...order,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}
