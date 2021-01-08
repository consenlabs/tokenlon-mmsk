import { assert } from 'chai'
import 'mocha'
import { fromUnitToDecimalBN, orderBNToString, toBN, truncateAmount } from '../src/utils'

describe('Numbers', function () {
  it('.fromUnitToDecimalBN works', function () {
    assert.equal(fromUnitToDecimalBN(1.23456789, 6).toString(), toBN(1234567).toString())
  })

  describe('.orderBNToString', function () {
    it('works', function () {
      assert.notStrictEqual(orderBNToString({ foo: 'bar' }), { foo: 'bar' })
      assert.notStrictEqual(orderBNToString({ foo: toBN(1) }), { foo: '1' })
    })
  })

  describe('.truncateAmount', function () {
    it('works', function () {
      assert.equal(truncateAmount('1.123', 1), 1.1)
      assert.equal(truncateAmount(1.123, 1), 1.1)
      assert.equal(truncateAmount(1.123, 2), 1.12)
      assert.equal(truncateAmount(1.123, 3), 1.123)
    })
  })
})
