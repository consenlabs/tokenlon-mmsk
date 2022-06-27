import {
  eip712Utils,
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
  EIP712Types,
} from '0x-v2-order-utils'
import * as ethUtils from 'ethereumjs-util'
import { utils, Wallet } from 'ethers'
import { BigNumber, orderBNToString } from '../utils'

const EIP712_ORDER_SCHEMA = {
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

export const generateSaltWithFeeFactor = (feeFactor: number) => {
  const feeHex = utils.hexZeroPad('0x' + feeFactor.toString(16), 2)
  // append 001e = 30 (fee factor to salt)
  return new BigNumber(generatePseudoRandomSalt().toString(16).slice(0, -4) + feeHex.slice(2), 16)
}

// Signature:
// +------|---------|---------|---------|---------+
// |  V   |    R    |    S    |userAddr |feeFactor|
// +------|---------|---------|---------|---------+
export async function signWithUserAndFee(
  signer: Wallet,
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
async function signByEOA(orderSignDigest: string, wallet: Wallet): Promise<string> {
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
async function signByMMPSigner(
  orderSignDigest: string,
  userAddr: string,
  feeFactor: number,
  wallet: Wallet
): Promise<string> {
  const walletSign = await signWithUserAndFee(wallet, orderSignDigest, userAddr, feeFactor)
  return signatureUtils.convertToSignatureWithType(walletSign, SignatureType.Wallet)
}

// Move fee factor to salt field
export const buildSignedOrder = async (signer: Wallet, order, userAddr, pmm): Promise<any> => {
  const feeFactor = order.feeFactor
  order.takerAddress = pmm.toLowerCase()
  order.senderAddress = pmm.toLowerCase()
  order.feeRecipientAddress = userAddr

  // inject fee factor to salt
  const o = {
    ...order,
    salt: generateSaltWithFeeFactor(feeFactor),
  }
  const orderHashBuffer = eip712Utils.structHash(EIP712_ORDER_SCHEMA, o)
  const orderHash = '0x' + orderHashBuffer.toString('hex')
  console.log(`orderHash: ${orderHash}`)
  const orderSignDigest = orderHashUtils.getOrderHashHex(o)
  console.log(`orderSignDigest: ${orderSignDigest}`)
  const makerWalletSignature =
    signer.address.toLowerCase() == o.makerAddress.toLowerCase()
      ? await signByEOA(orderSignDigest, signer)
      : await signByMMPSigner(orderSignDigest, userAddr, feeFactor, signer)

  const signedOrder = {
    ...o,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}
