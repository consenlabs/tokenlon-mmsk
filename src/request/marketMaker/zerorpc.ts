import * as zerorpc from 'zerorpc'
import {
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
} from './types'
import { DealOrder, ExceptionOrder } from '../../types'

const promisify = (client, apiName, req?: object): Promise<any> => {
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

export class ZeroRPCQuoter implements Quoter {
  client: zerorpc.Client

  constructor(endpoint: string) {
    this.client = new zerorpc.Client()
    this.client.connect(endpoint)
  }

  async getPairs (): Promise<string[]>  {
    const res = await promisify(this.client, 'pairs')
    return res.pairs
  }

  async getIndicativePrice(data: IndicativePriceApiParams): Promise<IndicativePriceApiResult>  {
    return promisify(this.client, 'indicativePrice', data)
  }

  async getPrice(data: PriceApiParams): Promise<PriceApiResult>  {
    return promisify(this.client, 'price', data)
  }

  async dealOrder(data: DealOrder): Promise<NotifyOrderResult>  {
    return promisify(this.client, 'deal', data)
  }

  async exceptionOrder(data: ExceptionOrder): Promise<NotifyOrderResult>  {
    return promisify(this.client, 'exception', data)
  }
}
