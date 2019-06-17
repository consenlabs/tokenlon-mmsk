import { BigNumber } from '0x.js'

export const toBN = obj => new BigNumber(obj)

export const toFixed = (n, dp = 4, rm = 1): string => {
  return toBN(n).toFixed(dp, rm)
}