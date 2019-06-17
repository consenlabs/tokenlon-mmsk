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
}

export interface Wallet {
  address: string
  privateKey: string
}

export interface ConfigForStart {
  EXCHANGE_URL: string
  WEBSOCKET_URL: string
  PROVIDER_URL: string

  WALLET_ADDRESS: string
  USE_KEYSTORE?: boolean
  WALLET_PRIVATE_KEY?: string
  WALLET_KEYSTORE?: object
  MMSK_SERVER_PORT?: string | number

  NODE_ENV?: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'
  SENTRY_DSN?: string

  USE_ZERORPC?: boolean
  HTTP_SERVER_ENDPOINT?: string
  ZERORPC_SERVER_ENDPOINT?: string
}

export interface DealOrder {
  makerToken: string
  takerToken: string
  makerTokenAmount: string
  takerTokenAmount: string
  quoteId: string
  timestamp: number
}

export interface Token {
  symbol: string
  logo: string
  contractAddress: string
  decimal: number
  precision: number
  minTradeAmount: number
  maxTradeAmount: number
}

export interface SupportedToken extends Token {
  opposites: string[]
}

export interface TokenConfig {
  symbol: string
  feeFactor: number
}

export type SIDE = 'BUY' | 'SELL'