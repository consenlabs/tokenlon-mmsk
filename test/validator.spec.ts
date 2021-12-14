import { expect } from 'chai'
import { ethers } from 'hardhat'
import { validateNewOrderRequest, validateRequest } from '../src/validations'

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
    expect(validateNewOrderRequest(1, 'foobar', ethers.Wallet.createRandom().address)).to.be.eq(null)
    expect(validateNewOrderRequest(1, 'foobar', 'baz')).to.be.eq(
      `userAddress:baz is not a valid address`
    )
  })
})
