import * as ethUtil from 'ethereumjs-util'
import { ECSignature } from '0x-v2-order-utils'
import { utils } from 'ethers'

type ECSignatureBuffer = {
  v: number
  r: Buffer
  s: Buffer
}

export const personalECSign = (privateKey: string, msg: string): ECSignatureBuffer => {
  const message = ethUtil.toBuffer(msg)
  const msgHash = ethUtil.hashPersonalMessage(message)
  return ethUtil.ecsign(msgHash, Buffer.from(privateKey, 'hex'))
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
