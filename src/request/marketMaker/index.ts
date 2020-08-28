import { DealOrder, ExceptionOrder } from '../../types'
import {
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
} from './types'
import { ZeroRPCQuoter } from './zerorpc'
import { HTTPQuoter } from './http'
import { removeQuoteIdPrefix } from '../../utils/quoteId'

export enum QuoterProtocol {
  HTTP,
  ZERORPC,
}

class QuoteDispatcher implements Quoter {
  protocol: QuoterProtocol
  httpQuoter: HTTPQuoter
  zeroRPCQuoter: ZeroRPCQuoter

  constructor(endpoint: string, proto: QuoterProtocol = QuoterProtocol.HTTP) {
    this.protocol = proto
    switch (this.protocol) {
      case QuoterProtocol.HTTP:
        this.httpQuoter = new HTTPQuoter(endpoint)
        break
      case QuoterProtocol.ZERORPC:
        this.zeroRPCQuoter = new ZeroRPCQuoter(endpoint)
        break
    }
  }

  async getPairs(): Promise<string[]> {
    return this.protocol == QuoterProtocol.ZERORPC
      ? this.zeroRPCQuoter.getPairs()
      : this.httpQuoter.getPairs()
  }

  async getIndicativePrice(data: IndicativePriceApiParams): Promise<IndicativePriceApiResult> {
    return this.protocol == QuoterProtocol.ZERORPC
      ? this.zeroRPCQuoter.getIndicativePrice(data)
      : this.httpQuoter.getIndicativePrice(data)
  }

  async getPrice(data: PriceApiParams): Promise<PriceApiResult> {
    return this.protocol == QuoterProtocol.ZERORPC
      ? this.zeroRPCQuoter.getPrice(data)
      : this.httpQuoter.getPrice(data)
  }

  async dealOrder(params: DealOrder): Promise<NotifyOrderResult> {
    const { quoteId } = params
    const data = {
      ...params,
      quoteId: removeQuoteIdPrefix(quoteId),
    }
    return this.protocol == QuoterProtocol.ZERORPC
      ? this.zeroRPCQuoter.dealOrder(data)
      : this.httpQuoter.dealOrder(data)
  }

  async exceptionOrder(params: ExceptionOrder): Promise<NotifyOrderResult> {
    const { quoteId } = params
    const data = {
      ...params,
      quoteId: removeQuoteIdPrefix(quoteId),
    }
    return this.protocol == QuoterProtocol.ZERORPC
      ? this.zeroRPCQuoter.exceptionOrder(data)
      : this.httpQuoter.exceptionOrder(data)
  }
}

export {
  ZeroRPCQuoter,
  HTTPQuoter,
  QuoteDispatcher,
  IndicativePriceApiParams,
  IndicativePriceApiResult,
  PriceApiParams,
  PriceApiResult,
  NotifyOrderResult,
  Quoter,
}
