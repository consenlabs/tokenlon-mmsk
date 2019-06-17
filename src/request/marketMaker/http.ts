import { IndicativePriceApiParams, IndicativePriceApiResult, PriceApiParams, PriceApiResult, DealApiParams, DealApiResult } from './interface'
import { sendRequest } from '../_request'
import { config } from '../../config'

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

export const dealOrder = async (data: DealApiParams): Promise<DealApiResult> => {
  return sendRequest({
    method: 'post',
    url: `${config.HTTP_SERVER_ENDPOINT}/deal`,
    data,
    header: {
      'Content-Type': 'application/json',
    },
  })
}