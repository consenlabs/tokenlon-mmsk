import { IndicativePriceApiParams, IndicativePriceApiResult, PriceApiParams, PriceApiResult, DealApiResult } from './interface'
import { sendRequest } from '../_request'
import { config } from '../../config'
import { DealOrder } from '../../types'

export const getPairs = async (): Promise<string[]> => {
  return sendRequest({
    method: 'get',
    url: `${config.HTTP_SERVER_ENDPOINT}/pairs`,
  }).then((res: any) => {
    return res.pairs
  })
}

export const getIndicativePrice = async (data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> => {
  return sendRequest({
    method: 'get',
    url: `${config.HTTP_SERVER_ENDPOINT}/indicativePrice`,
    params: data,
  })
}

export const getPrice = async (data: PriceApiParams): Promise<PriceApiResult> => {
  return sendRequest({
    method: 'get',
    url: `${config.HTTP_SERVER_ENDPOINT}/price`,
    params: data,
  })
}

export const dealOrder = async (data: DealOrder): Promise<DealApiResult> => {
  return sendRequest({
    method: 'post',
    url: `${config.HTTP_SERVER_ENDPOINT}/deal`,
    data,
    header: {
      'Content-Type': 'application/json',
    },
  })
}