import { expect } from 'chai'
import 'mocha'
import { QueryInterface } from '../src/types'
import { ensureCorrectSymbolCase } from '../src/quoting'

const supportTokens = [
  {
    symbol: 'ETH',
    logo: 'https://cdn.example.com/eth.png',
    contractAddress: '0x0000000000000000000000000000000000000000',
    decimal: 18,
    precision: 4,
    minTradeAmount: 1e-7,
    maxTradeAmount: 10,
    opposites: ['DAI', 'imBTC'],
  },
  {
    symbol: 'DAI',
    logo: 'https://cdn.example.com/dai.png',
    contractAddress: '0x5c964665b6379527b625be996020d861f27aa31d',
    decimal: 18,
    precision: 4,
    minTradeAmount: 0.001,
    maxTradeAmount: 10000,
    opposites: ['ETH'],
  },
  {
    symbol: 'imBTC',
    logo: 'https://cdn.example.com/dai.png',
    contractAddress: '0x5c964665b6379527b625be996020d861f27aa31d',
    decimal: 18,
    precision: 4,
    minTradeAmount: 0.001,
    maxTradeAmount: 10000,
    opposites: ['ETH'],
  },
]

describe('translateBaseQuote()', function () {
  it('does not change correct symbol', function () {
    let pair: QueryInterface = { base: 'DAI', quote: 'ETH', side: 'BUY' }
    expect(ensureCorrectSymbolCase(pair, supportTokens)).to.eql({
      base: 'DAI',
      quote: 'ETH',
      side: 'BUY',
    })
  })

  it('correct symbol in pair', function () {
    let pair: QueryInterface = { base: 'DAI', quote: 'Eth', side: 'BUY' }
    expect(ensureCorrectSymbolCase(pair, supportTokens)).to.eql({
      base: 'DAI',
      quote: 'ETH',
      side: 'BUY',
    })
  })

  it('correct symbol case in pair', function () {
    let pair: QueryInterface = { base: 'IMBTC', quote: 'ETH', side: 'BUY' }
    expect(ensureCorrectSymbolCase(pair, supportTokens)).to.eql({
      base: 'imBTC',
      quote: 'ETH',
      side: 'BUY',
    })
  })
})
