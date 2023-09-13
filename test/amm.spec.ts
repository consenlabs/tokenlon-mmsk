import { ethers, network } from 'hardhat'
import { Wallet, utils } from 'ethers'
import { Protocol } from '../src/types'
import { WalletType } from '../src/signer/types'
import * as ethUtils from 'ethereumjs-util'
import { WETH } from '@tokenlon/sdk'
import { expect } from 'chai'
import { generateSaltWithFeeFactor } from '../src/signer/pmmv5'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { USDT_ADDRESS, callNewOrder, init } from './utils'

describe('AMM NewOrder', function () {
  const chainId: number = network.config.chainId!
  let signer: SignerWithAddress
  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
  })
  beforeEach(() => {
    init(chainId, signer)
  })
  it('should create ammv1 order by uniswap v2', async function () {
    const ammAddr = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      signer,
      userAddr: Wallet.createRandom().address.toLowerCase(),
      protocol: Protocol.AMMV1,
      makerAddress: ammAddr,
    })
    console.log(`order`)
    console.log(order)
    expect(order).is.not.null
    expect(order.protocol).eq(Protocol.AMMV1)
    expect(order.quoteId).eq('1--echo-testing-8888')
    expect(order.makerAddress).eq('0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852')
    expect(order.makerAssetAmount).eq('100000')
    expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
    expect(order.makerAssetData).eq(
      `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
    )
    expect(order.takerAddress).eq('0x25657705a6be20511687d483f2fccfb2d92f6033')
    expect(order.takerAssetAmount).eq('100000000000000000')
    expect(order.takerAssetAddress).eq('0x0000000000000000000000000000000000000000')
    expect(order.takerAssetData).eq(
      '0xf47261b00000000000000000000000000000000000000000000000000000000000000000'
    )
    expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
    expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
    expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
    // The following fields are to be compatible `Order` struct.
    expect(order.makerFee).eq('0')
    expect(order.takerFee).eq('0')
    // verify signature length, the signature is generated ramdonly.
    expect(order.makerWalletSignature?.length).eq(40)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
  })
  it('should create ammv2 order by uniswap v2', async function () {
    const ammAddr = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'
    const payload = Buffer.from(
      JSON.stringify({
        path: [WETH[chainId].toLowerCase(), USDT_ADDRESS[chainId].toLowerCase()],
      })
    ).toString('base64')
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      signer,
      userAddr: Wallet.createRandom().address.toLowerCase(),
      protocol: Protocol.AMMV2,
      makerAddress: ammAddr,
      payload: payload,
    })
    expect(order).is.not.null
    expect(order.protocol).eq(Protocol.AMMV2)
    expect(order.quoteId).eq('1--echo-testing-8888')
    expect(order.makerAddress).eq('0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852')
    expect(order.makerAssetAmount).eq('100000')
    expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
    expect(order.makerAssetData).eq(
      `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
    )
    expect(order.takerAddress).eq('0x25657705a6be20511687d483f2fccfb2d92f6033')
    expect(order.takerAssetAmount).eq('100000000000000000')
    expect(order.takerAssetAddress).eq('0x0000000000000000000000000000000000000000')
    expect(order.takerAssetData).eq(
      '0xf47261b00000000000000000000000000000000000000000000000000000000000000000'
    )
    expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
    expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
    expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
    // The following fields are to be compatible `Order` struct.
    expect(order.makerFee).eq('0')
    expect(order.takerFee).eq('0')
    // verify signature length, the signature is generated ramdonly.
    expect(order.makerWalletSignature?.length).eq(40)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
    expect(order.payload).eq(payload)
  })
  describe('handle token precision and decimals', () => {
    it('should format taker asset amount', async function () {
      const order = await callNewOrder({
        chainId: chainId,
        base: 'ETH',
        quote: 'USDT',
        side: 'BUY',
        amount: 0.1111,
        walletType: WalletType.MMP_VERSION_4,
        signer: Wallet.createRandom(),
        userAddr: Wallet.createRandom().address.toLowerCase(),
        protocol: Protocol.PMMV5,
      })
      expect(order).is.not.null
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerWalletSignature?.toString().slice(-1)).eq('4')
      expect(order.takerAssetData.slice(34)).eq(USDT_ADDRESS[chainId].toLowerCase().slice(2))
      expect(order.takerAssetAmount).eq(utils.parseUnits('0.1114', 6).toString())
      expect(order.makerAssetAmount).eq(utils.parseEther('0.1114').toString())
    })
    it('should format maker asset amount', async function () {
      const order = await callNewOrder({
        chainId: chainId,
        base: 'ETH',
        quote: 'USDT',
        side: 'SELL',
        amount: 0.1111,
        walletType: WalletType.MMP_VERSION_4,
        signer: Wallet.createRandom(),
        userAddr: Wallet.createRandom().address.toLowerCase(),
        protocol: Protocol.PMMV5,
      })
      expect(order).is.not.null
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerWalletSignature?.slice(-1)).eq('4')
      expect(order.takerAssetAmount).eq(utils.parseEther('0.1111').toString())
      expect(order.makerAssetAmount).eq(utils.parseUnits('0.1111', 6).toString())
    })
  })
  it('Should generate correct salt', async () => {
    const givenPrefixSalt = generateSaltWithFeeFactor(30, '0x11111111111111111111111111111111')
    const salt = generateSaltWithFeeFactor(30)
    console.log(givenPrefixSalt.toString(16))
    console.log(ethUtils.toBuffer('0x' + salt.toString(16)).length)
    console.log(salt.toString(16))
    expect(ethUtils.toBuffer('0x' + givenPrefixSalt.toString(16)).length).is.eq(32)
    expect(ethUtils.toBuffer('0x' + salt.toString(16)).length).is.eq(32)
  })
})
