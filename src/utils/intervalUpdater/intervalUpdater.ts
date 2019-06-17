import * as Sentry from '@sentry/node'
import { INTERVAL_UPDAER_TIME } from '../../constants'
import tracker from '../tracker'

interface Props {
  INTERVAL_UPDAER_TIME?: number
  name: string
  updater: () => {}
}

export default class IntervalUpdater {
  INTERVAL_UPDAER_TIME: number

  constructor(props: Props) {
    this.name = props.name
    this.updater = props.updater
    this.INTERVAL_UPDAER_TIME = props.INTERVAL_UPDAER_TIME || INTERVAL_UPDAER_TIME
  }
  cacheResult = null

  name = ''
  updater = () => {}

  intervalUpdater = () => {
    setTimeout(async () => {
      try {
        this.cacheResult = await this.updater()
      } catch (error) {
        tracker.captureException(error)
        tracker.captureEvent({
          message: 'interval updater faild',
          level: Sentry.Severity.Error,
          extra: {
            name: this.name,
            error,
          },
        })
      }
      this.intervalUpdater()
    }, this.INTERVAL_UPDAER_TIME)
  }

  start = async () => {
    this.cacheResult = await this.updater()
    this.intervalUpdater()
    return this.cacheResult
  }
}