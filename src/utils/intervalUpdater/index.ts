import { getMarketMakerConfig, getTokenList, getTokenConfigsForMM, getMMJwtToken } from '../../request/imToken'
import { getPairs } from '../../request/marketMaker'
import IntervalUpdater from './intervalUpdater'
import { Wallet } from '../../types'

const updaterStack = {
  markerMakerConfigUpdater: null as IntervalUpdater,
  tokenListFromImtokenUpdater: null as IntervalUpdater,
  jwtTokenFromImtokenUpdater: null as IntervalUpdater,
  tokenConfigsFromImtokenUpdater: null as IntervalUpdater,
  pairsFromMMUpdater: null as IntervalUpdater,
}

const startUpdater = async (wallet: Wallet) => {
  updaterStack.markerMakerConfigUpdater = new IntervalUpdater({
    name: 'markerMakerConfig',
    updater() {
      return getMarketMakerConfig(wallet.address)
    },
  })

  updaterStack.tokenListFromImtokenUpdater = new IntervalUpdater({
    name: 'tokenListFromImtoken',
    updater() {
      return getTokenList()
    },
  })

  updaterStack.tokenConfigsFromImtokenUpdater = new IntervalUpdater({
    name: 'tokenConfigsFromImtoken',
    updater() {
      return getTokenConfigsForMM(wallet.address)
    },
  })

  updaterStack.jwtTokenFromImtokenUpdater = new IntervalUpdater({
    name: 'jwtTokenFromImtoken',
    updater() {
      return getMMJwtToken(wallet.privateKey)
    },
  })

  updaterStack.pairsFromMMUpdater = new IntervalUpdater({
    name: 'pairsFromMM',
    updater() {
      return getPairs()
    },
  })

  const marketMakerConfig = await updaterStack.markerMakerConfigUpdater.start()
  const tokenListFromImtoken = await updaterStack.tokenListFromImtokenUpdater.start()
  const jwtTokenFromImtoken = await updaterStack.jwtTokenFromImtokenUpdater.start()
  const tokenConfigsFromImtoken = await updaterStack.tokenConfigsFromImtokenUpdater.start()
  const pairsFrom = await updaterStack.pairsFromMMUpdater.start()

  return {
    marketMakerConfig,
    jwtTokenFromImtoken,
    tokenListFromImtoken,
    tokenConfigsFromImtoken,
    pairsFrom,
  }
}

export {
  startUpdater,
  updaterStack,
}