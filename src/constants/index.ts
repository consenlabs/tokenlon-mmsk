import { BigNumber } from '0x-v3-utils'

export const FEE_RECIPIENT_ADDRESS = '0xb9e29984fe50602e7a619662ebed4f90d93824c7'

export const REQUEST_TIMEOUT = 10000
export const INTERVAL_UPDAER_TIME = 5 * 60 * 1000

// tslint:disable-next-line:custom-no-magic-numbers
export const ONE_SECOND_MS = 1000
// tslint:disable-next-line:custom-no-magic-numbers
export const ONE_MINUTE_MS = ONE_SECOND_MS * 60
// tslint:disable-next-line:custom-no-magic-numbers
export const TEN_MINUTES_MS = ONE_MINUTE_MS * 10
export const NULL_ADDRESS = `0x${'0'.repeat(40)}`
export const ZERO = new BigNumber(0)
