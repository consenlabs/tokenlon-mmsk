import { BigNumber } from '../utils'
import { MarketMakerConfig, Token, TokenConfig } from '../types'

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
  takerAssetAmount: BigNumber
  makerAssetAmount: BigNumber
  salt: BigNumber
  deadline: number
  feeFactor: number
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
