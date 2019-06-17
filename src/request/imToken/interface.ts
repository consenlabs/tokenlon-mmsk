type OrderStatus = 'success' | 'failed' | 'timeout' | 'pending' | 'invalid' | 'unbroadcast'

export interface OrderForMM {
  makerToken: string
  takerToken: string
  makerTokenAmount: number
  takerTokenAmount: number
  quoteId: string
  status: OrderStatus
  txHash: string
  blockNumber: number
  timestamp: number
  blockTimestamp: number
}

export interface GetOrdersHistoryForMMParams {
  signerAddr: string
  page: number
  perpage: number
}