import * as zerorpc from 'zerorpc'
import { IndicativePriceApiParams, IndicativePriceApiResult, PriceApiParams, PriceApiResult, NotifyOrderResult } from './interface'
import { DealOrder, ExceptionOrder } from '../../types'

const client = new zerorpc.Client()

export const connectClient = (endpoint) => {
  client.connect(endpoint)
}

const promisify = (apiName, req?: object): Promise<any> => {
  return new Promise((resolve, reject) => {
    client.invoke(apiName, req, (err, res) => {
      if (err) {
        reject(err)
      } else {
        resolve(res)
      }
    })
  })
}

export const getPairs = async (): Promise<string[]> => {
  const res = await promisify('pairs')
  return res.pairs
}

export const getIndicativePrice = async (data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> => {
  return promisify('indicativePrice', data)
}

export const getPrice = async (data: PriceApiParams): Promise<PriceApiResult> => {
  return promisify('price', data)
}

export const dealOrder = async (data: DealOrder): Promise<NotifyOrderResult> => {
  return promisify('deal', data)
}

export const exceptionOrder = async (data: ExceptionOrder): Promise<NotifyOrderResult> => {
  return promisify('exception', data)
}