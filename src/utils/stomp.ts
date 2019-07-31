import * as Sentry from '@sentry/node'
import * as SockJS from 'sockjs-client'
import { Stomp } from 'stompjs/lib/stomp'
import { config } from '../config'
import { updaterStack } from './intervalUpdater'
import { MAX_WEBSOCKET_RECONNECT_TRIED_TIMES, WEBSOCKET_TRY_CONNECT_INTERVAL } from '../constants'
import tracker from './tracker'
import { dealOrder } from '../request/marketMaker'

// 提供ws服务的端点名称
const endpoint = 'exchange'

export default class StompForExchange {
  stompClient = null
  userDealSubscription = null
  connecting = false
  connected = false
  triedFailedTimes = 0

  connectStomp = () => {
    const token = updaterStack.jwtTokenFromImtokenUpdater.cacheResult
    const Authorization = `MMSK ${token}`
    const host = config.WEBSOCKET_URL.replace(/\/rpc$/, '')

    if (this.connecting) {
      tracker.captureEvent({
        message: 'connecting',
        level: Sentry.Severity.Warning,
        extra: {
          triedFailedTimes: this.triedFailedTimes,
        },
      })
      return
    }

    if (this.isTriedMaxTimes()) {
      tracker.captureEvent({
        message: `tried MAX_WEBSOCKET_RECONNECT_TRIED_TIMES ${MAX_WEBSOCKET_RECONNECT_TRIED_TIMES} times still can not connect`,
        level: Sentry.Severity.Fatal,
        extra: {
          triedFailedTimes: this.triedFailedTimes,
        },
      })
      return
    }

    this.connecting = true

    try {
      const socket = new SockJS(`${host}/${endpoint}?Authorization=${encodeURIComponent(Authorization)}`)
      this.stompClient = Stomp.over(socket)
      this.stompClient.connect(
        '',
        '',
        () => {
          this.userDeal()
          this.connecting = false
          this.connected = true
          this.resetTriedTimes()
        },
        async (error) => {
          tracker.captureEvent({
            message: 'disconnect',
            level: Sentry.Severity.Warning,
            extra: {
              triedFailedTimes: this.triedFailedTimes,
              error,
            },
          })
          this.connecting = false
          this.connected = false
          this.triedFailedTimes += 1
          setTimeout(this.connectStomp, WEBSOCKET_TRY_CONNECT_INTERVAL)
        },
      )
    } catch (error) {
      tracker.captureEvent({
        message: 'connect error',
        level: Sentry.Severity.Error,
        extra: {
          triedFailedTimes: this.triedFailedTimes,
          error,
        },
      })
      this.connecting = false
      this.connected = false
      this.triedFailedTimes += 1
      setTimeout(this.connectStomp, WEBSOCKET_TRY_CONNECT_INTERVAL)
    }
  }

  resetTriedTimes = () => {
    this.triedFailedTimes = 0
  }

  isTriedMaxTimes = () => {
    return this.triedFailedTimes >= MAX_WEBSOCKET_RECONNECT_TRIED_TIMES
  }

  disconnectStomp = () => {
    this.userDealSubscription && this.userDealSubscription.unsubscribe()
    this.stompClient && this.stompClient.disconnect()
    this.userDealSubscription = null
    this.stompClient = null
  }

  private wsSubscribeJsonHelper = (subscribeName, path, callback) => {
    if (this.stompClient) {
      this[subscribeName] && this[subscribeName].unsubscribe()
      try {
        this[subscribeName] = this.stompClient.subscribe(path, (message) => {
          try {
            const obj = JSON.parse(message.body)
            callback(obj)
          } catch (error) {
            tracker.captureEvent({
              message: 'path get message JSON.parse error',
              level: Sentry.Severity.Warning,
              extra: {
                path,
                error,
                subscribeName,
              },
            })
          }
        })
      } catch (error) {
        tracker.captureEvent({
          message: 'subscrible error',
          level: Sentry.Severity.Error,
          extra: {
            path,
            error,
            subscribeName,
          },
        })
      }
      return this[subscribeName]
    }
  }

  userDeal = () => {
    const mmProxyContractAddress = updaterStack.markerMakerConfigUpdater.cacheResult.mmProxyContractAddress
    const path = `/user/deal/${mmProxyContractAddress}`
    this.wsSubscribeJsonHelper('userDealSubscription', path, async (order) => {
      tracker.captureEvent({
        message: 'userDeal trigger',
        level: Sentry.Severity.Log,
        extra: order,
      })
      dealOrder(order)
      if (this.stompClient) {
        const { quoteId } = order
        // mark order dealt
        this.stompClient.send(path, {}, JSON.stringify({ quoteId }))
      }
    })
  }
}
