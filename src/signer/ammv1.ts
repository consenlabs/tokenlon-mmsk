// sign order from custom quoter no need to put it in MMSK
import { generatePseudoRandomSalt } from '0x-v2-order-utils'
import * as cryptoRandomString from 'crypto-random-string'
import { orderBNToString } from '../utils/format'
import { getOrderAndFeeFactor } from './pmmv4'

export const buildSignedOrder = (params) => {
  const { order, feeFactor } = getOrderAndFeeFactor(params)
  console.log(order)
  order.makerAddress = params.makerAddress
  const o = {
    ...order,
    salt: generatePseudoRandomSalt(),
  }
  const makerWalletSignature = cryptoRandomString({ length: 40 })
  const signedOrder = {
    ...o,
    feeFactor,
    makerWalletSignature,
  }
  return orderBNToString(signedOrder)
}
