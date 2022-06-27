import { Wallet, utils } from 'ethers'
import { orderBNToString, BigNumber } from '../utils'
import { generateSaltWithFeeFactor, signWithUserAndFee } from './pmmv5'
import { getOrderSignDigest } from './orderHash'
import { RFQOrder, WalletType } from './types'
import * as ethUtils from 'ethereumjs-util'
import { SignatureType } from './types'
import { ecSignOrderHash } from './ecsign'
import { SignerType } from '0x-v2-order-utils'

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

export function signByMMPSigner(
  orderHash: string,
  userAddr: string,
  feeFactor: number,
  wallet: Wallet,
  walletType: WalletType
): string {
  if (walletType === WalletType.MMP_VERSOIN_4) {
    // For V4 Maket Maker Proxy (MMP)
    // Signature:
    // +------|---------|---------|---------|---------|---------+
    // |  V   |    R    |    S    |userAddr |feeFactor| type(6) |
    // +------|---------|---------|---------|---------|---------+
    let signature = signWithUserAndFee(wallet, orderHash, userAddr, feeFactor)
    const signatureBuffer = Buffer.concat([
      ethUtils.toBuffer(signature),
      ethUtils.toBuffer(SignatureType.Wallet),
    ])
    signature = '0x' + signatureBuffer.toString('hex')
    return signature
  } else if (walletType === WalletType.MMP_VERSION_5) {
    // |1 byte| 32 byte | 32 byte | 1 byte  |
    // +------|---------|---------|---------+
    // |  V   |    R    |    S    | type(6) |
    // +------|---------|---------|---------+
    let signature = ecSignOrderHash(
      wallet.privateKey.slice(2),
      orderHash,
      wallet.address,
      SignerType.Default
    )
    const signatureBuffer = Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(SignatureType.Wallet),
    ])
    signature = '0x' + signatureBuffer.toString('hex')
    return signature
  } else if (walletType === WalletType.ERC1271) {
    // | 32 byte | 32 byte |1 byte| 1 bytes |
    // +---------|---------|------|---------+
    // |    R    |    S    |  V   | type(5) |
    // +---------|---------|------|---------+
    let signature = ecSignOrderHash(
      wallet.privateKey.slice(2),
      orderHash,
      wallet.address,
      SignerType.Default
    )
    console.log(`signature original: ${signature}`)
    signature = signature.slice(2, -2)
    console.log(`signature: ${signature}`)
    const v = signature.slice(0, 2)
    const r = signature.slice(2, 66)
    const s = signature.slice(66, 134)

    // const { v, r, s } = ethers.utils.splitSignature(ethers.utils.arrayify(signature))
    console.log(v)
    console.log(r)
    console.log(s)
    signature = `0x${r}${s}${v}`
    const signatureBuffer = Buffer.concat([
      ethUtils.toBuffer(signature).slice(0, 65),
      ethUtils.toBuffer(SignatureType.WalletBytes32),
    ])
    signature = '0x' + signatureBuffer.toString('hex')
    return signature
  } else {
    throw new Error('Unsupported wallet contract')
  }
}

export const buildSignedOrder = async (
  signer: Wallet,
  order,
  userAddr: string,
  chainId: number,
  rfqAddr: string,
  walletType: WalletType
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
      : signByMMPSigner(orderHash, userAddr, feeFactor, signer, walletType)

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
