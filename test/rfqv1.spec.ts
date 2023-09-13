import { ethers, network } from 'hardhat'
import { Wallet, utils, Contract } from 'ethers'
import { updaterStack } from '../src/worker'
import { Protocol } from '../src/types'
import { toRFQOrder } from '../src/signer/rfqv1'
import { buildSignedOrder as buildRFQV1SignedOrder } from '../src/signer/rfqv1'
import { ExtendedZXOrder, SignatureType, WalletType } from '../src/signer/types'
import { getOrderSignDigest } from '../src/signer/orderHash'
import { BigNumber, toBN } from '../src/utils'
import { WETH } from '@tokenlon/sdk'
import * as crypto from 'crypto'
import { expect } from 'chai'
import { assetDataUtils } from '0x-v2-order-utils'
import * as nock from 'nock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  RFQV1,
  USDT_ADDRESS,
  callNewOrder,
  deployEIP1271Plus191Wallet,
  deployERC1271Wallet,
  deployMMPV4Wallet,
  init,
  replaceMarketMakingAddress,
  usdtHolders,
} from './utils'

describe('RFQV1 NewOrder', function () {
  const chainId: number = network.config.chainId!
  let signer: SignerWithAddress
  let rfqv1: Contract
  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
    const usdtHolderAddr = usdtHolders[chainId]
    rfqv1 = await ethers.getContractAt('ISignatureValidator', RFQV1[chainId])
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [usdtHolderAddr],
    })
  })
  beforeEach(() => {
    init(chainId, signer)
  })
  it('should sign rfqv1 order by EIP712', async function () {
    replaceMarketMakingAddress(chainId, signer.address, updaterStack)
    const userAddr = Wallet.createRandom().address.toLowerCase()
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      walletType: WalletType.EOA,
      signer: signer,
      protocol: Protocol.RFQV1,
    })
    console.log(order)
    expect(order).is.not.null
    expect(order.protocol).eq(Protocol.RFQV1)
    expect(order.quoteId).eq('1--echo-testing-8888')
    expect(order.makerAddress).eq(signer.address.toLowerCase())
    expect(order.makerAssetAmount).eq('100000')
    expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
    expect(
      order.makerAssetData,
      `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
    )
    expect(order.takerAddress).eq(userAddr)
    expect(order.takerAssetAmount).eq('100000000000000000')
    expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
    expect(
      order.takerAssetData,
      `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
    )
    expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
    expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
    expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
    // The following fields are to be compatible `Order` struct.
    expect(order.makerFee).eq('0')
    expect(order.takerFee).eq('0')
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(98)
    expect(sigBytes[97]).eq(SignatureType.EIP712)
    // verify signature
    const orderSignDigest = getOrderSignDigest(toRFQOrder(order), chainId, RFQV1[chainId])
    const isValid = await rfqv1.callStatic.isValidSignature(
      signer.address,
      orderSignDigest,
      '0x',
      order.makerWalletSignature
    )
    expect(isValid).true
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
  })
  it('should sign rfqv1 order for MMPv4', async () => {
    const user = Wallet.createRandom()
    const userAddr = user.address.toLowerCase()
    const [deployer] = await ethers.getSigners()
    const mmpSigner = Wallet.createRandom()
    console.log(`mmpSigner: ${mmpSigner.address}`)
    const mmproxy = await deployMMPV4Wallet(mmpSigner, deployer)
    console.log(`mmproxy: ${mmproxy.address}`)
    expect(mmproxy.address).is.not.null
    replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
    const order = await callNewOrder({
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      walletType: WalletType.MMP_VERSION_4,
      signer: mmpSigner,
      chainId: chainId,
      protocol: Protocol.RFQV1,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(88)
    expect(sigBytes[87]).eq(SignatureType.Wallet)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds) > 0).is.true
    const orderSignDigest = getOrderSignDigest(toRFQOrder(order), chainId, RFQV1[chainId])
    const isValid = await rfqv1.callStatic.isValidSignature(
      order.makerAddress,
      orderSignDigest,
      '0x',
      order.makerWalletSignature
    )
    console.log(`isValid: ${isValid}`)
    expect(isValid).true
  }).timeout(360000)
  it('should sign rfqv1 order for a ERC1271_EIP712_EIP191 MMP contract', async () => {
    const [deployer] = await ethers.getSigners()
    const privateKey = crypto.randomBytes(32)
    const user = new ethers.Wallet(privateKey, ethers.provider)
    const userAddr = user.address.toLowerCase()
    const allowSigner = Wallet.createRandom()
    console.log(`allowSigner: ${allowSigner.address}`)
    const walletContract = await deployEIP1271Plus191Wallet(allowSigner, deployer)
    expect(walletContract.address).is.not.null
    replaceMarketMakingAddress(chainId, walletContract.address, updaterStack)
    const order = await callNewOrder({
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      chainId: chainId,
      walletType: WalletType.ERC1271_EIP712_EIP191,
      signer: allowSigner,
      protocol: Protocol.RFQV1,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(66)
    expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
    const orderSignDigest = getOrderSignDigest(toRFQOrder(order), chainId, RFQV1[chainId])
    const isValid = await rfqv1.callStatic.isValidSignature(
      order.makerAddress,
      orderSignDigest,
      '0x',
      order.makerWalletSignature
    )
    console.log(`isValid: ${isValid}`)
    expect(isValid).true
  }).timeout(360000)
  it('should sign rfqv1 order for a ERC1271_EIP712 MMP contract', async () => {
    const [deployer] = await ethers.getSigners()
    const user = Wallet.createRandom()
    const userAddr = user.address.toLowerCase()
    const allowSigner = Wallet.createRandom()
    console.log(`allowSigner: ${allowSigner.address}`)
    const walletContract = await deployERC1271Wallet(allowSigner, deployer)
    expect(walletContract.address).is.not.null
    replaceMarketMakingAddress(chainId, walletContract.address, updaterStack)
    const order = await callNewOrder({
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      walletType: WalletType.ERC1271_EIP712,
      signer: allowSigner,
      chainId: chainId,
      userAddr: userAddr,
      protocol: Protocol.RFQV1,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(66)
    expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
    const orderSignDigest = getOrderSignDigest(toRFQOrder(order), chainId, RFQV1[chainId])
    const r = utils.hexlify(sigBytes.slice(0, 32))
    const s = utils.hexlify(sigBytes.slice(32, 64))
    const v = utils.hexlify(sigBytes.slice(64, 65))
    console.log(`r: ${r}`)
    console.log(`s: ${s}`)
    console.log(`v: ${v}`)
    const isValid = await rfqv1.callStatic.isValidSignature(
      order.makerAddress,
      orderSignDigest,
      '0x',
      order.makerWalletSignature
    )
    console.log(`isValid: ${isValid}`)
    expect(isValid).true
  }).timeout(360000)
  it('Should forward unsigned RFQV1 orders to signing service', async () => {
    const url = `http://localhost:3000`
    const rfqAddr = RFQV1[chainId]
    const order: ExtendedZXOrder = {
      protocol: Protocol.RFQV1,
      quoteId: `0x123`,
      exchangeAddress: `0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64`.toLowerCase(),
      feeRecipientAddress: `0x45352`,
      senderAddress: `0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64`,
      takerAddress: '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69',
      makerAddress: '0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64'.toLowerCase(),
      takerAssetData: assetDataUtils.encodeERC20AssetData(WETH[chainId]),
      makerAssetData: assetDataUtils.encodeERC20AssetData(USDT_ADDRESS[chainId]),
      takerFee: toBN(0),
      makerFee: toBN(0),
      takerAssetAddress: WETH[chainId],
      makerAssetAddress: USDT_ADDRESS[chainId],
      takerAssetAmount: new BigNumber('0x0de0b6b3a7640000'),
      makerAssetAmount: new BigNumber('0x05f5e100'),
      salt: new BigNumber('0x44df74b1c54e9792989c61fedcef6f94b534b58933cde70bc456ec74cf4d3610'),
      expirationTimeSeconds: toBN(1620444917),
      feeFactor: 30,
    }
    const defaultSignature = `0x12345677777777777777777`
    const scope = nock(url)
      .post('/')
      .reply(200, (_, requestBody) => {
        console.log(`requestBody: `)
        console.log(requestBody)
        return {
          signature: defaultSignature,
        }
      })
    const signedOrder = await buildRFQV1SignedOrder(
      undefined,
      order,
      Wallet.createRandom().address.toLowerCase(),
      chainId,
      rfqAddr,
      WalletType.MMP_VERSION_4,
      {
        signingUrl: url,
        salt: '0x11111111111111111111111111111111',
      }
    )
    scope.done()
    console.log(signedOrder)
    expect(signedOrder).not.null
    expect(signedOrder.makerWalletSignature).not.null
    expect(signedOrder.makerWalletSignature).eq(defaultSignature)
  })
})
