// sign order from custom quoter no need to put it in MMSK
import { assetDataUtils, generatePseudoRandomSalt } from '0x-v2-order-utils'
import * as cryptoRandomString from 'crypto-random-string'
import { orderBNToString } from '../utils'
import { NULL_ADDRESS } from '../constants'

export const buildSignedOrder = (order, makerAddress, wethAddress) => {
  const makerAssetAddress = order.makerAssetAddress.toLowerCase()
  const takerAssetAddress = order.takerAssetAddress.toLowerCase()
  // = Rewrite order fields
  // 1. change maker address to LP pool address
  order.makerAddress = makerAddress
  // 2. convert weth to eth
  if (makerAssetAddress === wethAddress.toLowerCase()) {
    order.makerAssetData = assetDataUtils.encodeERC20AssetData(NULL_ADDRESS)
  } else {
    order.makerAssetData = assetDataUtils.encodeERC20AssetData(makerAssetAddress)
  }

  if (takerAssetAddress === wethAddress.toLowerCase()) {
    order.takerAssetData = assetDataUtils.encodeERC20AssetData(NULL_ADDRESS)
  } else {
    order.takerAssetData = assetDataUtils.encodeERC20AssetData(takerAssetAddress)
  }
  // NOTE: for AMM order we don't do signing here
  const signedOrder = {
    ...order,
    salt: generatePseudoRandomSalt(),
    makerWalletSignature: cryptoRandomString({ length: 40 }),
  }
  return orderBNToString(signedOrder)
}
