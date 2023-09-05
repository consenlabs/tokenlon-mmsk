import { Protocol } from '../types'

import { signByMMPSigner as signRFQV1ByMMPSigner, signRFQOrder } from '../signer/rfqv1'
import { signByMMPSigner as signRFQV2ByMMPSigner, signOffer } from '../signer/rfqv2'
import { signByEOA as signPMMV5ByEOA, signByMMPSigner } from '../signer/pmmv5'
import { BigNumber } from '../utils'
import { getWallet } from '../config'
import { SignatureType, WalletType } from '../signer/types'
import { updaterStack } from '../worker'

export interface Order {
  // quoteId is from market maker backend quoter.
  quoteId: string | number
  // protocol represents the order type as enum, [PMMV4, PMMV5, AMMV1, RFQV1, AMMV2].
  protocol: Protocol

  // Common fields
  makerAddress: string
  makerAssetAmount: string | BigNumber
  makerAssetAddress: string
  takerAddress: string
  takerAssetAmount: string | BigNumber
  takerAssetAddress: string
  expirationTimeSeconds: BigNumber | string
  // feeFactor is tokenlon protocol field, works like BPS, should <= 10000.
  feeFactor: number
  // salt represents the uniqueness of order, is to prevent replay attack.
  salt?: BigNumber | string

  // 0x protocol specific fields
  makerAssetData: string
  takerAssetData: string
  senderAddress: string
  // For PMMV5, we use this field as receiver address (user address).
  feeRecipientAddress: string
  exchangeAddress: string

  // makerFee and takerFee are not used, but keep to make 0x order signature.
  makerFee: BigNumber | string
  takerFee: BigNumber | string

  // PMM/RFQ market maker signature
  makerWalletSignature?: string

  // Extra data
  payload?: string
}

export const signOrder = async (ctx) => {
  const { chainID, walletType } = ctx
  const order = ctx.request.body
  const protocol = ctx.request.body.protocol
  const signer = getWallet()
  console.log('signer')
  console.log(signer)
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  let signature
  try {
    switch (protocol) {
      case Protocol.PMMV5:
        signature =
          signer.address.toLowerCase() == order.pmmOrder.makerAddress.toLowerCase()
            ? await signPMMV5ByEOA(order.orderSignDigest, signer)
            : await signByMMPSigner(order.orderSignDigest, order.userAddr, order.feeFactor, signer)
        break
      case Protocol.RFQV1:
        if (signer.address.toLowerCase() == order.rfqOrder.makerAddr.toLowerCase()) {
          signature = await signRFQOrder(
            chainID,
            config.addressBookV5.RFQ,
            order.rfqOrder,
            signer,
            order.feeFactor,
            SignatureType.EIP712
          )
        } else if (walletType === WalletType.MMP_VERSION_4) {
          signature = await signRFQV1ByMMPSigner(
            order.orderSignDigest,
            order.userAddr,
            order.feeFactor,
            signer,
            WalletType.MMP_VERSION_4
          )
        } else if (walletType === WalletType.ERC1271_EIP712) {
          signature = await signRFQOrder(
            chainID,
            config.addressBookV5.RFQ,
            order.rfqOrder,
            signer,
            order.feeFactor,
            SignatureType.WalletBytes32
          )
        }
        break
      case Protocol.RFQV2:
        if (signer.address.toLowerCase() == order.rfqOrder.maker.toLowerCase()) {
          signature = await signOffer(
            chainID,
            config.addressBookV5.RFQV2,
            order.rfqOrder,
            signer,
            SignatureType.EIP712
          )
        } else if (walletType === WalletType.MMP_VERSION_4) {
          signature = await signRFQV2ByMMPSigner(
            order.orderSignDigest,
            order.userAddr,
            order.feeFactor,
            signer,
            WalletType.MMP_VERSION_4
          )
        } else if (walletType === WalletType.ERC1271_EIP712) {
          signature = await signOffer(
            chainID,
            config.addressBookV5.RFQV2,
            order.rfqOrder,
            signer,
            SignatureType.WalletBytes32
          )
        }
        break
      default:
        console.log(`unknown protocol ${protocol}`)
        throw new Error('Unrecognized protocol: ' + protocol)
    }
    ctx.body = {
      result: true,
      signature: signature,
    }
    return
  } catch (e) {
    console.error(e.stack)
    ctx.body = {
      result: false,
      message: e.message,
    }
    return e.message
  }
}
