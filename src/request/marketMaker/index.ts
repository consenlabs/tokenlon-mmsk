import { DealOrder, ExceptionOrder } from '../../types'
import {
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
} from './types'
import { HTTPQuoter } from './http'
import { removeQuoteIdPrefix } from '../../quoting'

export enum QuoterProtocol {
  HTTP,
}

class QuoteDispatcher implements Quoter {
  protocol: QuoterProtocol
  httpQuoter: HTTPQuoter

  constructor(endpoint: string, proto: QuoterProtocol = QuoterProtocol.HTTP) {
    this.protocol = proto
    switch (this.protocol) {
      case QuoterProtocol.HTTP:
        this.httpQuoter = new HTTPQuoter(endpoint)
        break
    }
  }

  async getPairs(): Promise<string[]> {
    return this.httpQuoter.getPairs()
  }

  async getIndicativePrice(data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> {
    return this.httpQuoter.getIndicativePrice(data)
  }

  async getPrice(data: PriceApiParams): Promise<PriceApiResult> {
    return this.httpQuoter.getPrice(data)
  }

  async dealOrder(params: DealOrder): Promise<NotifyOrderResult> {
    const { quoteId } = params
    const data = {
      ...params,
      quoteId: removeQuoteIdPrefix(quoteId),
    }
    return this.httpQuoter.dealOrder(data)
  }

  async exceptionOrder(params: ExceptionOrder): Promise<NotifyOrderResult> {
    const { quoteId } = params
    const data = {
      ...params,
      quoteId: removeQuoteIdPrefix(quoteId),
    }
    return this.httpQuoter.exceptionOrder(data)
  }
}

export {
  HTTPQuoter,
  QuoteDispatcher,
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
}
