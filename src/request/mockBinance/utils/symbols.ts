import binance from './binance'

let symbolsInCache = null

export const getSymbols = async () => {
  if (!symbolsInCache) {
    const res = await binance.exchangeInfo()
    symbolsInCache = res.symbols.filter(item => item.status === 'TRADING')
  }

  return symbolsInCache
}

export const isSameSideSymbol = (symbol, { base, quote }) => {
  return base === symbol.baseAsset && symbol.quoteAsset === quote
}

export const isOppositeSideSymbol = (symbol, { base, quote }) => {
  return quote === symbol.baseAsset && symbol.quoteAsset === base
}

export const isSupportedSymbolWithSameSide = async ({ base, quote }) => {
  let symbols = symbolsInCache
  if (!symbols) {
    symbols = await getSymbols()
  }
  return symbols.some(symbol => {
    return isSameSideSymbol(symbol, { base, quote })
  })
}

export const isSupportedSymbolWithOppositeSide = async ({ base, quote }) => {
  let symbols = symbolsInCache
  if (!symbols) {
    symbols = await getSymbols()
  }
  return symbols.some(symbol => {
    return isOppositeSideSymbol(symbol, { base, quote })
  })
}