import { expect } from 'chai'
import * as http from 'http'
import * as Koa from 'koa'
import * as Router from 'koa-router'
import { AddressInfo } from 'net'
import { registerRoutes } from '../src/start'

const request = (port: number, method: string, path: string): Promise<number> =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path }, (res) => {
      res.resume()
      resolve(res.statusCode as number)
    })
    req.on('error', reject)
    req.end(method === 'POST' ? '{}' : undefined)
  })

describe('MMSK routes', function () {
  let server: http.Server
  let port: number

  before(async () => {
    const app = new Koa()
    const router = registerRoutes(new Router())
    app.use(router.routes()).use(router.allowedMethods())
    server = app.listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    port = (server.address() as AddressInfo).port
  })

  after(() => {
    server.close()
  })

  it('does not expose /signOrder', async function () {
    expect(await request(port, 'POST', '/signOrder')).to.eq(404)
    expect(await request(port, 'GET', '/signOrder')).to.eq(404)
  })

  it('still exposes /version', async function () {
    expect(await request(port, 'GET', '/version')).to.eq(200)
  })
})
