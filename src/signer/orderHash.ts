import { utils } from 'ethers'
import { RFQOrder } from './types'

const EIP712_DOMAIN_NAME = 'Tokenlon'
const EIP712_DOMAIN_VERSION = 'v5'

var RFQ_ORDER_SCHEMA = {
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

export function getOrderSignDigest(order: RFQOrder, chainId: number, address: string): string {
  const domain = {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId,
    verifyingContract: address,
  }
  // The data to sign
  const value = {
    ...order,
    takerAssetAmount: order.takerAssetAmount.toString(),
    makerAssetAmount: order.makerAssetAmount.toString(),
    salt: order.salt.toString(),
  }

  return utils._TypedDataEncoder.hash(domain, RFQ_ORDER_SCHEMA, value)
}
