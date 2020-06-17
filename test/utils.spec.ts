import { expect } from 'chai';
import 'mocha'
import { translateBaseQuote } from '../src/utils/token'

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

describe('translateBaseQuote()', function() {
  it('does not change correct symbol', function() {
    let pair = { base: 'DAI', quote: 'ETH' }
    expect(translateBaseQuote(pair, supportTokens)).to.eql({
      base: 'DAI', quote: 'ETH',
    })
  })

  it('correct symbol in pair', function() {
    let pair = { base: 'DAI', quote: 'Eth' }
    expect(translateBaseQuote(pair, supportTokens)).to.eql({
      base: 'DAI', quote: 'ETH',
    })
  })

  it('correct symbol case in pair', function() {
    let pair = { base: 'IMBTC', quote: 'ETH' }
    expect(translateBaseQuote(pair, supportTokens)).to.eql({
      base: 'imBTC', quote: 'ETH',
    })
  })
})
