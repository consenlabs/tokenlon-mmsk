import { reduce } from 'lodash'
import { BigNumber } from '@0xproject/utils'

BigNumber.config({
  ROUNDING_MODE: BigNumber.ROUND_FLOOR,
  DECIMAL_PLACES: 18,
  FORMAT: {
    decimalSeparator: '.',
    groupSeparator: '',
    groupSize: 3,
    secondaryGroupSize: 0,
    fractionGroupSeparator: ' ',
    fractionGroupSize: 0,
  },
})

export { BigNumber }

export const toBN = (obj: number | string): BigNumber => new BigNumber(obj)

export const isBigNumber = (v: any): boolean => {
  return (
    v instanceof BigNumber ||
    (v && v.isBigNumber === true) ||
    (v && v._isBigNumber === true) ||
    false
  )
}

export const orderBNToString = (order) => {
  return reduce(
    order,
    (acc, v, key) => {
      acc[key] = isBigNumber(v) ? v.toString() : v
      return acc
    },
    {}
  )
}

// apply 10**decimal to token balance
export const fromUnitToDecimalBN = (balance: number | string, decimal: number): BigNumber => {
  const amountBN = toBN(balance || 0)
  const decimalBN = toBN(10).pow(decimal)
  return amountBN.times(decimalBN).truncated()
}

// truncate out of precision part
export const truncateAmount = (amount: number | string, precision: number): number => {
  return toBN(toBN(amount).toFormat(precision)).toNumber()
}
