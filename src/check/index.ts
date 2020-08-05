import 'babel-polyfill'
import { ConfigForStart } from '../types'
import { getWallet } from '../utils/wallet'
import { startUpdater } from '../worker'
import { setConfig } from '../config'
import checkPairs from './pairs'
import checkIndicativePrice from './indicativePrice'
import checkPrice from './price'
import checkDeal from './deal'
import checkException from './exception'
import { QuoteDispatcher, Quoter, QuoterProtocol } from '../request/marketMaker'

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
  let quoter: Quoter
  if (config.EXTERNAL_QUOTER) {
    quoter = config.EXTERNAL_QUOTER
  } else {
    quoter = new QuoteDispatcher(
      config.ZERORPC_SERVER_ENDPOINT || config.HTTP_SERVER_ENDPOINT,
      config.USE_ZERORPC ? QuoterProtocol.ZERORPC : QuoterProtocol.HTTP
    )
  }
  const wallet = getWallet()
  await startUpdater(quoter, wallet)

  for (let i = 0; i < arr.length; i += 1) {
    const item = arr[i]
    console.log(item.title)
    const errorMsg = await item.check(quoter)
    console.log(errorMsg ? `check failed: ${errorMsg}` : 'OK')
    if (i === 0 && errorMsg) break
    console.log('\n')
  }

  process.exit(0)
}
