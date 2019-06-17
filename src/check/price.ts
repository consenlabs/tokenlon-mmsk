import { priceCheckHelper } from './priceCheckHelper'
import { getPrice } from '../request/marketMaker'

export default async () => {
  const isIndicative = false
  return priceCheckHelper(getPrice, isIndicative)
}