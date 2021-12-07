import { assert } from 'chai'
import { applyFeeToAmount } from '../src/quoting'

describe('quoting.ts', function () {
  it('applyFeeToAmount', function () {
    const fee = applyFeeToAmount(104, 2553, 6)
    assert.equal(fee, 139.653551)
  })
})
