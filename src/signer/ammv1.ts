// sign order from custom quoter no need to put it in MMSK
import { assetDataUtils, generatePseudoRandomSalt } from '0x-v2-order-utils'
import * as cryptoRandomString from 'crypto-random-string'
import { orderBNToString } from '../utils/format'
import { NULL_ADDRESS } from '../constants'

export const buildSignedOrder = (order, feeFactor, makerAddress, wethAddress) => {
  // = Rewrite order fields
  // 1. change maker address to LP pool address
  order.makerAddress = makerAddress
  // 2. convert weth to eth
  const makerTokenAddress = assetDataUtils.decodeERC20AssetData(order.makerAssetData).tokenAddress
  if (makerTokenAddress.toLowerCase() === wethAddress) {
    order.makerAssetData = assetDataUtils.encodeERC20AssetData(NULL_ADDRESS)
  }
  const takerTokenAddress = assetDataUtils.decodeERC20AssetData(order.takerAssetData).tokenAddress
  if (takerTokenAddress.toLowerCase() === wethAddress) {
    order.takerAssetData = assetDataUtils.encodeERC20AssetData(NULL_ADDRESS)
  }
  // NOTE: for AMM order we don't do signing here
  const signedOrder = {
    ...order,
    feeFactor,
    salt: generatePseudoRandomSalt(),
    makerWalletSignature: cryptoRandomString({ length: 40 }),
  }
  return orderBNToString(signedOrder)
}
