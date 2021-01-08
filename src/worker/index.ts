import { getMarketMakerConfig, getTokenList, getTokenConfigsForMM } from '../request/imToken'
import { Quoter } from '../request/marketMaker'
import Updater from './updater'
import { Wallet } from '../types'

const updaterStack = {
  markerMakerConfigUpdater: null as Updater,
  tokenListFromImtokenUpdater: null as Updater,
  tokenConfigsFromImtokenUpdater: null as Updater,
  pairsFromMMUpdater: null as Updater,
}

const startUpdater = async (quoter: Quoter, wallet: Wallet) => {
  updaterStack.markerMakerConfigUpdater = new Updater({
    name: 'markerMakerConfig',
    updater() {
      return getMarketMakerConfig(wallet.address)
    },
  })

  updaterStack.tokenListFromImtokenUpdater = new Updater({
    name: 'tokenListFromImtoken',
    updater() {
      return getTokenList()
    },
  })

  updaterStack.tokenConfigsFromImtokenUpdater = new Updater({
    name: 'tokenConfigsFromImtoken',
    updater() {
      return getTokenConfigsForMM(wallet.address)
    },
  })

  updaterStack.pairsFromMMUpdater = new Updater({
    name: 'pairsFromMM',
    updater() {
      return quoter.getPairs()
    },
  })

  const marketMakerConfig = await updaterStack.markerMakerConfigUpdater.start()
  const tokenListFromImtoken = await updaterStack.tokenListFromImtokenUpdater.start()
  const tokenConfigsFromImtoken = await updaterStack.tokenConfigsFromImtokenUpdater.start()
  const pairsFrom = await updaterStack.pairsFromMMUpdater.start()

  return {
    marketMakerConfig,
    tokenListFromImtoken,
    tokenConfigsFromImtoken,
    pairsFrom,
  }
}

export { startUpdater, updaterStack, Updater }
