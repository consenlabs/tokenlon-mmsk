import { BigNumber } from '0x.js'
import { toBN } from './math'
import { getweb3 } from './web3'
import { addressWithout0x } from './address'
import { leftPadWith0 } from './helper'

export const getEthBalance = (address) => {
  const web3 = getweb3()
  return web3.eth.getBalance(address).then(toBN)
}

export const getTokenBalance = ({ address, contractAddress }): Promise<BigNumber> => {
  const web3 = getweb3()
  return new Promise((resolve, reject) => {
    web3.eth.call({
      to: contractAddress,
      data: `0x70a08231${leftPadWith0(addressWithout0x(address), 64)}`,
    }, (err, res) => {
      if (err) {
        return reject(err)
      }
      resolve(toBN(res === '0x' ? 0 : res))
    })
  })
}