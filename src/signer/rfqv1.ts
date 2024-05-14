import { utils } from 'ethers'
import { orderBNToString, BigNumber } from '../utils'
import { generateSaltWithFeeFactor, signWithUserAndFee } from './pmmv5'
import { getOrderHash, getOrderSignDigest } from './orderHash'
import { ExtendedZXOrder, RFQOrder, RemoteSigningRFQV1Request, WalletType } from './types'
import * as ethUtils from 'ethereumjs-util'
import { SignatureType } from './types'
import axios from 'axios'
import { Protocol } from '../types'
import { AbstractSigner } from '@toolchainx/ethers-gcp-kms-signer'

// spec of RFQV1
// - taker address point to userAddr
// - fee factor from salt
// - SignatureType EthSign for EOA address
// - SignatureType Wallet for contract address

export async function signByMMPSigner(
  orderSignDigest: string,
  userAddr: string,
  feeFactor: number,
  wallet: AbstractSigner,
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

export const forwardUnsignedOrder = async (
  signingUrl: string,
  orderInfo: RemoteSigningRFQV1Request
): Promise<string> => {
  console.log(`Signing url: ${signingUrl}`)
  console.log(`RFQV1 order:`)
  console.log(orderInfo)
  const resp = await axios.post(signingUrl, orderInfo)
  const body = resp.data
  console.log(`response:`)
  console.log(body)
  if (body.signature) {
    return body.signature
  } else {
    throw new Error('Invalid signature')
  }
}

export const signRFQOrder = async (
  chainId: number,
  rfqAddr: string,
  order: RFQOrder,
  maker: AbstractSigner,
  feeFactor = 30
): Promise<string> => {
  const domain = {
    name: 'Tokenlon',
    version: 'v5',
    chainId: chainId,
    verifyingContract: rfqAddr,
  }

  // The named list of all type definitions
  const types = {
    Order: [
      { name: 'takerAddr', type: 'address' },
      { name: 'makerAddr', type: 'address' },
      { name: 'takerAssetAddr', type: 'address' },
      { name: 'makerAssetAddr', type: 'address' },
      { name: 'takerAssetAmount', type: 'uint256' },
      { name: 'makerAssetAmount', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'feeFactor', type: 'uint256' },
    ],
  }

  // The data to sign
  const value = {
    takerAddr: order.takerAddr,
    makerAddr: order.makerAddr,
    takerAssetAddr: order.takerAssetAddr,
    makerAssetAddr: order.makerAssetAddr,
    takerAssetAmount: order.takerAssetAmount.toString(),
    makerAssetAmount: order.makerAssetAmount.toString(),
    salt: order.salt.toString(),
    deadline: order.deadline.toString(),
    feeFactor: feeFactor.toString(),
  }

  const signatureTypedData = await maker._signTypedData(domain, types, value)

  return signatureTypedData
}

export const buildSignedOrder = async (
  signer: AbstractSigner | undefined,
  order: ExtendedZXOrder,
  userAddr: string,
  chainId: number,
  rfqAddr: string,
  walletType: WalletType,
  options?: {
    signingUrl?: string
    salt?: string
  }
): Promise<ExtendedZXOrder> => {
  // inject fee factor to salt
  const feeFactor = order.feeFactor
  order.takerAddress = userAddr.toLowerCase()
  const salt = options ? options.salt : undefined
  const signingUrl = options ? options.signingUrl : undefined
  order.salt = generateSaltWithFeeFactor(feeFactor, salt)

  console.log(`rfqV1Order:`)
  console.log(orderBNToString(order))
  const rfqOrder = toRFQOrder(order)
  console.log(`rfqOrder:`)
  console.log(orderBNToString(rfqOrder))

  const orderHash = getOrderHash(rfqOrder)
  console.log(`orderHash: ${orderHash}`)
  const orderSignDigest = getOrderSignDigest(rfqOrder, chainId, rfqAddr)
  console.log(`orderSignDigest: ${orderSignDigest}`)
  let makerWalletSignature
  if (!signingUrl) {
    const signerAddress = await signer.getAddress()
    if (signerAddress.toLowerCase() == order.makerAddress.toLowerCase()) {
      const signatureTypedData = await signRFQOrder(
        chainId,
        rfqAddr,
        rfqOrder,
        signer,
        rfqOrder.feeFactor
      )
      const paddedNonce = '00'.repeat(32)
      makerWalletSignature =
        signatureTypedData + paddedNonce + SignatureType.EIP712.toString(16).padStart(2, '0')
    } else if (walletType === WalletType.ERC1271_EIP712) {
      // standard ERC1271 + ERC712 signature
      const signatureTypedData = await signRFQOrder(
        chainId,
        rfqAddr,
        rfqOrder,
        signer,
        rfqOrder.feeFactor
      )
      makerWalletSignature =
        signatureTypedData + SignatureType.WalletBytes32.toString(16).padStart(2, '0')
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
      quoteId: order.quoteId,
      protocol: Protocol.RFQV1,
      rfqOrder: orderBNToString(rfqOrder),
      feeFactor: feeFactor,
      orderHash: orderHash,
      orderSignDigest: orderSignDigest,
      userAddr: userAddr,
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

export function toRFQOrder(order: ExtendedZXOrder): RFQOrder {
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
