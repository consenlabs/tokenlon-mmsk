import { Wallet, utils } from 'ethers'
import { orderBNToString, BigNumber } from '../utils'
import { generateSaltWithFeeFactor, signWithUserAndFee } from './pmmv5'
import { getOrderSignDigest } from './orderHash'
import { RFQOrder } from './types'
import * as ethUtils from 'ethereumjs-util'
import { SignatureType } from './types'

// spec of RFQV1
// - taker address point to userAddr
// - fee factor from salt
// - SignatureType EthSign for EOA address
// - SignatureType Wallet for contract address

// Signature:
// +------|---------|---------|-------------------|---------+
// |  R   |    S    |    V    | reserved 32 bytes | type(3) |
// +------|---------|---------|-------------------|---------+
export async function signByEOA(orderHash: string, wallet: Wallet): Promise<string> {
  // signature: R+S+V
  const hashArray = utils.arrayify(orderHash)
  let signature = await wallet.signMessage(hashArray)
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
  wallet: Wallet,
  signatureType: SignatureType
): string {
  let signature = signWithUserAndFee(wallet, orderHash, userAddr, feeFactor)
  const signatureBuffer = Buffer.concat([
    ethUtils.toBuffer(signature),
    ethUtils.toBuffer(signatureType),
  ])
  signature = '0x' + signatureBuffer.toString('hex')
  return signature
}

export const buildSignedOrder = async (
  signer: Wallet,
  order,
  userAddr: string,
  chainId: number,
  rfqAddr: string,
  signatureType: SignatureType
): Promise<any> => {
  // inject fee factor to salt
  const feeFactor = order.feeFactor
  order.takerAddress = userAddr.toLowerCase()
  order.salt = generateSaltWithFeeFactor(feeFactor)

  const rfqOrer = toRFQOrder(order)
  const orderHash = getOrderSignDigest(rfqOrer, chainId, rfqAddr)
  const makerWalletSignature =
    signer.address.toLowerCase() == order.makerAddress.toLowerCase()
      ? await signByEOA(orderHash, signer)
      : signByMMPSigner(orderHash, userAddr, feeFactor, signer, signatureType)

  const signedOrder = {
    ...order,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}

const toNumber = (obj: BigNumber | string): number => new BigNumber(obj).toNumber()

export function toRFQOrder(order): RFQOrder {
  return {
    takerAddr: order.takerAddress,
    makerAddr: order.makerAddress,
    takerAssetAddr: order.takerAssetAddress,
    makerAssetAddr: order.makerAssetAddress,
    takerAssetAmount: order.takerAssetAmount,
    makerAssetAmount: order.makerAssetAmount,
    deadline: toNumber(order.expirationTimeSeconds),
    feeFactor: order.feeFactor,
    salt: order.salt,
  }
}
