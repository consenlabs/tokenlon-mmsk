import { ethers, network } from 'hardhat'
import { Wallet, utils } from 'ethers'
import { Protocol } from '../src/types'
import { WalletType } from '../src/signer/types'
import * as ethUtils from 'ethereumjs-util'
import { WETH, ZERO } from '@tokenlon/sdk'
import { expect } from 'chai'
import { generateSaltWithFeeFactor } from '../src/signer/pmmv5'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  USDT_ADDRESS,
  callNewOrder,
  callNewOrderResponse,
  expectOrder,
  getMarketMakingInfo,
  init,
} from './utils'
import { assetDataUtils } from '0x-v2-order-utils'
import { FEE_RECIPIENT_ADDRESS } from '../src/constants'

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
    const marketMakingInfo = getMarketMakingInfo()
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
    expectOrder({
      order: order,
      expectedProtocol: Protocol.AMMV1,
      expectedTakerAddress: marketMakingInfo.userProxyContractAddress,
      expectedMakerAddress: ammAddr,
      expectedTakerAssetAddress: ZERO[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })
  })
  it('should create ammv2 order by uniswap v2', async function () {
    const marketMakingInfo = getMarketMakingInfo()
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
    expectOrder({
      order: order,
      expectedProtocol: Protocol.AMMV2,
      expectedTakerAddress: marketMakingInfo.userProxyContractAddress,
      expectedMakerAddress: ammAddr,
      expectedTakerAssetAddress: ZERO[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })
    expect(order.payload).eq(payload)
  })
  // The AMM branches used to overwrite maxAmount with the configured tl_token.max_trade_amount,
  // discarding what the quoter reported. The quoter derives its maxAmount from the pair's own
  // caps, so the configured figure was the less informed of the two — and a refresh job probing
  // an AMM maker to learn its ceiling was handed back the value it had itself stored.
  //
  // The stubs make the two distinguishable: the quoter answers 1000, ETH is configured at 10.
  describe('the amounts an AMM quote reports', () => {
    const quotedMaxAmount = 1000
    const configuredEthMaxTradeAmount = 10
    const configuredEthMinTradeAmount = 0.01

    for (const protocol of [Protocol.AMMV1, Protocol.AMMV2]) {
      it(`${protocol} reports the quote's maxAmount, not the configured ceiling`, async function () {
        const resp = await callNewOrderResponse({
          chainId: chainId,
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          signer,
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol,
          makerAddress: '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852',
          payload: Buffer.from(
            JSON.stringify({ path: [WETH[chainId].toLowerCase(), USDT_ADDRESS[chainId].toLowerCase()] })
          ).toString('base64'),
        })

        expect(resp.maxAmount).to.equal(quotedMaxAmount)
        expect(resp.maxAmount).to.not.equal(configuredEthMaxTradeAmount)
      })

      // minAmount deliberately still comes from the token config: a quoter reports one figure for
      // every pair it serves, so there is nothing per-token to replace it with. Only max moved.
      it(`${protocol} still reports the configured minAmount`, async function () {
        const resp = await callNewOrderResponse({
          chainId: chainId,
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          signer,
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol,
          makerAddress: '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852',
          payload: Buffer.from(
            JSON.stringify({ path: [WETH[chainId].toLowerCase(), USDT_ADDRESS[chainId].toLowerCase()] })
          ).toString('base64'),
        })

        expect(resp.minAmount).to.equal(configuredEthMinTradeAmount)
      })
    }
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
      expect(order.takerAssetData).eq(assetDataUtils.encodeERC20AssetData(USDT_ADDRESS[chainId]))
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
