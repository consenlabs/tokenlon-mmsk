import { priceCheckHelper } from './priceCheckHelper'
import { getIndicativePrice } from '../request/marketMaker'

export default async () => {
  const isIndicative = true
  return priceCheckHelper(getIndicativePrice, isIndicative)
}