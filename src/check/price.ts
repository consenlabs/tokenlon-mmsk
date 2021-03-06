import { priceCheckHelper } from './priceCheckHelper'
import { Quoter } from '../request/marketMaker'

export default async (quoter: Quoter) => {
  const isIndicative = false
  return priceCheckHelper((args) => quoter.getPrice(args), isIndicative)
}
