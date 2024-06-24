import {
  eip712Utils,
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  EIP712Types,
} from '0x-v2-order-utils'
import * as ethUtils from 'ethereumjs-util'
import { utils } from 'ethers'
import axios from 'axios'
import { BigNumber, orderBNToString } from '../utils'
import { Protocol } from '../types'
import { ExtendedZXOrder, RemoteSigningPMMV5Request } from './types'
import { Order as ZXOrder } from '0x-v2-order-utils'
import { AbstractSigner } from '@toolchainx/ethers-gcp-kms-signer'

export const EIP712_ORDER_SCHEMA = {
  name: 'Order',
  parameters: [
    { name: 'makerAddress', type: EIP712Types.Address },
    { name: 'takerAddress', type: EIP712Types.Address },
    { name: 'feeRecipientAddress', type: EIP712Types.Address },
    { name: 'senderAddress', type: EIP712Types.Address },
    { name: 'makerAssetAmount', type: EIP712Types.Uint256 },
    { name: 'takerAssetAmount', type: EIP712Types.Uint256 },
    { name: 'makerFee', type: EIP712Types.Uint256 },
    { name: 'takerFee', type: EIP712Types.Uint256 },
    { name: 'expirationTimeSeconds', type: EIP712Types.Uint256 },
    { name: 'salt', type: EIP712Types.Uint256 },
    { name: 'makerAssetData', type: EIP712Types.Bytes },
    { name: 'takerAssetData', type: EIP712Types.Bytes },
  ],
}

// changes of PMMV5
// - taker address point to PMM contract
// - fee factor from salt
// - user address from fee recipient

export const generateSaltWithFeeFactor = (feeFactor: number, prefixSalt?: string) => {
  // append 001e = 30 (fee factor to salt)
  const feeHex = utils.hexZeroPad('0x' + feeFactor.toString(16), 2)
  if (prefixSalt) {
    if (!(prefixSalt.toString().length === 32 || prefixSalt.toString().length === 34)) {
      throw new Error('Invalid salt from market maker')
    }
    if (prefixSalt.toString().startsWith('0x')) {
      prefixSalt = prefixSalt.toString().slice(2)
    }
    const postfixSalt = `${generatePseudoRandomSalt()
      .toString(16)
      .slice(0, 32)
      .slice(0, -4)}${feeHex.slice(2)}`
    return new BigNumber(`${prefixSalt}${postfixSalt}`, 16)
  } else {
    return new BigNumber(generatePseudoRandomSalt().toString(16).slice(0, -4) + feeHex.slice(2), 16)
  }
}

// Signature:
// +------|---------|---------|---------|---------+
// |  V   |    R    |    S    |userAddr |feeFactor|
// +------|---------|---------|---------|---------+
export async function signWithUserAndFee(
  signer: AbstractSigner,
  orderSignDigest: string,
  userAddr: string,
  feeFactor: number
): Promise<string> {
  const hash = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(orderSignDigest),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )

  let signature = await signer.signMessage(utils.arrayify(hash))
  const { v, r, s } = await utils.splitSignature(signature)
  signature = `0x${v.toString(16)}${r.slice(2)}${s.slice(2)}`
  const walletSign = ethUtils.bufferToHex(
    Buffer.concat([
      ethUtils.toBuffer(signature),
      ethUtils.toBuffer(userAddr.toLowerCase()),
      ethUtils.toBuffer(feeFactor > 255 ? feeFactor : [0, feeFactor]),
    ])
  )
  return walletSign
}

// Signature:
// +------|---------|---------|---------+
// |  v   |    R    |    S    | type(3) |
// +------|---------|---------|---------+
export async function signByEOA(orderSignDigest: string, wallet: AbstractSigner): Promise<string> {
  const hashArray = utils.arrayify(orderSignDigest)
  let signature = await wallet.signMessage(hashArray)
  signature = signature.slice(2)
  const v = signature.slice(signature.length - 2, signature.length)
  const rs = signature.slice(0, signature.length - 2)
  signature = '0x' + v + rs
  return signatureUtils.convertToSignatureWithType(signature, SignatureType.EthSign)
}

// For V4 Maket Maker Proxy (MMP)
// Signature:
// +------|---------|---------|---------|---------|---------+
// |  V   |    R    |    S    |userAddr |feeFactor| type(4) |
// +------|---------|---------|---------|---------|---------+
export async function signByMMPSigner(
  orderSignDigest: string,
  userAddr: string,
  feeFactor: number,
  wallet: AbstractSigner
): Promise<string> {
  const walletSign = await signWithUserAndFee(wallet, orderSignDigest, userAddr, feeFactor)
  return signatureUtils.convertToSignatureWithType(walletSign, SignatureType.Wallet)
}

export const forwardUnsignedOrder = async (
  signingUrl: string,
  orderInfo: RemoteSigningPMMV5Request
): Promise<string> => {
  console.log(`Signing url: ${signingUrl}`)
  console.log(`PMMV5 order:`)
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

// Move fee factor to salt field
export const buildSignedOrder = async (
  signer: AbstractSigner | undefined,
  order: ExtendedZXOrder,
  userAddr: string,
  chainId: number,
  pmm: string,
  options?: {
    signingUrl?: string
    salt?: string
  }
): Promise<ExtendedZXOrder> => {
  const signingUrl = options ? options.signingUrl : undefined
  const feeFactor = order.feeFactor
  order.takerAddress = pmm.toLowerCase()
  order.senderAddress = pmm.toLowerCase()
  order.feeRecipientAddress = userAddr
  const salt = options ? options.salt : undefined
  order.salt = salt ? new BigNumber(salt) : generateSaltWithFeeFactor(feeFactor)
  // inject fee factor to salt
  const o: ZXOrder = {
    makerAddress: order.makerAddress,
    makerAssetAmount: order.makerAssetAmount as BigNumber,
    makerAssetData: order.makerAssetData,
    makerFee: order.makerFee as BigNumber,
    takerAddress: order.takerAddress,
    takerAssetAmount: order.takerAssetAmount as BigNumber,
    takerAssetData: order.takerAssetData,
    takerFee: order.takerFee as BigNumber,
    senderAddress: order.senderAddress,
    feeRecipientAddress: order.feeRecipientAddress,
    expirationTimeSeconds: order.expirationTimeSeconds as BigNumber,
    exchangeAddress: order.exchangeAddress,
    salt: order.salt,
  }
  console.log(`ZXOrder:`)
  console.log(orderBNToString(o))
  const orderHashBuffer = eip712Utils.structHash(EIP712_ORDER_SCHEMA, o)
  const orderHash = '0x' + orderHashBuffer.toString('hex')
  console.log(`orderHash: ${orderHash}`)
  const orderSignDigest = orderHashUtils.getOrderHashHex(o)
  console.log(`orderSignDigest: ${orderSignDigest}`)
  let makerWalletSignature
  if (!signingUrl) {
    const signerAddress = await signer.getAddress()
    makerWalletSignature =
      signerAddress.toLowerCase() == o.makerAddress.toLowerCase()
        ? await signByEOA(orderSignDigest, signer)
        : await signByMMPSigner(orderSignDigest, userAddr, feeFactor, signer)
  } else {
    makerWalletSignature = await forwardUnsignedOrder(signingUrl, {
      quoteId: order.quoteId,
      protocol: Protocol.PMMV5,
      pmmOrder: orderBNToString(o),
      feeFactor: feeFactor,
      orderHash: orderHash,
      orderSignDigest: orderSignDigest,
      userAddr: userAddr,
      chainId: chainId,
      pmmAddr: pmm,
    })
  }

  const signedOrder = {
    ...order,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}
