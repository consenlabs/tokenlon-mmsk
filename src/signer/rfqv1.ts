import { Wallet, utils } from 'ethers'
import { orderBNToString, BigNumber } from '../utils'
import { generateSaltWithFeeFactor, signWithUserAndFee } from './pmmv5'
import { getOrderHash, getOrderSignDigest } from './orderHash'
import { RFQOrder, WalletType } from './types'
import * as ethUtils from 'ethereumjs-util'
import { SignatureType } from './types'
import axios from 'axios'

// spec of RFQV1
// - taker address point to userAddr
// - fee factor from salt
// - SignatureType EthSign for EOA address
// - SignatureType Wallet for contract address

// Signature:
// +------|---------|---------|-------------------|---------+
// |  R   |    S    |    V    | reserved 32 bytes | type(3) |
// +------|---------|---------|-------------------|---------+
export async function signByEOA(orderSignDigest: string, wallet: Wallet): Promise<string> {
  // signature: R+S+V
  const hashArray = utils.arrayify(orderSignDigest)
  let signature = await wallet.signMessage(hashArray)
  const signatureBuffer = Buffer.concat([
    ethUtils.toBuffer(signature),
    ethUtils.toBuffer('0x' + '00'.repeat(32)),
    ethUtils.toBuffer(SignatureType.EthSign),
  ])
  signature = '0x' + signatureBuffer.toString('hex')
  return signature
}

export async function signByMMPSigner(
  orderSignDigest: string,
  userAddr: string,
  feeFactor: number,
  wallet: Wallet,
  walletType: WalletType
): Promise<string> {
  if (walletType === WalletType.MMP_VERSION_4) {
    // For V4 Maket Maker Proxy (MMP)
    // Signature:
    // +------|---------|---------|---------|---------|---------+
    // |  V   |    R    |    S    |userAddr |feeFactor| type(6) |
    // +------|---------|---------|---------|---------|---------+
    let signature = await signWithUserAndFee(wallet, orderSignDigest, userAddr, feeFactor)
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
    let signature = await wallet.signMessage(utils.arrayify(orderSignDigest))
    const { v, r, s } = await utils.splitSignature(signature)
    signature = `0x${v.toString(16)}${r.slice(2)}${s.slice(2)}`
    const signatureBuffer = Buffer.concat([
      ethUtils.toBuffer(signature),
      ethUtils.toBuffer(SignatureType.Wallet),
    ])
    signature = '0x' + signatureBuffer.toString('hex')
    return signature
  } else if (walletType === WalletType.ERC1271_EIP712_EIP191) {
    // | 32 byte | 32 byte |1 byte| 1 bytes |
    // +---------|---------|------|---------+
    // |    R    |    S    |  V   | type(5) |
    // +---------|---------|------|---------+
    let signature = await wallet.signMessage(utils.arrayify(orderSignDigest))
    const signatureBuffer = Buffer.concat([
      ethUtils.toBuffer(signature),
      ethUtils.toBuffer(SignatureType.WalletBytes32),
    ])
    signature = '0x' + signatureBuffer.toString('hex')
    return signature
  } else {
    throw new Error('Unsupported wallet contract')
  }
}

export const forwardUnsignedOrder = async (signingUrl: string, orderInfo: any): Promise<string> => {
  const resp = await axios.post(signingUrl, orderInfo)
  const body = resp.data
  if (body.signature) {
    return body.signature
  } else {
    throw new Error('Invalid signature')
  }
}

export const signRFQTx = async (
  chainId: number,
  rfqAddr: string,
  signedOrder: any,
  user: Wallet,
  receiverAddr: string,
  signatureType = SignatureType.EIP712
) => {
  const domain = {
    name: 'Tokenlon',
    version: 'v5',
    chainId: chainId,
    verifyingContract: rfqAddr,
  }

  const types = {
    fillWithPermit: [
      { name: 'makerAddr', type: 'address' },
      { name: 'takerAssetAddr', type: 'address' },
      { name: 'makerAssetAddr', type: 'address' },
      { name: 'takerAssetAmount', type: 'uint256' },
      { name: 'makerAssetAmount', type: 'uint256' },
      { name: 'takerAddr', type: 'address' },
      { name: 'receiverAddr', type: 'address' },
      { name: 'salt', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'feeFactor', type: 'uint256' },
    ],
  }

  // The data to sign
  const value = {
    makerAddr: signedOrder.makerAddr,
    takerAssetAddr: signedOrder.takerAssetAddr,
    makerAssetAddr: signedOrder.makerAssetAddr,
    takerAssetAmount: signedOrder.takerAssetAmount.toString(),
    makerAssetAmount: signedOrder.makerAssetAmount.toString(),
    takerAddr: signedOrder.takerAddr,
    receiverAddr: receiverAddr,
    salt: signedOrder.salt.toString(),
    deadline: signedOrder.deadline.toString(),
    feeFactor: signedOrder.feeFactor.toString(),
  }

  const signatureTypedData = await user._signTypedData(domain, types, value)
  const signature = Buffer.concat([
    ethUtils.toBuffer(signatureTypedData),
    ethUtils.toBuffer(signatureType),
  ])
  const eip712sig = '0x' + signature.toString('hex')
  return eip712sig
}

export const buildSignedOrder = async (
  signer: Wallet,
  order: any,
  userAddr: string,
  chainId: number,
  rfqAddr: string,
  walletType: WalletType,
  options?: {
    signingUrl?: string
    salt?: string
  }
): Promise<any> => {
  // inject fee factor to salt
  const feeFactor = order.feeFactor
  order.takerAddress = userAddr.toLowerCase()
  const salt = options ? options.salt : undefined
  const signingUrl = options ? options.signingUrl : undefined
  order.salt = generateSaltWithFeeFactor(feeFactor, salt)

  const rfqOrer = toRFQOrder(order)

  const orderHash = getOrderHash(rfqOrer)
  console.log(`orderHash: ${orderHash}`)
  const orderSignDigest = getOrderSignDigest(rfqOrer, chainId, rfqAddr)
  console.log(`orderSignDigest: ${orderSignDigest}`)
  let makerWalletSignature
  if (!signingUrl) {
    if (signer.address.toLowerCase() == order.makerAddress.toLowerCase()) {
      makerWalletSignature = await signRFQTx(
        chainId,
        rfqAddr,
        rfqOrer,
        signer,
        rfqOrer.makerAddr,
        SignatureType.EIP712
      )
    } else if (walletType === WalletType.ERC1271_EIP712) {
      // standard ERC1271 + ERC712 signature
      makerWalletSignature = await signRFQTx(
        chainId,
        rfqAddr,
        rfqOrer,
        signer,
        rfqOrer.makerAddr,
        SignatureType.WalletBytes32
      )
    } else {
      // non-standard wallet contract signature checks
      makerWalletSignature = await signByMMPSigner(
        orderSignDigest,
        userAddr,
        feeFactor,
        signer,
        walletType
      )
    }
  } else {
    makerWalletSignature = await forwardUnsignedOrder(signingUrl, {
      rfqOrer: rfqOrer,
      userAddr: userAddr,
      signer: signer.address,
      chainId: chainId,
      rfqAddr: rfqAddr,
    })
  }

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
