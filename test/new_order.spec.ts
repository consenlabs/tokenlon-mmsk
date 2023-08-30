import { ethers, network } from 'hardhat'
import { Wallet, utils, Contract } from 'ethers'
import { newOrder } from '../src/handler'
import { updaterStack, Updater } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'
import { Protocol } from '../src/types'
import { buildSignedOrder, toRFQOrder } from '../src/signer/rfqv1'
import { SignatureType, WalletType } from '../src/signer/types'
import { getOrderSignDigest, getOfferSignDigest } from '../src/signer/orderHash'
import { BigNumber } from '../src/utils'
import * as ethUtils from 'ethereumjs-util'
import { AllowanceTarget, USDT, ABI, WETH, ZERO } from '@tokenlon/sdk'
import * as crypto from 'crypto'
import { expect } from 'chai'
import { generateSaltWithFeeFactor } from '../src/signer/pmmv5'
import { toOffer } from '../src/signer/rfqv2'
const usdtHolders = {
  1: '0x15abb66bA754F05cBC0165A64A11cDed1543dE48',
  5: '0x031BBFB9379c4e6E3F42fb93a9f09C060c7fA037',
}
describe('NewOrder', function () {
  const signer = Wallet.createRandom()
  let chainId: number
  before(async () => {
    const networkInfo = await ethers.provider.getNetwork()
    chainId = networkInfo.chainId
    const usdtHolderAddr = usdtHolders[chainId]
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [usdtHolderAddr],
    })
  })
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
      wethContractAddress: WETH[chainId].toLowerCase(),
      orderExpirationSeconds: 600,
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: '0x085966eE3E32A0Da16467569512535D38626B547',
        PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
        AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
        RFQ: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
        RFQV2: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
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
    it('should create ammv1 order by uniswap v2', async function () {
      const ammAddr = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'
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
              makerAddress: ammAddr,
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
          protocol: Protocol.AMMV1,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.AMMV1)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq('0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852')
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
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
      expect(order.makerWalletSignature.length).eq(40)
      // verify random values
      expect(order.salt.length > 0).is.true
      expect(Number(order.expirationTimeSeconds) > 0).is.true
    })
    it('should create ammv2 order by uniswap v2', async function () {
      const ammAddr = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'
      const payload = Buffer.from(
        JSON.stringify({
          path: [
            '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            '0xdac17f958d2ee523a2206206994597c13d831ec7',
          ],
        })
      ).toString('base64')
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
              makerAddress: ammAddr,
              quoteId: 'echo-testing-8888',
              payload: payload,
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
          protocol: Protocol.AMMV2,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.AMMV2)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq('0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852')
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
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
      expect(order.makerWalletSignature.length).eq(40)
      // verify random values
      expect(order.salt.length > 0).is.true
      expect(Number(order.expirationTimeSeconds) > 0).is.true
      expect(order.payload).eq(payload)
    })
    it('should raise error for pmmv4 order', async function () {
      expect(
        await newOrder({
          walletType: WalletType.MMP_VERSION_4,
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
            protocol: 'PMMV4',
          },
        }),
        'Unrecognized protocol: PMMV4'
      )
    })
    it('should sign pmmv5 order for MMPv4', async function () {
      const userAddr = Wallet.createRandom().address.toLowerCase()
      const signedOrderResp = await newOrder({
        walletType: WalletType.MMP_VERSION_4,
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
          userAddr: userAddr,
          protocol: Protocol.PMMV5,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.PMMV5)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(signer.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq('0x7bd7d025d4231aad1233967b527ffd7416410257')
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0x7bd7d025d4231aad1233967b527ffd7416410257')
      expect(order.feeRecipientAddress).eq(userAddr)
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      expect(signedOrderResp.order.makerWalletSignature.slice(-1)).eq('4')
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
    })
    it('should sign pmmv5 order by EOA', async function () {
      const userAddr = Wallet.createRandom().address.toLowerCase()
      const signedOrderResp = await newOrder({
        walletType: WalletType.EOA,
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
          userAddr: userAddr,
          protocol: Protocol.PMMV5,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.PMMV5)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(signer.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq('0x7bd7d025d4231aad1233967b527ffd7416410257')
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0x7bd7d025d4231aad1233967b527ffd7416410257')
      expect(order.feeRecipientAddress).eq(userAddr)
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      expect(signedOrderResp.order.makerWalletSignature.slice(-1)).eq('3')
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
    })
    it('should sign rfqv2 order for MMPv4', async () => {
      const ethersNetwork = await ethers.provider.getNetwork()
      const chainId = ethersNetwork.chainId
      const usdtHolder = await ethers.provider.getSigner(usdtHolders[chainId])
      const usdt = await ethers.getContractAt(ABI.IERC20, USDT[chainId])
      const [deployer, ethHolder] = await ethers.getSigners()
      const privateKey = crypto.randomBytes(32)
      const user = new ethers.Wallet(privateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      await ethHolder.sendTransaction({
        to: userAddr,
        value: ethers.utils.parseEther('10'),
      })
      const mmpSigner = Wallet.createRandom()
      console.log(`mmpSigner: ${mmpSigner.address}`)
      const mmproxy: Contract = await (
        await ethers.getContractFactory('MarketMakerProxy', deployer)
      ).deploy(mmpSigner.address)
      await usdt.connect(usdtHolder).transfer(mmproxy.address, ethers.utils.parseUnits('1000', 6))
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], AllowanceTarget[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, AllowanceTarget[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      const mockMarkerMakerConfigUpdater = new Updater({
        name: 'mockMarkerMakerConfigUpdater',
        updater() {
          return Promise.resolve({})
        },
      })
      const cacheResult = {
        mmId: 1,
        mmProxyContractAddress: mmproxy.address.toLowerCase(), // sign for v4 MMP contract
        tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
        userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: '0x085966eE3E32A0Da16467569512535D38626B547',
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
          AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
          RFQ: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
          RFQV2: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
        },
      }
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
      const signedOrderResp = await newOrder({
        walletType: WalletType.MMP_VERSION_4,
        signer: mmpSigner,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV2,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV2)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(mmproxy.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq(userAddr)
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(ZERO[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${ZERO[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(88)
      expect(sigBytes[87]).eq(SignatureType.Wallet)
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQV2
      const orderHash = getOfferSignDigest(toOffer(signedOrderResp.order), chainId, rfqAddr)
      const message = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(orderHash),
          ethUtils.toBuffer(userAddr.toLowerCase()),
          ethUtils.toBuffer(order.feeFactor > 255 ? order.feeFactor : [0, order.feeFactor]),
        ])
      )
      const v = utils.hexlify(sigBytes.slice(0, 1))
      const r = utils.hexlify(sigBytes.slice(1, 33))
      const s = utils.hexlify(sigBytes.slice(33, 65))
      const recovered = utils.verifyMessage(utils.arrayify(message), {
        v: parseInt(v),
        r: r,
        s: s,
      })
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
    }).timeout(360000)

    it('should sign rfqv2 order for a standard ERC1271 MMP contract', async () => {
      const ethersNetwork = await ethers.provider.getNetwork()
      const chainId = ethersNetwork.chainId
      const usdtHolder = await ethers.provider.getSigner(usdtHolders[chainId])
      const usdt = await ethers.getContractAt(ABI.IERC20, USDT[chainId])
      const [deployer, ethHolder] = await ethers.getSigners()
      const privateKey = crypto.randomBytes(32)
      const user = new ethers.Wallet(privateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      await ethHolder.sendTransaction({
        to: userAddr,
        value: ethers.utils.parseEther('10'),
      })
      const mmpSigner = Wallet.createRandom()
      console.log(`mmpSigner: ${mmpSigner.address}`)
      const mmproxy: Contract = await (
        await ethers.getContractFactory('MarketMakerProxy', deployer)
      ).deploy(mmpSigner.address)
      await usdt.connect(usdtHolder).transfer(mmproxy.address, ethers.utils.parseUnits('1000', 6))
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], AllowanceTarget[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, AllowanceTarget[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      const mockMarkerMakerConfigUpdater = new Updater({
        name: 'mockMarkerMakerConfigUpdater',
        updater() {
          return Promise.resolve({})
        },
      })
      const cacheResult = {
        mmId: 1,
        mmProxyContractAddress: mmproxy.address.toLowerCase(), // sign for v4 MMP contract
        tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
        userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: '0x085966eE3E32A0Da16467569512535D38626B547',
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
          AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
          RFQ: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
          RFQV2: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
        },
      }
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
      const signedOrderResp = await newOrder({
        walletType: WalletType.ERC1271_EIP712_EIP191,
        signer: mmpSigner,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV2,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV2)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(mmproxy.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq(userAddr)
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(ZERO[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${ZERO[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(66)
      expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQV2
      const orderSignDigest = getOfferSignDigest(toOffer(signedOrderResp.order), chainId, rfqAddr)
      const r = utils.hexlify(sigBytes.slice(0, 32))
      const s = utils.hexlify(sigBytes.slice(32, 64))
      const v = utils.hexlify(sigBytes.slice(64, 65))
      console.log(`r: ${r}`)
      console.log(`s: ${s}`)
      console.log(`v: ${v}`)
      const recovered = utils.verifyMessage(utils.arrayify(orderSignDigest), {
        v: parseInt(v),
        r: r,
        s: s,
      })
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
      console.log(`recovered.toLowerCase(): ${recovered.toLowerCase()}`)
      console.log(`mmpSigner.address.toLowerCase(): ${mmpSigner.address.toLowerCase()}`)
    }).timeout(360000)
    it('should sign rfqv2 order by EOA', async function () {
      const userAddr = Wallet.createRandom().address.toLowerCase()
      const signedOrderResp = await newOrder({
        walletType: WalletType.EOA,
        signer: signer,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV2,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV2)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(signer.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(
        order.makerAssetData,
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq(userAddr)
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(ZERO[chainId].toLowerCase())
      expect(
        order.takerAssetData,
        `0xf47261b0000000000000000000000000${ZERO[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(66)
      expect(sigBytes[65]).eq(SignatureType.EIP712)
      // verify signature
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQV2
      const signedOrder = toOffer(signedOrderResp.order)
      const domain = {
        name: 'Tokenlon',
        version: 'v5',
        chainId: chainId,
        verifyingContract: rfqAddr,
      }
      // The named list of all type definitions
      const types = {
        Offer: [
          { name: 'taker', type: 'address' },
          { name: 'maker', type: 'address' },
          { name: 'takerToken', type: 'address' },
          { name: 'takerTokenAmount', type: 'uint256' },
          { name: 'makerToken', type: 'address' },
          { name: 'makerTokenAmount', type: 'uint256' },
          { name: 'feeFactor', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
        ],
      }
      // The data to sign
      const value = {
        taker: signedOrder.taker,
        maker: signedOrder.maker,
        takerToken: signedOrder.takerToken,
        takerTokenAmount: signedOrder.takerTokenAmount.toString(),
        makerToken: signedOrder.makerToken,
        makerTokenAmount: signedOrder.makerTokenAmount.toString(),
        feeFactor: signedOrder.feeFactor.toString(),
        expiry: signedOrder.expiry.toString(),
        salt: signedOrder.salt.toString(),
      }
      const recovered = ethers.utils.verifyTypedData(
        domain,
        types,
        value,
        signedOrderResp.order.makerWalletSignature.slice(0, -2)
      )
      expect(recovered.toLowerCase()).eq(signer.address.toLowerCase())
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
    })
    it('should sign rfqv1 order for MMPv4', async () => {
      const ethersNetwork = await ethers.provider.getNetwork()
      const chainId = ethersNetwork.chainId
      const usdtHolder = await ethers.provider.getSigner(usdtHolders[chainId])
      const usdt = await ethers.getContractAt(ABI.IERC20, USDT[chainId])
      const [deployer, ethHolder] = await ethers.getSigners()
      const privateKey = crypto.randomBytes(32)
      const user = new ethers.Wallet(privateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      await ethHolder.sendTransaction({
        to: userAddr,
        value: ethers.utils.parseEther('10'),
      })
      const mmpSigner = Wallet.createRandom()
      console.log(`mmpSigner: ${mmpSigner.address}`)
      const mmproxy: Contract = await (
        await ethers.getContractFactory('MarketMakerProxy', deployer)
      ).deploy(mmpSigner.address)
      await usdt.connect(usdtHolder).transfer(mmproxy.address, ethers.utils.parseUnits('1000', 6))
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], AllowanceTarget[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, AllowanceTarget[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      const mockMarkerMakerConfigUpdater = new Updater({
        name: 'mockMarkerMakerConfigUpdater',
        updater() {
          return Promise.resolve({})
        },
      })
      const cacheResult = {
        mmId: 1,
        mmProxyContractAddress: mmproxy.address.toLowerCase(), // sign for v4 MMP contract
        tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
        userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: '0x085966eE3E32A0Da16467569512535D38626B547',
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
          AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
          RFQ: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
          RFQV2: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
        },
      }
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
      const signedOrderResp = await newOrder({
        walletType: WalletType.MMP_VERSION_4,
        signer: mmpSigner,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV1,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV1)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(mmproxy.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq(userAddr)
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(88)
      expect(sigBytes[87]).eq(SignatureType.Wallet)
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQ
      const orderHash = getOrderSignDigest(toRFQOrder(signedOrderResp.order), chainId, rfqAddr)
      const message = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(orderHash),
          ethUtils.toBuffer(userAddr.toLowerCase()),
          ethUtils.toBuffer(order.feeFactor > 255 ? order.feeFactor : [0, order.feeFactor]),
        ])
      )
      const v = utils.hexlify(sigBytes.slice(0, 1))
      const r = utils.hexlify(sigBytes.slice(1, 33))
      const s = utils.hexlify(sigBytes.slice(33, 65))
      const recovered = utils.verifyMessage(utils.arrayify(message), {
        v: parseInt(v),
        r: r,
        s: s,
      })
      console.log(`recovered: ${recovered}`)
      console.log(`mmpSigner.address: ${mmpSigner.address}`)
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
    }).timeout(360000)
    it('should sign rfqv1 order for a standard ERC1271 MMP contract', async () => {
      const ethersNetwork = await ethers.provider.getNetwork()
      const chainId = ethersNetwork.chainId
      const usdtHolder = await ethers.provider.getSigner(usdtHolders[chainId])
      const usdt = await ethers.getContractAt(ABI.IERC20, USDT[chainId])
      const [deployer, ethHolder] = await ethers.getSigners()
      const privateKey = crypto.randomBytes(32)
      const user = new ethers.Wallet(privateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      await ethHolder.sendTransaction({
        to: userAddr,
        value: ethers.utils.parseEther('10'),
      })
      const mmpSigner = Wallet.createRandom()
      console.log(`mmpSigner: ${mmpSigner.address}`)
      const mmproxy: Contract = await (
        await ethers.getContractFactory('MarketMakerProxy', deployer)
      ).deploy(mmpSigner.address)
      await usdt.connect(usdtHolder).transfer(mmproxy.address, ethers.utils.parseUnits('1000', 6))
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], AllowanceTarget[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, AllowanceTarget[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      const mockMarkerMakerConfigUpdater = new Updater({
        name: 'mockMarkerMakerConfigUpdater',
        updater() {
          return Promise.resolve({})
        },
      })
      const cacheResult = {
        mmId: 1,
        mmProxyContractAddress: mmproxy.address.toLowerCase(), // sign for v4 MMP contract
        tokenlonExchangeContractAddress: '0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491',
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b',
        userProxyContractAddress: '0x25657705a6be20511687d483f2fccfb2d92f6033',
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: '0x085966eE3E32A0Da16467569512535D38626B547',
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257',
          AMMWrapper: '0xCF011536f10e85e376E70905EED4CA9eA8Cded34',
          RFQ: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
          RFQV2: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
        },
      }
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
      const signedOrderResp = await newOrder({
        walletType: WalletType.ERC1271_EIP712_EIP191,
        signer: mmpSigner,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV1,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV1)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(mmproxy.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(order.makerAssetData).eq(
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(order.takerAddress).eq(userAddr)
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(order.takerAssetData).eq(
        `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq('0xd489f1684cf5e78d933e254bd7ac8a9a6a70d491')
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(66)
      expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQ
      const orderSignDigest = getOrderSignDigest(toRFQOrder(signedOrderResp.order), chainId, rfqAddr)
      const r = utils.hexlify(sigBytes.slice(0, 32))
      const s = utils.hexlify(sigBytes.slice(32, 64))
      const v = utils.hexlify(sigBytes.slice(64, 65))
      console.log(`r: ${r}`)
      console.log(`s: ${s}`)
      console.log(`v: ${v}`)
      const recovered = utils.verifyMessage(utils.arrayify(orderSignDigest), {
        v: parseInt(v),
        r: r,
        s: s,
      })
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
      console.log(`recovered.toLowerCase(): ${recovered.toLowerCase()}`)
      console.log(`mmpSigner.address.toLowerCase(): ${mmpSigner.address.toLowerCase()}`)
    }).timeout(360000)
    it('should sign rfqv1 order by EOA', async function () {
      const userAddr = Wallet.createRandom().address.toLowerCase()
      const signedOrderResp = await newOrder({
        walletType: WalletType.EOA,
        signer: signer,
        chainID: chainId,
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
          userAddr: userAddr,
          protocol: Protocol.RFQV1,
        },
      })
      expect(signedOrderResp).is.not.null
      // verify data object
      const order = signedOrderResp.order
      console.log(order)
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV1)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(signer.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq('0xdac17f958d2ee523a2206206994597c13d831ec7')
      expect(
        order.makerAssetData,
        '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7'
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
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(66)
      expect(sigBytes[65]).eq(SignatureType.EIP712)
      // verify signature
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQ
      const signedOrder = toRFQOrder(signedOrderResp.order)
      const domain = {
        name: 'Tokenlon',
        version: 'v5',
        chainId: chainId,
        verifyingContract: rfqAddr,
      }
      // The named list of all type definitions
      const types = {
        Order: [
          { name: 'takerAddr', type: 'address' },
          { name: 'makerAddr', type: 'address' },
          { name: 'takerAssetAddr', type: 'address' },
          { name: 'makerAssetAddr', type: 'address' },
          { name: 'takerAssetAmount', type: 'uint256' },
          { name: 'makerAssetAmount', type: 'uint256' },
          { name: 'salt', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
          { name: 'feeFactor', type: 'uint256' },
        ],
      }
      // The data to sign
      const value = {
        takerAddr: signedOrder.takerAddr,
        makerAddr: signedOrder.makerAddr,
        takerAssetAddr: signedOrder.takerAssetAddr,
        makerAssetAddr: signedOrder.makerAssetAddr,
        takerAssetAmount: signedOrder.takerAssetAmount.toString(),
        makerAssetAmount: signedOrder.makerAssetAmount.toString(),
        salt: signedOrder.salt.toString(),
        deadline: signedOrder.deadline.toString(),
        feeFactor: signedOrder.feeFactor.toString(),
      }
      const recovered = ethers.utils.verifyTypedData(
        domain,
        types,
        value,
        signedOrderResp.order.makerWalletSignature.slice(0, -2)
      )
      expect(recovered.toLowerCase()).eq(signer.address.toLowerCase())
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
    })
  })
  describe('handle token precision and decimals', () => {
    it('should format taker asset amount', async function () {
      const signedOrderResp = await newOrder({
        walletType: WalletType.MMP_VERSION_4,
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
      expect(signedOrderResp).is.not.null
      expect(signedOrderResp.order.quoteId).eq('1--echo-testing-8888')
      expect(signedOrderResp.order.makerWalletSignature.slice(-1)).eq('4')
      expect(signedOrderResp.order.takerAssetData.slice(34)).eq(
        'dac17f958d2ee523a2206206994597c13d831ec7'
      )
      expect(signedOrderResp.order.takerAssetAmount).eq(utils.parseUnits('0.122539', 6).toString())
      expect(signedOrderResp.order.makerAssetAmount).eq(utils.parseEther('0.1114').toString())
    })
    it('should format maker asset amount', async function () {
      const signedOrderResp = await newOrder({
        walletType: WalletType.MMP_VERSION_4,
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
      expect(signedOrderResp).is.not.null
      expect(signedOrderResp.order.quoteId).eq('1--echo-testing-8888')
      expect(signedOrderResp.order.makerWalletSignature.slice(-1)).eq('4')
      expect(signedOrderResp.order.takerAssetAmount).eq(utils.parseEther('0.1111').toString())
      expect(signedOrderResp.order.makerAssetAmount).eq(utils.parseUnits('0.12221', 6).toString())
    })
  })
  it('test get RFQ order hash', () => {
    const rfqAddr = '0x6b6D3C4EF634731E17d31d0D6017ba9DB4775955'
    const order = {
      takerAddr: '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69',
      makerAddr: '0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64',
      takerAssetAddr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      makerAssetAddr: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      takerAssetAmount: new BigNumber('0x0de0b6b3a7640000'),
      makerAssetAmount: new BigNumber('0x05f5e100'),
      salt: new BigNumber('0x44df74b1c54e9792989c61fedcef6f94b534b58933cde70bc456ec74cf4d3610'),
      deadline: 1620444917,
      feeFactor: 30,
    }
    const orderHash = getOrderSignDigest(order, 1, rfqAddr)
    expect(orderHash).eq('0x8d70993864d87daa0b2bae0c2be1c56067f45363680d0dca8657e1e51d1d6a40')
  })
  it('Should forward unsigned orders to signing service', async () => {
    // const url = `http://localhost:3000`
    const rfqAddr = '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0'
    const order = {
      takerAddress: '0x6813Eb9362372EEF6200f3b1dbC3f819671cBA69',
      makerAddress: '0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64',
      takerAssetAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      makerAssetAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      takerAssetAmount: new BigNumber('0x0de0b6b3a7640000'),
      makerAssetAmount: new BigNumber('0x05f5e100'),
      salt: new BigNumber('0x44df74b1c54e9792989c61fedcef6f94b534b58933cde70bc456ec74cf4d3610'),
      expirationTimeSeconds: 1620444917,
      feeFactor: 30,
    }
    const signedOrder = await buildSignedOrder(
      signer,
      order,
      Wallet.createRandom().address.toLowerCase(),
      chainId,
      rfqAddr,
      WalletType.MMP_VERSION_4,
      {
        salt: '0x11111111111111111111111111111111',
      }
    )
    console.log(signedOrder)
    expect(signedOrder).not.null
  })
  it('Should generate correct salt', async () => {
    const givenPrefixSalt = generateSaltWithFeeFactor(30, '0x11111111111111111111111111111111')
    const salt = generateSaltWithFeeFactor(30)
    console.log(givenPrefixSalt.toString(16))
    console.log(salt.toString(16))
    expect(givenPrefixSalt.toString(16).length).is.eq(64)
    expect(salt.toString(16).length).is.eq(64)
  })
})
