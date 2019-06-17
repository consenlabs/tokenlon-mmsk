import { getSymbols } from './utils/symbols'

export default async () => {
  const symbols = await getSymbols()
  const result = []
  symbols.forEach(symbol => {
    result.push(`${symbol.baseAsset}/${symbol.quoteAsset}`)
  })
  return result
}