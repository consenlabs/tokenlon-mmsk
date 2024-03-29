import * as Sentry from '@sentry/node'
import { INTERVAL_UPDAER_TIME } from '../constants'
import tracker from '../utils/tracker'

interface Props {
  INTERVAL_UPDAER_TIME?: number
  name: string
  updater: () => {}
}

export default class Updater {
  INTERVAL_UPDAER_TIME: number
  cacheResult: any = null

  constructor(props: Props) {
    this.name = props.name
    this.updater = props.updater
    this.INTERVAL_UPDAER_TIME = props.INTERVAL_UPDAER_TIME || INTERVAL_UPDAER_TIME
  }

  name = ''
  updater = () => {}

  intervalUpdater = () => {
    setTimeout(async () => {
      try {
        const result = await this.updater()
        if (result != null) {
          this.cacheResult = result
        }
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
    const result = await this.updater()
    if (result != null) {
      this.cacheResult = result
    }
    this.intervalUpdater()
    return this.cacheResult
  }
}
