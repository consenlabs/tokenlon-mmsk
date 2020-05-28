import 'babel-polyfill'
import { ConfigForStart } from '../types'
import { getWallet } from '../utils/wallet'
import { startUpdater } from '../utils/intervalUpdater'
import { setConfig } from '../config'
import checkPairs from './pairs'
import checkIndicativePrice from './indicativePrice'
import checkPrice from './price'
import checkDeal from './deal'
import checkException from './exception'
import { connectClient } from '../request/marketMaker/zerorpc'

export const checkMMSK = async (config: ConfigForStart) => {
  const arr = [
    {
      title: 'checking Pairs API',
      check: checkPairs,
    },
    {
      title: 'checking indicativePrice API',
      check: checkIndicativePrice,
    },
    {
      title: 'checking price API',
      check: checkPrice,
    },
    {
      title: 'checking deal API',
      check: checkDeal,
    },
    {
      title: 'checking exception API',
      check: checkException,
    },
  ]

  setConfig(config)

  const wallet = getWallet()
  if (config.USE_ZERORPC) {
    connectClient(config.ZERORPC_SERVER_ENDPOINT)
  }
  await startUpdater(wallet)

  for (let i = 0; i < arr.length; i += 1) {
    const item = arr[i]
    console.log(item.title)
    const errorMsg = await item.check()
    console.log(errorMsg ? `check failed: ${errorMsg}` : 'OK')
    if (i === 0 && errorMsg) break
    console.log('\n')
  }

  process.exit(0)
}