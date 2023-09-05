import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as Bodyparser from 'koa-bodyparser'
import { Protocol } from './types'
import { signByEOA as signPMMV5EOA, signByMMPSigner as signPMMV5ByMMPSigner } from './signer/pmmv5'
import { signRFQOrder, signByMMPSigner as signRFQV1ByMMPSigner } from './signer/rfqv1'
import { signOffer, signByMMPSigner as signRFQV2ByMMPSigner } from './signer/rfqv2'
import * as ethers from 'ethers'
import {
  RemoteSigningPMMV5Request,
  RemoteSigningRFQV1Request,
  RemoteSigningRFQV2Request,
  SignatureType,
  WalletType,
} from './signer/types'
import * as config from '../app/mmConfig.js'

const privateKey = config.WALLET_PRIVATE_KEY as string
const signer = new ethers.Wallet(privateKey)

const walletType = WalletType.MMP_VERSION_4

const port = 3000

const signPMMV5 = async (signRequest: RemoteSigningPMMV5Request) => {
  console.log(signRequest)
  const pmmOrder = signRequest.pmmOrder
  let signature
  if (signer.address.toLowerCase() === pmmOrder.makerAddress.toLowerCase()) {
    signature = signPMMV5EOA(signRequest.orderSignDigest, signer)
  } else {
    signature = await signPMMV5ByMMPSigner(
      signRequest.orderSignDigest,
      signRequest.userAddr,
      signRequest.feeFactor,
      signer
    )
  }
  console.log(signature)
  return signature
}

const signRFQV1 = async (signRequest: RemoteSigningRFQV1Request) => {
  console.log(signRequest)
  const rfqOrder = signRequest.rfqOrder
  let signature
  if (signer.address.toLowerCase() === rfqOrder.makerAddr.toLowerCase()) {
    signature = await signRFQOrder(
      signRequest.chainId,
      `0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F`,
      signRequest.rfqOrder,
      signer,
      signRequest.feeFactor,
      SignatureType.EIP712
    )
  } else if (walletType === WalletType.MMP_VERSION_4) {
    signature = await signRFQV1ByMMPSigner(
      signRequest.orderSignDigest,
      signRequest.userAddr,
      signRequest.feeFactor,
      signer,
      WalletType.MMP_VERSION_4
    )
  } else if (walletType === WalletType.ERC1271_EIP712) {
    signature = await signRFQOrder(
      signRequest.chainId,
      `0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F`,
      signRequest.rfqOrder,
      signer,
      signRequest.feeFactor,
      SignatureType.WalletBytes32
    )
  }
  console.log(`signature: ${signature}`)
  return signature
}

const signRFQV2 = async (signRequest: RemoteSigningRFQV2Request) => {
  console.log(signRequest)
  const rfqOrder = signRequest.rfqOrder
  let signature
  if (signer.address.toLowerCase() === rfqOrder.maker.toLowerCase()) {
    signature = await signOffer(
      signRequest.chainId,
      '0x91C986709Bb4fE0763edF8E2690EE9d5019Bea4a',
      signRequest.rfqOrder,
      signer,
      SignatureType.EIP712
    )
  } else if (walletType === WalletType.MMP_VERSION_4) {
    signature = await signRFQV2ByMMPSigner(
      signRequest.orderSignDigest,
      signRequest.userAddr,
      signRequest.feeFactor,
      signer,
      WalletType.MMP_VERSION_4
    )
  } else if (walletType === WalletType.ERC1271_EIP712) {
    signature = await signOffer(
      signRequest.chainId,
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
