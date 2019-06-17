import binance from './binance'
import { isSameSideSymbol, isOppositeSideSymbol, isSupportedSymbolWithOppositeSide, isSupportedSymbolWithSameSide, getSymbols } from './symbols'

const getBaseQuoteSymbol = (symbols, { base, quote }) => {
  return symbols.find(symbol => {
    return isSameSideSymbol(symbol, { base, quote }) || isOppositeSideSymbol(symbol, { base, quote })
  })
}

const translateSymbolToPair = symbol => {
  return {
    base: symbol.baseAsset,
    quote: symbol.quoteAsset,
  }
}

const getSameSideObj = async ({ base, quote, amount, side }) => {
  let sortedOrderbook = null
  if (side === 'BUY') {
    // binance 已做过排序
    const res = await binance.book({
      symbol: `${base}${quote}`,
      limit: 100,
    })
    sortedOrderbook = res.asks
  } else {
    // binance 已做过排序
    const res = await binance.book({
      symbol: `${base}${quote}`,
      limit: 100,
    })
    sortedOrderbook = res.bids
  }

  // 没有数量的情况，返回最好的价格
  if (!amount || !(+amount)) {
    return {
      price: sortedOrderbook[0].price,
      baseAmount: 0,
      quoteAmount: 0,
    }
  }

  let restBaseAmount = amount
  let totalQuoteAmount = 0

  sortedOrderbook.some((orderItem) => {
    const { price, quantity } = orderItem
    const baseAmount = +quantity
    const quoteAmount = price * quantity
    if (baseAmount <= restBaseAmount) {
      totalQuoteAmount += quoteAmount
      restBaseAmount -= baseAmount
    } else {
      totalQuoteAmount += (price * restBaseAmount)
      restBaseAmount = 0
      return true
    }
  })

  // 数量过大 未满足
  if (restBaseAmount) {
    return {
      price: 0,
      baseAmount: 0,
      quoteAmount: 0,
    }
  }

  // 总花销 / 总获得数量， 即为平均价格
  return {
    price: totalQuoteAmount / amount,
    baseAmount: amount,
    quoteAmount: totalQuoteAmount,
  }
}

/**
 * base: DAI, quote: ETH, side: sell （价格最好的在前面）
 * amount is quote amount
 * 实际： ETH-DAI, side: buy
 */
const getOppositeSideObj = async ({ base, quote, amount, side }) => {
  let sortedOrderbook = null
  if (side === 'BUY') {

    const res = await binance.book({
      symbol: `${quote}${base}`,
      limit: 100,
    })
    sortedOrderbook = res.bids
  } else {
    const res = await binance.book({
      symbol: `${quote}${base}`,
      limit: 100,
    })
    sortedOrderbook = res.asks
  }

  // 没有数量的情况，返回最好的价格
  if (!amount || !(+amount)) {
    return {
      price: 1 / sortedOrderbook[0].price,
      baseAmount: 0,
      quoteAmount: 0,
    }
  }

  // now amount is totalQuoteAmount
  let restObQuoteAmount = amount
  let totalObBaseAmount = 0

  sortedOrderbook.some((orderItem) => {
    const { price, quantity } = orderItem
    const obBaseAmount = +quantity
    const obQuoteAmount = price * quantity
    if (obQuoteAmount <= restObQuoteAmount) {
      restObQuoteAmount -= obQuoteAmount
      totalObBaseAmount += obBaseAmount
    } else {
      totalObBaseAmount += (restObQuoteAmount / price)
      restObQuoteAmount = 0
      return true
    }
  })

  // 数量过大 未满足
  if (restObQuoteAmount) {
    return {
      price: 0,
      baseAmount: 0,
      quoteAmount: 0,
    }
  }

  // 总花销 / 总获得数量， 即为平均价格
  // 注意，这里的 base/quote 需要反向
  return {
    price: totalObBaseAmount / amount,
    baseAmount: amount,
    quoteAmount: totalObBaseAmount,
  }
}

// 寻找路径
const getTradeCombinations = (symbols, { base, quote, side }) => {
  const symbolArrs = []

   symbols.forEach(symbol1 => {
    if (symbol1.baseAsset === base || symbol1.quoteAsset === base) {
      const opposite = symbol1.baseAsset === base ? symbol1.quoteAsset : symbol1.baseAsset
      const symbol2 = getBaseQuoteSymbol(symbols, {
        base: quote,
        quote: opposite,
      })
      if (symbol2) {
        symbolArrs.push([symbol1, symbol2])
      }
    }
  })

   return symbolArrs.map(([symbol1, symbol2]) => {
    const p1 = translateSymbolToPair(symbol1) as any
    const p2 = translateSymbolToPair(symbol2) as any
    if (side === 'BUY') {
      p1.side = p1.base === base || p1.quote === quote ? 'BUY' : 'SELL'
      p2.side = p2.base === base || p2.quote === quote ? 'BUY' : 'SELL'

     // SELL
    } else {
      p1.side = p1.base === base || p1.quote === quote ? 'SELL' : 'BUY'
      p2.side = p2.base === base || p2.quote === quote ? 'SELL' : 'BUY'
    }
    return [p1, p2]
  })
}

