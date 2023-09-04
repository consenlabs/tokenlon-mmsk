import { utils, Wallet } from 'ethers'
import { orderBNToString } from '../utils'
import { getOfferHash, getOfferSignDigest } from './orderHash'
import {
  Offer,
  PermitType,
  WalletType,
  SignatureType,
  ExtendedZXOrder,
  RemoteSigningRFQV2Request,
} from './types'
import * as ethUtils from 'ethereumjs-util'
import axios from 'axios'
import { generatePseudoRandomSalt } from '0x-v2-order-utils'
import { signWithUserAndFee } from './pmmv5'
import { Protocol } from '../types'

// spec of RFQV2
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
  orderInfo: RemoteSigningRFQV2Request
): Promise<string> => {
  console.log(`Signing url: ${signingUrl}`)
  console.log(`RFQV2 order:`)
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

export const signOffer = async (
  chainId: number,
  rfqAddr: string,
  order: Offer,
  maker: Wallet,
  signatureType = SignatureType.EIP712
): Promise<string> => {
  const domain = {
    name: 'Tokenlon',
    version: 'v5',
    chainId: chainId,
    verifyingContract: rfqAddr,
  }

  // The named list of all type definitions
  const types = {
    Offer: [
      { name: 'taker', type: 'address' },
      { name: 'maker', type: 'address' },
      { name: 'takerToken', type: 'address' },
      { name: 'takerTokenAmount', type: 'uint256' },
      { name: 'makerToken', type: 'address' },
      { name: 'makerTokenAmount', type: 'uint256' },
      { name: 'feeFactor', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'salt', type: 'uint256' },
    ],
  }
  const signatureTypedData = await maker._signTypedData(domain, types, order)
  const signature = Buffer.concat([
    ethUtils.toBuffer(signatureTypedData),
    ethUtils.toBuffer(signatureType),
  ])
  const eip712sig = '0x' + signature.toString('hex')

  return eip712sig
}

export const buildSignedOrder = async (
  signer: Wallet | undefined,
  order: ExtendedZXOrder,
  userAddr: string,
  chainId: number,
  rfqAddr: string,
  walletType: WalletType,
  permitType: PermitType,
  options?: {
    signingUrl?: string
    salt?: string
  }
): Promise<ExtendedZXOrder> => {
  // inject fee factor to salt
  const feeFactor = order.feeFactor
  order.takerAddress = userAddr.toLowerCase()
  const salt = options ? options.salt : undefined
  const rfqV2Order = {
    ...order,
    salt: salt ? salt : generatePseudoRandomSalt(),
  }

  const signingUrl = options ? options.signingUrl : undefined
  const rfqOrder = toOffer(rfqV2Order)
  console.log(`rfqOrder`)
  console.log(rfqOrder)
  const orderHash = getOfferHash(rfqOrder)
  console.log(`orderHash: ${orderHash}`)
  const orderSignDigest = getOfferSignDigest(rfqOrder, chainId, rfqAddr)
  console.log(`chainId: ${chainId}`)
  console.log(`rfqAddr: ${rfqAddr}`)
  console.log(`orderSignDigest: ${orderSignDigest}`)
  let makerWalletSignature
  if (!signingUrl) {
    if (signer.address.toLowerCase() == order.makerAddress.toLowerCase()) {
      makerWalletSignature = await signOffer(
        chainId,
        rfqAddr,
        rfqOrder,
        signer,
        SignatureType.EIP712
      )
    } else if (walletType === WalletType.ERC1271_EIP712) {
      // standard ERC1271 + ERC712 signature
      makerWalletSignature = await signOffer(
        chainId,
        rfqAddr,
        rfqOrder,
        signer,
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
      quoteId: order.quoteId,
      protocol: Protocol.RFQV2,
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
    ...rfqV2Order,
    payload: Buffer.from(JSON.stringify({ makerTokenPermit: permitType })).toString('base64'),
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}

export function toOffer(order): Offer {
  return {
    taker: order.takerAddress,
    maker: order.makerAddress,
    takerToken: order.takerAssetAddress,
    takerTokenAmount: order.takerAssetAmount.toString(),
    makerToken: order.makerAssetAddress,
    makerTokenAmount: order.makerAssetAmount.toString(),
    feeFactor: order.feeFactor.toString(),
    expiry: order.expirationTimeSeconds.toString(),
    salt: order.salt.toString(),
  }
}
