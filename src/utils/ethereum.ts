import { BigNumber } from '@0xproject/utils'
import { toBN } from './math'
import { web3RequestWrap } from './web3'
import { utils } from 'ethers'

export const getTokenBalance = ({ address, contractAddress }): Promise<BigNumber> => {
  return web3RequestWrap((web3) => {
    return new Promise((resolve, reject) => {
      web3.eth.call({
        to: contractAddress,
        data: `0x70a08231${utils.hexZeroPad(address, 64)}`,
      }, (err, res) => {
        if (err) {
          return reject(err)
        }
        resolve(toBN(res === '0x' ? 0 : res))
      })
    })
  })
}
