import { Quoter } from '../request/marketMaker'
import { WalletType } from '../signer/types'

export interface MarketMakerConfig {
  mmId: number
  networkId: number
  erc20ProxyContractAddress: string
  exchangeContractAddress: string
  forwarderContractAddress: string
  zrxContractAddress: string
  mmProxyContractAddress: string
  userProxyContractAddress: string
  tokenlonExchangeContractAddress: string
  wethContractAddress: string
  orderExpirationSeconds: number
  feeFactor: number
  addressBookV5?: AddressBook // Tokenlon v5 contracts
}

interface AddressBook {
  Tokenlon: string // Entry
  PermanentStorage: string // Contract Data
  PMM: string // pmm order
  RFQ: string // rfq order
  AMMWrapper: string // amm order
  UserProxy: string // user proxy
}

export interface Wallet {
  address: string
  privateKey: string
}

export interface ConfigForStart {
  EXCHANGE_URL: string
  PROVIDER_URL: string
  SIGNING_URL: string
  AMM_ONLY: string
  PERMIT_TYPE: string

  WALLET_ADDRESS: string
  WALLET_TYPE: WalletType
  USE_KEYSTORE?: boolean
  WALLET_PRIVATE_KEY?: string
  WALLET_KEYSTORE?: string
  MMSK_SERVER_PORT?: string | number

  CHAIN_ID?: number
  NODE_ENV?: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'
  SENTRY_DSN?: string

  HTTP_SERVER_ENDPOINT?: string
  EXTERNAL_QUOTER?: Quoter
}

export interface DealOrder {
  makerToken: string
  takerToken: string
  makerTokenAmount: number
  takerTokenAmount: number
  quoteId: string
  timestamp: number
}

export interface ExceptionOrder extends DealOrder {
  type: 'FAILED' | 'TIMEOUT' | 'DELAY'
}

export interface Token {
  symbol: string
  logo?: string
  contractAddress: string
  decimal: number
  precision: number
  minTradeAmount: number
  maxTradeAmount: number
}

export interface SupportedToken extends Token {
  opposites: Token[]
}

export interface TokenConfig {
  symbol: string
  feeFactor: number
}

export type SIDE = 'BUY' | 'SELL'

export interface QueryInterface {
  base: string
  quote: string
  baseAddress?: string
  quoteAddress?: string
  side: 'BUY' | 'SELL'
  amount?: number
  feefactor?: number
  uniqId?: number | string
  userAddr?: string
  protocol?: Protocol
  salt?: string
}

export enum Protocol {
  AMMV1 = 'AMMV1',
  AMMV2 = 'AMMV2',
  PMMV5 = 'PMMV5',
  RFQV1 = 'RFQV1',
  RFQV2 = 'RFQV2',
}
