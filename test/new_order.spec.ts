import { assert } from 'chai'
import 'mocha'
import * as suppressLogs from 'mocha-suppress-logs'
import { Wallet, utils } from 'ethers'
import { newOrder } from '../src/handler'
import { updaterStack, Updater } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'
import { Protocol } from '../src/types'

describe('NewOrder', function () {
  suppressLogs()

  const signer = Wallet.createRandom()

  beforeEach(function () {
    const mockMarkerMakerConfigUpdater = new Updater({
      name: 'mockMarkerMakerConfigUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockMarkerMakerConfigUpdater.cacheResult = {
      mmId: 1,
      mmProxyContractAddress: signer.address.toLowerCase(),
      tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
      exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
      userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
      wethContractAddress: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
      orderExpirationSeconds: 600,
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: '0xF1eC89551112da48C3b43B5a167AF0b2a7Cc2614',
        PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
        AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
      },
    }
    const mockTokenConfigsFromImtokenUpdater = new Updater({
      name: 'mockTokenConfigsFromImtokenUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockTokenConfigsFromImtokenUpdater.cacheResult = []
    const mockTokenListUpdate = new Updater({
      name: 'mockTokenListUpdate',
      updater() {
        return Promise.resolve({})
      },
    })
    mockTokenListUpdate.cacheResult = [
      {
        symbol: 'ETH',
        contractAddress: NULL_ADDRESS,
        decimal: 18,
        precision: 4,
        minTradeAmount: 0.01,
        maxTradeAmount: 10,
      },
      {
        symbol: 'USDT',
        contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        decimal: 6,
        precision: 4,
        minTradeAmount: 1,
        maxTradeAmount: 1000,
      },
    ]
    const mockPairsFromMMUpdater = new Updater({
      name: 'mockPairsFromMMUpdater',
      updater() {
        return Promise.resolve({})
      },
    })
    mockPairsFromMMUpdater.cacheResult = ['USDT/ETH']
    updaterStack['tokenListFromImtokenUpdater'] = mockTokenListUpdate
    updaterStack['pairsFromMMUpdater'] = mockPairsFromMMUpdater
    updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
    updaterStack['tokenConfigsFromImtokenUpdater'] = mockTokenConfigsFromImtokenUpdater
  })

  describe('dispatch to protocol signer', function () {
    it('should signed pmmv4 order', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-9999',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-9999')
    })

    it('should raise error pmmv4 order for EOA mmp', async function () {
      assert.equal(
        await newOrder({
          signer: signer,
          quoter: {
            getPrice: () => {
              return Promise.resolve({
                result: true,
                exchangeable: true,
                minAmount: 0,
                maxAmount: 1000,
                price: 1,
                quoteId: 'echo-testing-9999',
              })
            },
          },
          query: {
            base: 'ETH',
            quote: 'USDT',
            side: 'SELL',
            amount: 0.1,
            uniqId: 'testing-1111',
            userAddr: Wallet.createRandom().address.toLowerCase(),
          },
        }),
        'eoa_signer_not_work_with_tokenlon_v4_order'
      )
    })

    it('should signed pmmv5 order by MMP', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
    })

    it('should signed pmmv5 order by EOA', async function () {
      const signedOrderResp = await newOrder({
        signer: signer,
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '3')
    })
  })

  describe('handle token precision and decimals', () => {
    it('should format taker asset amount', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1.1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'BUY',
          amount: 0.1111,
          feeFactor: 10,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
      assert.equal(
        signedOrderResp.order.takerAssetData.slice(34),
        'dac17f958d2ee523a2206206994597c13d831ec7'
      )
      assert.equal(
        signedOrderResp.order.takerAssetAmount,
        utils.parseUnits('0.122539', 6).toString()
      )
      assert.equal(signedOrderResp.order.makerAssetAmount, utils.parseEther('0.1114').toString())
    })

    it('should format maker asset amount', async function () {
      const signedOrderResp = await newOrder({
        signer: Wallet.createRandom(),
        quoter: {
          getPrice: () => {
            return Promise.resolve({
              result: true,
              exchangeable: true,
              minAmount: 0,
              maxAmount: 1000,
              price: 1.1,
              quoteId: 'echo-testing-8888',
            })
          },
        },
        query: {
          base: 'ETH',
          quote: 'USDT',
          side: 'SELL',
          amount: 0.1111,
          uniqId: 'testing-1111',
          userAddr: Wallet.createRandom().address.toLowerCase(),
          protocol: Protocol.PMMV5,
        },
      })

      assert(signedOrderResp)
      assert.equal(signedOrderResp.order.quoteId, '1--echo-testing-8888')
      assert.equal(signedOrderResp.order.makerWalletSignature.slice(-1), '4')
      assert.equal(signedOrderResp.order.takerAssetAmount, utils.parseEther('0.1111').toString())
      assert.equal(
        signedOrderResp.order.makerAssetAmount,
        utils.parseUnits('0.12221', 6).toString()
      )
    })
  })
})
