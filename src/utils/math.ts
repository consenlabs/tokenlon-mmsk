import { BigNumber } from '@0xproject/utils'

BigNumber.config({ ROUNDING_MODE: BigNumber.ROUND_FLOOR })

export const toBN = (obj) => new BigNumber(obj)

export const toFixed = (n, dp = 6, rm = 1): string => {
  return toBN(n).toFixed(dp, rm)
}
