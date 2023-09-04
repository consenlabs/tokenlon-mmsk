import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as Bodyparser from 'koa-bodyparser'
import { Protocol } from './types'
import { buildSignedOrder as buildPMMV5SignedOrder } from './signer/pmmv5'
import { signByMMPSigner as signRFQV1ByMMPSigner } from './signer/rfqv1'
import { signOffer, signByMMPSigner as signRFQV2ByMMPSigner } from './signer/rfqv2'
import * as ethers from 'ethers'
import { SignatureType, WalletType } from './signer/types'
import * as config from '../app/mmConfig.js'

const privateKey = config.WALLET_PRIVATE_KEY as string
const signer = new ethers.Wallet(privateKey)

const walletType = WalletType.MMP_VERSION_4

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
  const signature = await signRFQV1ByMMPSigner(
    signRequest.orderSignDigest,
    signRequest.userAddr,
    signRequest.feeFactor,
    signer,
    WalletType.MMP_VERSION_4
  )
  console.log(`signature: ${signature}`)
  return signature
}

const signRFQV2 = async (signRequest) => {
  console.log(signRequest)
  let signature
  if (walletType === WalletType.MMP_VERSION_4) {
    signature = await signRFQV2ByMMPSigner(
      signRequest.orderSignDigest,
      signRequest.userAddr,
      signRequest.feeFactor,
      signer,
      WalletType.MMP_VERSION_4
    )
  } else if (walletType === WalletType.ERC1271_EIP712) {
    signature = await signOffer(
      1,
      '0x91C986709Bb4fE0763edF8E2690EE9d5019Bea4a',
      signRequest.rfqOrder,
      signer,
      SignatureType.WalletBytes32
    )
  }
  console.log(`signature: ${signature}`)
  return signature
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
