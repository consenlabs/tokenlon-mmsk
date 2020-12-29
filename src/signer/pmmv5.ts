import {
  generatePseudoRandomSalt,
  orderHashUtils,
  SignatureType,
  signatureUtils,
} from '0x-v2-order-utils'
import { utils, Wallet } from 'ethers'
import { orderBNToString } from '../utils/format'
import { GetFormatedSignedOrderParams } from './types'
import { getOrderAndFeeFactor, signWithUserAndFee } from './pmmv4'
import { BigNumber } from '0x-v2-utils'

// changes of PMMV5
// - taker address point to PMM contract
// - fee factor from salt
// - user address from fee recipient

export const generateSaltWithFeeFactor = (feeFactor: number) => {
  const feeHex = utils.hexZeroPad('0x' + feeFactor.toString(16), 2)
  // append 001e = 30 (fee factor to salt)
  return new BigNumber(generatePseudoRandomSalt().toString(16).slice(0, -4) + feeHex.slice(2), 16)
}

async function signByEOA(orderHash: string, wallet: Wallet): Promise<string> {
  const hashArray = utils.arrayify(orderHash)
  let signature = await wallet.signMessage(hashArray)
  signature = signature.slice(2)
  const v = signature.slice(signature.length - 2, signature.length)
  const rs = signature.slice(0, signature.length - 2)
  signature = '0x' + v + rs
  return signatureUtils.convertToSignatureWithType(signature, SignatureType.EthSign)
}

function signByMMPSigner(
  orderHash: string,
  userAddr: string,
  feeFactor: number,
  wallet: Wallet
): string {
  const walletSign = signWithUserAndFee(wallet, orderHash, userAddr, feeFactor)
  return signatureUtils.convertToSignatureWithType(walletSign, SignatureType.Wallet)
}

// Move fee factor to salt field
export const buildSignedOrder = async (signer: Wallet, params: GetFormatedSignedOrderParams) => {
  const { userAddr, config } = params
  const { order, feeFactor } = getOrderAndFeeFactor(params)

  order.takerAddress = config.addressBookV5.PMM.toLowerCase()
  order.senderAddress = config.addressBookV5.PMM.toLowerCase()
  order.feeRecipientAddress = userAddr

  // inject fee factor to salt
  const o = {
    ...order,
    salt: generateSaltWithFeeFactor(feeFactor),
  }
  const orderHash = orderHashUtils.getOrderHashHex(o)
  const makerWalletSignature =
    signer.address.toLowerCase() == o.makerAddress.toLowerCase()
      ? await signByEOA(orderHash, signer)
      : signByMMPSigner(orderHash, userAddr, feeFactor, signer)

  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }

  return orderBNToString(signedOrder)
}
