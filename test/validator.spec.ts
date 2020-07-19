import { expect } from 'chai';
import 'mocha'
import { Wallet } from 'ethers'
import { validateNewOrderRequest, validateRequest } from '../src/validations'

describe('Validator', function() {
  it('validateRequest', function() {
    expect(validateRequest({})).to.be.eq('base, quote, side must be string type')
    expect(validateRequest({
      base: 1,
      quote: 'ETH',
      side: 'BUY',
    })).to.be.eq('base, quote, side must be string type')
  })

  it('validateNewOrderRequest', function() {
    expect(validateNewOrderRequest(
      1, 'foobar', Wallet.createRandom().address)
    ).to.be.eq(null)
    expect(validateNewOrderRequest(1, 'foobar', 'baz')).to.be.eq(
    `userAddress:baz is not a valid address`
    )
  })
})
