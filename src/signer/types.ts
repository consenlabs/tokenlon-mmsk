import { BigNumber } from '../utils'
import { MarketMakerConfig, Protocol, Token, TokenConfig } from '../types'
import { Order as ZXOrder } from '0x-v2-order-utils'

export interface SimpleOrder {
  side: string
  base: string
  quote: string
  amount?: number
}

export interface GetOrderAndFeeFactorParams {
  simpleOrder: SimpleOrder
  rate: number | string
  tokenList: Token[]
  tokenConfigs: TokenConfig[]
  config: MarketMakerConfig
  queryFeeFactor?: number
}

export interface GetFormatedSignedOrderParams extends GetOrderAndFeeFactorParams {
  userAddr: string
}

export interface RFQOrder {
  takerAddr: string
  makerAddr: string
  takerAssetAddr: string
  makerAssetAddr: string
  takerAssetAmount: BigNumber | string
  makerAssetAmount: BigNumber | string
  salt: BigNumber | string
  deadline: number
  feeFactor: number
}

export interface Offer {
  taker: string
  maker: string
  takerToken: string
  takerTokenAmount: BigNumber | string
  makerToken: string
  makerTokenAmount: BigNumber | string
  feeFactor: number
  expiry: number
  salt: BigNumber | string
}

export interface ExtendedZXOrder {
  senderAddress: string
  makerAddress: string
  makerAssetAddress: string
  takerAddress: string
  takerAssetAddress: string
  makerFee: BigNumber | string
  takerFee: BigNumber | string
  makerAssetAmount: BigNumber | string
  takerAssetAmount: BigNumber | string
  makerAssetData: string
  takerAssetData: string
  salt?: string | BigNumber | string
  exchangeAddress: string
  feeRecipientAddress: string
  expirationTimeSeconds: BigNumber | string
  feeFactor: number
  quoteId: number | string
  protocol: Protocol
  makerWalletSignature?: string
  payload?: string
}

export interface RemoteSigningPMMV5Request {
  quoteId: number | string
  protocol: Protocol
  pmmOrder: ZXOrder
  feeFactor: number
  orderHash: string
  orderSignDigest: string
  userAddr: string
  chainId: number
  pmmAddr: string
}

export interface RemoteSigningRFQV1Request {
  quoteId: number | string
  protocol: Protocol
  rfqOrder: RFQOrder
  feeFactor: number
  orderHash: string
  orderSignDigest: string
  userAddr: string
  chainId: number
  rfqAddr: string
}

export interface RemoteSigningRFQV2Request {
  quoteId: number | string
  protocol: Protocol
  rfqOrder: Offer
  feeFactor: number
  orderHash: string
  orderSignDigest: string
  userAddr: string
  chainId: number
  rfqAddr: string
}

export enum SignatureType {
  Illegal = 0, // 0x00, default value
  Invalid = 1, // 0x01
  EIP712 = 2, // 0x02
  EthSign = 3, // 0x03
  WalletBytes = 4, // 0x04  standard 1271 wallet type
  WalletBytes32 = 5, // 0x05  standard 1271 wallet type
  Wallet = 6, // 0x06  0x wallet type for signature compatibility
  NSignatureTypes = 7, // 0x07, number of signature types. Always leave at end.
}

export enum WalletType {
  MMP_VERSION_4 = 1, // https://gist.github.com/NIC619/a3db1a743175bf592f2db983f17680dd#file-mmpv4-sol-L1236
  MMP_VERSION_5 = 2, // DEPRECATED
  ERC1271_EIP712_EIP191 = 3, // https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v4.6.0/contracts/utils/cryptography/SignatureChecker.sol#L36
  EOA = 4, // less security for market makers
  ERC1271_EIP712 = 5,
}

export enum PermitType {
  ALLOWANCE_TARGET = '0x00',
  APPROVE_RFQV2 = '0x01',
}