const getCombinationsPriceObjsWithoutAmount = (combinations, { base, quote }) => {
  return Promise.all(
    combinations.map(([baseQuery, quoteQuery]) => {
      return Promise.all([getSameSideObj(baseQuery), getSameSideObj(quoteQuery)])
        .then(([priceObj1, priceObj2]) => {
          let basePrice = null
          let quotePrice = null

          if (baseQuery.base === base) {
            basePrice = priceObj1.price
          } else if (baseQuery.quote === base) {
            basePrice = 1 / priceObj1.price
          }

          if (quoteQuery.base === quote) {
            quotePrice = priceObj2.price
          } else if (quoteQuery.quote === quote) {
            quotePrice = 1 / priceObj2.price
          }

          return {
            price: basePrice / quotePrice,
            baseAmount: 0,
            quoteAmount: 0,
          }
        })
    }),
  )
}
// @1 base=KNC&quote=DAI&side=SELL&amount=1
// base KNC quote DAI side SELL, amount is KNC amount
// @2 base=DAI&quote=KNC&side=SELL&amount=1000
// base DAI quote KNC side SELL amount is DAI amount
const getCombinationsPriceObjsWithAmount = (combinations, { base, quote, amount }) => {
  return Promise.all(
    combinations.map(([baseQuery, quoteQuery]) => {
      return new Promise(async (resolve, reject) => {
        let basePrice = null
        let quotePrice = null
        let middleTokenAmount = 0
        let quoteAmount = 0

        try {
          // @1 { base: 'KNC', quote: 'BTC', side: 'SELL' }
          if (baseQuery.base === base) {
            // this returnd KNC/BTC price
            const priceObj1 = await getSameSideObj({ ...baseQuery, amount })
            const { price, quoteAmount } = priceObj1
            basePrice = price
            middleTokenAmount = quoteAmount

          // @2 { base: 'BTC', quote: 'DAI', side: 'BUY' }
          } else if (baseQuery.quote === base) {
            // this returnd KNC/BTC price
            const priceObj1 = await getOppositeSideObj({
              base: baseQuery.quote,
              quote: baseQuery.base,
              amount, // now amount is quote amount
              side: baseQuery.side === 'BUY' ? 'SELL' : 'BUY',
            })
            const { price, baseAmount } = priceObj1
            basePrice = price
            middleTokenAmount = baseAmount
          }

          if (!basePrice) {
            resolve({
              price: 0,
              baseAmount: 0,
              quoteAmount: 0,
            })
            return
          }

          // @2 { base: 'KNC', quote: 'BTC', side: 'BUY' }
          // middleTokenAmount is BTC amount
          if (quoteQuery.base === quote) {
            // this returnd quoteQuery.quote/quoteQuery.base's price, so is BTC/KNC price
            const priceObj2 = await getOppositeSideObj({
              base: quoteQuery.quote,
              quote: quoteQuery.base,
              side: quoteQuery.side === 'BUY' ? 'SELL' : 'BUY',
              amount: middleTokenAmount,
            })
            const { price } = priceObj2
            quoteAmount = priceObj2.quoteAmount
            // so need to 1 / price
            quotePrice = price ? (1 / price) : 0

          // @1 { base: 'BTC', quote: 'DAI', side: 'SELL' }
          // middleTokenAmount is BTC amount
          } else if (quoteQuery.quote === quote) {
            // this returnd BTC/KNC price
            const priceObj2 = await getSameSideObj({ ...quoteQuery, amount: middleTokenAmount })
            const { price } = priceObj2
            quoteAmount = priceObj2.quoteAmount
            // so need to 1 / price
            quotePrice = price ? (1 / price) : 0
          }

          resolve(basePrice && quotePrice ? {
            baseAmount: amount,
            quoteAmount,
            price: basePrice / quotePrice,
          } : {
            baseAmount: 0,
            quoteAmount: 0,
            price: 0,
          })
        } catch (e) {
          reject(e)
        }

      })
    }),
  )
}

export const getPriceObj = async ({ base, quote, amount, side }) => {
  const isSameSide = await isSupportedSymbolWithSameSide({ base, quote })
  if (isSameSide) {
    const priceObj = await getSameSideObj({ base, quote, amount, side })
    return priceObj
  }

  const isOppositeSide = await isSupportedSymbolWithOppositeSide({ base, quote })

  if (isOppositeSide) {
    const priceObj = await getOppositeSideObj({ base, quote, amount, side })
    return priceObj
  }

  const symbols = await getSymbols()
  const combinations = getTradeCombinations(symbols, { base, quote, side })

  let allPriceObjs = []

  // 没有数量的情况
  if (!amount || !(+amount)) {
    allPriceObjs = await getCombinationsPriceObjsWithoutAmount(combinations, { base, quote })

  // 有数量的情况下
  } else {
    allPriceObjs = await getCombinationsPriceObjsWithAmount(combinations, { base, quote, amount })
  }

  const allPriceObjsFiltered = allPriceObjs.filter(priceObj => !!priceObj.price)

  if (!allPriceObjsFiltered.length) {
    return allPriceObjs[0] ? allPriceObjs[0] : {
      price: 0,
      baseAmount: 0,
      quoteAmount: 0,
      message: 'Can\'t solved this trade pair',
    }
  }

  const priceObj = allPriceObjsFiltered.reduce((memo, priceObj) => {
    if (!memo) return priceObj
    if (side === 'BUY') {
      return memo.price < priceObj.price ? memo : priceObj
    } else {
      return memo.price > priceObj.price ? memo : priceObj
    }
  }, null)

  return priceObj
}

export const getPrice = async ({ base, quote, amount, side }) => {
  const priceObj = await getPriceObj({ base, quote, amount, side })
  return priceObj.price
}