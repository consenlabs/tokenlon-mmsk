import { getPriceObj } from './utils/price'
import { generateQuoteId } from './utils/quoteId'

export default async (query) => {
  const { amount } = query
  const priceObj = await getPriceObj(query)
  return priceObj.price ? {
    result: true,
    exchangeable: true,
    maxAmount: 100,
    minAmount: 0.0002,
    price: priceObj.price,
    quoteId: amount && +amount ? generateQuoteId() : '',
  } : {
    result: false,
    exchangeable: false,
    maxAmount: 100,
    minAmount: 0.0002,
    price: 0,
    message: priceObj.message,
    quoteId: amount && +amount ? generateQuoteId() : '',
  }
}