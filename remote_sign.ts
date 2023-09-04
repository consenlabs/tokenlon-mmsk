import Koa from 'koa'
import Router from 'koa-router'
import Bodyparser from 'koa-bodyparser'
import { Protocol } from './src/types'
import { buildSignedOrder as buildPMMV5SignedOrder } from './src/signer/pmmv5'
import { buildSignedOrder as buildRFQV1SignedOrder } from './src/signer/rfqv1'
import { buildSignedOrder as buildRFQV2SignedOrder } from './src/signer/rfqv2'
import * as ethers from 'ethers'
import dotenv from 'dotenv'
import { PermitType, WalletType } from './src/signer/types'
dotenv.config()

const privateKey = process.env.WALLET_PRIVATE_KEY as string
const signer = new ethers.Wallet(privateKey)

const port = 3000

const signPMMV5 = async (signRequest) => {
  console.log(signRequest)
  signRequest.pmmOrder.feeFactor = signRequest.feeFactor
  const signedOrder = await buildPMMV5SignedOrder(
    signer,
    signRequest.pmmOrder,
    signRequest.userAddr,
    1,
    '0x8D90113A1e286a5aB3e496fbD1853F265e5913c6'
  )
  console.log(signedOrder)
  return signedOrder.makerWalletSignature
}

const signRFQV1 = async (signRequest) => {
  console.log(signRequest)
  const signedOrder = await buildRFQV1SignedOrder(
    signer,
    signRequest.rfqOrder,
    signRequest.userAddr,
    1,
    '0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F',
    WalletType.MMP_VERSION_4
  )
  console.log(signedOrder)
  return signedOrder.makerWalletSignature
}

const signRFQV2 = async (signRequest) => {
  console.log(signRequest)
  const signedOrder = await buildRFQV2SignedOrder(
    signer,
    signRequest.rfqOrder,
    signRequest.userAddr,
    1,
    '0x91C986709Bb4fE0763edF8E2690EE9d5019Bea4a',
    WalletType.MMP_VERSION_4,
    PermitType.APPROVE_RFQV2
  )
  console.log(signedOrder)
  return signedOrder.makerWalletSignature
}

const sign = async (ctx) => {
  const signRequest = ctx.request.body
  let signature
  if (signRequest.protocol === Protocol.PMMV5) {
    signature = await signPMMV5(signRequest)
  } else if (signRequest.protocol === Protocol.RFQV1) {
    signature = await signRFQV1(signRequest)
  } else if (signRequest.protocol === Protocol.RFQV2) {
    signature = await signRFQV2(signRequest)
  } else {
    throw new Error('Invalid protocol')
  }

  const response = {
    signature: signature,
  }
  ctx.body = response
}

const main = async () => {
  const app = new Koa()
  const router = new Router()

  router.get(`/`, (ctx) => {
    console.log(ctx)
    ctx.body = {
      result: true,
      version: '5.3.2',
    }
  })
  router.post('/sign', sign)

  app.use(Bodyparser())
  app.use(router.routes())
  app.use(router.allowedMethods())
  app.on('error', (err) => {
    console.error(err)
  })
  app.listen(port)
  console.log(router.routes())
  console.log(`Server started ${port} port`)
}

main().catch(console.error)
