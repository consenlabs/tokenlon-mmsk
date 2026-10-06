import { expect } from 'chai'
import { getBaseTokenByAddress } from '../src/handler/newOrder'

// The AMM branches of newOrder report the base token's configured minTradeAmount, looked up in
// the token list the updater refreshes every few minutes. The lookup used to be a lodash
// memoize keyed on the address alone, so the first token object seen for an address was
// returned until restart and a refreshed minTradeAmount never reached a quote.
describe('getBaseTokenByAddress', function () {
  const ETH = '0x0000000000000000000000000000000000000000'
  const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7'

  function token(contractAddress: string, minTradeAmount: number) {
    return {
      symbol: 'T',
      contractAddress,
      decimal: 18,
      precision: 4,
      minTradeAmount,
      maxTradeAmount: 100,
    }
  }

  it('returns the refreshed minTradeAmount once the updater swaps in a new list', function () {
    const first = [token(ETH, 0.0054)]
    expect(getBaseTokenByAddress(ETH, first).minTradeAmount).to.equal(0.0054)

    const refreshed = [token(ETH, 0.0031)]
    expect(getBaseTokenByAddress(ETH, refreshed).minTradeAmount).to.equal(0.0031)
  })

  it('matches the contract address case-insensitively, as the lowercased query expects', function () {
    const list = [token(ETH, 1), token(USDT, 2)]
    expect(getBaseTokenByAddress(USDT.toLowerCase(), list).minTradeAmount).to.equal(2)
  })

  it('keeps the first match when an address appears twice, as Array.prototype.find did', function () {
    const list = [token(USDT, 2), token(USDT, 3)]
    expect(getBaseTokenByAddress(USDT.toLowerCase(), list).minTradeAmount).to.equal(2)
  })

  it('returns undefined for an address the list does not carry', function () {
    expect(getBaseTokenByAddress(USDT.toLowerCase(), [token(ETH, 1)])).to.equal(undefined)
  })
})
