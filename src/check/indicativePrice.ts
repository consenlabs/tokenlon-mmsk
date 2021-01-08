import { priceCheckHelper } from './priceCheckHelper'
import { Quoter } from '../request/marketMaker'

export default async (quoter: Quoter) => {
  const isIndicative = true
  return priceCheckHelper((args) => quoter.getIndicativePrice(args), isIndicative)
}
