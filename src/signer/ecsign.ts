import * as ethUtil from 'ethereumjs-util'
import { ECSignature, signatureUtils, SignerType } from '0x-v2-order-utils'
import { utils } from 'ethers'

type ECSignatureBuffer = {
  v: number
  r: Buffer
  s: Buffer;
}

export const personalECSign = (privateKey: string, msg: string): ECSignatureBuffer => {
  const message = ethUtil.toBuffer(msg)
  const msgHash = ethUtil.hashPersonalMessage(message)
  return ethUtil.ecsign(msgHash, new Buffer(privateKey, 'hex'))
}

export const personalSign = (privateKey: string, msg: string): string => {
  const sig = personalECSign(privateKey, msg)
  return utils.joinSignature({
    v: sig.v,
    r: ethUtil.bufferToHex(sig.r),
    s: ethUtil.bufferToHex(sig.s),
  })
}

// cp from https://github.com/0xProject/0x.js/blob/4d61d56639ad70b13245ca25047c6f299e746393/packages/0x.js/src/utils/signature_utils.ts
export const parseSignatureHexAsVRS = (signatureHex: string): ECSignature => {
  const signatureBuffer = ethUtil.toBuffer(signatureHex)
  let v = signatureBuffer[0]
  if (v < 27) {
    v += 27
  }
  const r = signatureBuffer.slice(1, 33)
  const s = signatureBuffer.slice(33, 65)
  const ecSignature: ECSignature = {
    v,
    r: ethUtil.bufferToHex(r),
    s: ethUtil.bufferToHex(s),
  }
  return ecSignature
}

// cp from https://github.com/0xProject/0x.js/blob/4d61d56639ad70b13245ca25047c6f299e746393/packages/0x.js/src/utils/signature_utils.ts
export const parseSignatureHexAsRSV = (signatureHex: string): ECSignature => {
  const { v, r, s } = ethUtil.fromRpcSig(signatureHex)
  const ecSignature: ECSignature = {
    v,
    r: ethUtil.bufferToHex(r),
    s: ethUtil.bufferToHex(s),
  }
  return ecSignature
}

/**
 * @description use personalSign to replace eth_sign
 * params are same with signatureUtls.ecSignOrderHashAsync
 * only replaced provider by privateKey
 * https://github.com/0xProject/0x-monorepo/blob/30525d15f468dc084f923b280b265cb8d5fd4975/packages/order-utils/src/signature_utils.ts#L222
 * https://github.com/0xProject/0x-monorepo/blob/30525d15f468dc084f923b280b265cb8d5fd4975/packages/web3-wrapper/src/web3_wrapper.ts#L308
 * https://github.com/ethereumjs/ethereumjs-util/blob/90558346d41a03dc71cbde35a7df009aaabe5ee0/index.js#L362
 * https://github.com/ethereum/go-ethereum/blob/f951e23fb5ad2f7017f314a95287bc0506a67d05/internal/ethapi/api.go#L1259
 * https://github.com/ethereum/go-ethereum/blob/f951e23fb5ad2f7017f314a95287bc0506a67d05/internal/ethapi/api.go#L419
 * @author Xaber
 * @param signerPrivateKey signer privateKey
 * @param orderHash
 * @param signerAddress
 * @param signerType
 */
export const ecSignOrderHash = (
  signerPrivateKey,
  orderHash: string,
  signerAddress: string,
  signerType: SignerType,
) => {
  let msgHashHex = orderHash
  const normalizedSignerAddress = signerAddress.toLowerCase()
  const prefixedMsgHashHex = signatureUtils.addSignedMessagePrefix(orderHash, signerType)

  // Metamask incorrectly implements eth_sign and does not prefix the message as per the spec
  // Source: https://github.com/MetaMask/metamask-extension/commit/a9d36860bec424dcee8db043d3e7da6a5ff5672e
  if (signerType === SignerType.Metamask) {
    msgHashHex = prefixedMsgHashHex
  }

  const signature = personalSign(signerPrivateKey, msgHashHex)

  // HACK: There is no consensus on whether the signatureHex string should be formatted as
  // v + r + s OR r + s + v, and different clients (even different versions of the same client)
  // return the signature params in different orders. In order to support all client implementations,
  // we parse the signature in both ways, and evaluate if either one is a valid signature.
  // r + s + v is the most prevalent format from eth_sign, so we attempt this first.
  // tslint:disable-next-line:custom-no-magic-numbers
  const validVParamValues = [27, 28]
  const ecSignatureRSV = parseSignatureHexAsRSV(signature)
  if (validVParamValues.includes(ecSignatureRSV.v)) {
    const isValidRSVSignature = signatureUtils.isValidECSignature(
      prefixedMsgHashHex,
      ecSignatureRSV,
      normalizedSignerAddress,
    )
    if (isValidRSVSignature) {
      const convertedSignatureHex = signatureUtils.convertECSignatureToSignatureHex(
        ecSignatureRSV,
        signerType,
      )
      return convertedSignatureHex
    }
  }
  const ecSignatureVRS = parseSignatureHexAsVRS(signature)
  if (validVParamValues.includes(ecSignatureVRS.v)) {
    const isValidVRSSignature = signatureUtils.isValidECSignature(
      prefixedMsgHashHex,
      ecSignatureVRS,
      normalizedSignerAddress,
    )
    if (isValidVRSSignature) {
      const convertedSignatureHex = signatureUtils.convertECSignatureToSignatureHex(
        ecSignatureVRS,
        signerType,
      )
      return convertedSignatureHex
    }
  }

  throw new Error('InvalidSignature')
}
