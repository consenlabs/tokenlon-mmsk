import axios from 'axios'
import * as AxiosLogger from 'axios-logger'
import * as _ from 'lodash'
import { REQUEST_TIMEOUT } from '../constants'

const client = axios.create()
client.interceptors.request.use(AxiosLogger.requestLogger)
client.interceptors.response.use(AxiosLogger.responseLogger)

// `validateStatus` defines whether to resolve or reject the promise for a given
// HTTP response status code. If `validateStatus` returns `true` (or is set to `null`
// or `undefined`), the promise will be resolved; otherwise, the promise will be rejected.
const validateStatus = function (status: number): boolean {
  return status >= 200 && status < 300 // default
}

const getHeaders = () => {
  return {
    'Content-Type': 'application/json',
  }
}

const newError = (message, url: string) => {
  if (_.isObject(message) && message.message) {
    const error = message
    if (_.isObject(error.response) && _.isObject(error.response.data)) {
      if (error.response.data.error) {
        message = error.response.data.error.message
      }
    } else {
      message = `${url}: ${message.message}`
    }
  } else {
    message = `${url}: ${message}`
  }
  const error = new Error(message)
  error.message = message
  error.toString = () => message
  return error
}

// TODO add debounceTime
export const sendRequest = (config): Promise<any> => {
  const rConfig = {
    validateStatus,
    timeout: REQUEST_TIMEOUT,
    ...config,
  }
  return new Promise((resolve, reject) => {
    client(rConfig).then(res => {
      if (res.data) {
        resolve(res.data)
      } else {
        reject(newError('null response', config.url))
      }
    }).catch(error => {
      console.log('request error', error)
      reject(newError(error, config.url))
    })
  }) as Promise<{ error: object, result: any }>
}

export const jsonrpc = {
  get(url, header = {}, method, params, timeout: number = REQUEST_TIMEOUT) {
    const headers = {
      ...getHeaders(),
      ...header,
    }
    const data = {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }
    return sendRequest({ method: 'post', url, data, timeout, headers }).then(data => {
      if (data.error) {
        throw newError(data.error, url)
      }

      if (_.isUndefined(data.result)) {
        throw newError('server result is undefined', url)
      }
      return data.result
    }).catch(err => {
      throw err
    })
  },
}
