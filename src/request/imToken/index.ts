import { Token, MarketMakerConfig, TokenConfig } from '../../types'
import { config } from '../../config'
import { jsonrpc } from '../_request'
import { OrderForMM, GetOrdersHistoryForMMParams } from './interface'

export const getMarketMakerConfig = async (signerAddr): Promise<MarketMakerConfig> => {
  return jsonrpc.get(
    config.EXCHANGE_URL,
    {},
    'tokenlon.getMarketMakerConfig',
    {
      signerAddr,
    },
  )
}

export const getTokenList = async (): Promise<Token[]> => {
  return jsonrpc.get(
    config.EXCHANGE_URL,
    {},
    'tokenlon.getTokenList',
    {},
  )
}

export const getTokenConfigsForMM = async (signerAddr: string): Promise<TokenConfig[]> => {
  return jsonrpc.get(
    config.EXCHANGE_URL,
    {},
    'tokenlon.getTokenConfigsForMM',
    {
      signerAddr,
    },
  )
}

export const getOrdersHistoryForMM = async (params: GetOrdersHistoryForMMParams): Promise<OrderForMM[]> => {
  return jsonrpc.get(
    config.EXCHANGE_URL,
    {},
    'tokenlon.getOrdersHistoryForMM',
    params,
  )
}

export const getOrderStateForMM = async (quoteId: string): Promise<OrderForMM> => {
  return jsonrpc.get(
    config.EXCHANGE_URL,
    {},
    'tokenlon.getOrderStateForMM',
    {
      quoteId,
    },
  )
}