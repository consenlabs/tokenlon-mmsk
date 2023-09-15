import { expect } from 'chai'
import { ethers } from 'ethers'
import { validateNewOrderRequest, validateRequest } from '../../src/validations'

describe('Validator', function () {
  it('validateRequest', function () {
    expect(validateRequest({})).to.be.includes('base, quote, side must be string type')
    expect(
      validateRequest({
        base: 1,
        quote: 'ETH',
        side: 'BUY',
      })
    ).to.be.includes('base, quote, side must be string type')
  })

  it('validateNewOrderRequest', function () {
    const address = ethers.Wallet.createRandom().address
    expect(validateNewOrderRequest(1, 'foobar', address)).eq(null)
    expect(validateNewOrderRequest(1, 'foobar', 'baz')).eq('userAddress:baz is not a valid address')
  })
})
