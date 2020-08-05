import {
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
} from './types'
import { sendRequest } from '../_request'
import { DealOrder, ExceptionOrder } from '../../types'

export class HTTPQuoter implements Quoter {
  endpoint: string

  constructor(endpoint: string) {
    this.endpoint = endpoint
  }

  async getPairs(): Promise<string[]> {
    return sendRequest({
      method: 'get',
      url: `${this.endpoint}/pairs`,
    }).then((res: any) => {
      return res.pairs
    })
  }

  async getIndicativePrice(data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> {
    return sendRequest({
      method: 'get',
      url: `${this.endpoint}/indicativePrice`,
      params: data,
    })
  }

  async getPrice(data: PriceApiParams): Promise<PriceApiResult> {
    return sendRequest({
      method: 'get',
      url: `${this.endpoint}/price`,
      params: data,
    })
  }

  async dealOrder(data: DealOrder): Promise<NotifyOrderResult> {
    return sendRequest({
      method: 'post',
      url: `${this.endpoint}/deal`,
      data,
      header: {
        'Content-Type': 'application/json',
      },
    })
  }

  async exceptionOrder(data: ExceptionOrder): Promise<NotifyOrderResult> {
    return sendRequest({
      method: 'post',
      url: `${this.endpoint}/exception`,
      data,
      header: {
        'Content-Type': 'application/json',
      },
    })
  }
}
