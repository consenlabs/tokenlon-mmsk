import { utils } from 'ethers'
import { RFQOrder, RFQV2Order } from './types'

const EIP712_DOMAIN_NAME = 'Tokenlon'
const EIP712_DOMAIN_VERSION = 'v5'

const RFQ_ORDER_SCHEMA = {
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

const RFQ_V2_ORDER_SCHEMA = {
  RFQOrder: [
    { name: 'offer', type: 'Offer' },
    { name: 'recipient', type: 'address' },
    { name: 'feeFactor', type: 'uint256' },
  ],
  Offer: [
    { name: 'taker', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'takerToken', type: 'address' },
    { name: 'takerTokenAmount', type: 'uint256' },
    { name: 'makerToken', type: 'address' },
    { name: 'makerTokenAmount', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
    { name: 'salt', type: 'uint256' },
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

export function getRFQV2OrderSignDigest(
  order: RFQV2Order,
  chainId: number,
  address: string
): string {
  const domain = {
    name: EIP712_DOMAIN_NAME,
    version: EIP712_DOMAIN_VERSION,
    chainId: chainId,
    verifyingContract: address,
  }

  return utils._TypedDataEncoder.hash(domain, RFQ_V2_ORDER_SCHEMA, order)
}

export function getOrderHash(order: RFQOrder): string {
  // The data to sign
  const value = {
    ...order,
    takerAssetAmount: order.takerAssetAmount.toString(),
    makerAssetAmount: order.makerAssetAmount.toString(),
    salt: order.salt.toString(),
  }

  return utils._TypedDataEncoder.hashStruct('Order', RFQ_ORDER_SCHEMA, value)
}

export function getRFQV2OrderHash(order: RFQV2Order): string {
  return utils._TypedDataEncoder.hashStruct('RFQOrder', RFQ_V2_ORDER_SCHEMA, order)
}
