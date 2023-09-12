import { ethers, network } from 'hardhat'
import { Wallet, utils, Contract } from 'ethers'
import { newOrder } from '../src/handler'
import { updaterStack, Updater } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'
import { Protocol } from '../src/types'
import { toRFQOrder } from '../src/signer/rfqv1'
import { buildSignedOrder as buildPMMV5SignedOrder } from '../src/signer/pmmv5'
import { buildSignedOrder as buildRFQV1SignedOrder } from '../src/signer/rfqv1'
import { buildSignedOrder as buildRFQV2SignedOrder } from '../src/signer/rfqv2'
import { ExtendedZXOrder, PermitType, SignatureType, WalletType } from '../src/signer/types'
import { getOrderSignDigest, getOfferSignDigest } from '../src/signer/orderHash'
import { BigNumber, toBN } from '../src/utils'
import * as ethUtils from 'ethereumjs-util'
import { AllowanceTarget, USDT, ABI, WETH, ZERO } from '@tokenlon/sdk'
import * as crypto from 'crypto'
import { expect } from 'chai'
import { generateSaltWithFeeFactor } from '../src/signer/pmmv5'
import { toOffer } from '../src/signer/rfqv2'
import { assetDataUtils } from '0x-v2-order-utils'
import * as nock from 'nock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

const RFQV2: Record<number, string> = {
  1: '0x91C986709Bb4fE0763edF8E2690EE9d5019Bea4a',
  5: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
}

const RFQV1: Record<number, string> = {
  1: '0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F',
  5: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
}

const usdtHolders = {
  1: '0x15abb66bA754F05cBC0165A64A11cDed1543dE48',
  5: '0x031BBFB9379c4e6E3F42fb93a9f09C060c7fA037',
}

const USDT_ADDRESS: Record<number, string> = {
  1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  5: '0xa93Ef9215b907c19e739E2214e1AA5412a0401B5',
}

const IS_VALID_SIGNATURE = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_signerAddress',
        type: 'address',
      },
      {
        internalType: 'bytes32',
        name: '_hash',
        type: 'bytes32',
      },
      {
        internalType: 'bytes',
        name: '_data',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: '_sig',
        type: 'bytes',
      },
    ],
    name: 'isValidSignature',
    outputs: [
      {
        internalType: 'bool',
        name: 'isValid',
        type: 'bool',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

const replaceMarketMakingAddress = (chainId: number, address: string, updaterStack) => {
  const mockMarkerMakerConfigUpdater = new Updater({
    name: 'mockMarkerMakerConfigUpdater',
    updater() {
      return Promise.resolve({})
    },
  })
  const cacheResult = {
    mmId: 1,
    mmProxyContractAddress: address.toLowerCase(),
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
      RFQ: RFQV1[chainId],
      RFQV2: RFQV2[chainId],
    },
  }
  mockMarkerMakerConfigUpdater.cacheResult = cacheResult
  updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater
}

describe('NewOrder', function () {
  let signer: SignerWithAddress
  let chainId: number
  let rfqv1: Contract
  let rfqv2: Contract
  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
    const networkInfo = await ethers.provider.getNetwork()
    chainId = networkInfo.chainId
    const usdtHolderAddr = usdtHolders[chainId]
    rfqv1 = new ethers.Contract(RFQV1[chainId], IS_VALID_SIGNATURE, ethers.provider)
    rfqv2 = new ethers.Contract(RFQV2[chainId], IS_VALID_SIGNATURE, ethers.provider)
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
        RFQ: RFQV1[chainId],
        RFQV2: RFQV2[chainId],
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
        contractAddress: USDT_ADDRESS[chainId],
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
      expect(order.makerWalletSignature.length).eq(40)
      // verify random values
      expect(order.salt.length > 0).is.true
      expect(Number(order.expirationTimeSeconds) > 0).is.true
    })
    it('should create ammv2 order by uniswap v2', async function () {
      const ammAddr = '0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852'
      const payload = Buffer.from(
        JSON.stringify({
          path: [WETH[chainId].toLowerCase(), USDT_ADDRESS[chainId].toLowerCase()],
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      // approve tokens to RFQV2 contract directly
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], RFQV2[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, RFQV2[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      const rfqAddr = RFQV2[chainId]
      const orderSignDigest = getOfferSignDigest(toOffer(signedOrderResp.order), chainId, rfqAddr)
      const message = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(orderSignDigest),
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
      const result = await rfqv2.callStatic.isValidSignature(
        mmproxy.address,
        orderSignDigest,
        '0x',
        order.makerWalletSignature
      )
      expect(result).true
    }).timeout(360000)

    it('should sign rfqv2 order for a ERC1271_EIP712_EIP191 MMP contract', async () => {
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
      // approve tokens to RFQV2 contract directly
      await mmproxy.connect(deployer).setAllowance([USDT[chainId]], RFQV2[chainId])
      const mmproxyUsdtBalance = await usdt.balanceOf(mmproxy.address)
      const mmproxyUsdtAllowance = await usdt.allowance(mmproxy.address, RFQV2[chainId])
      console.log(`mmproxyUsdtBalance: ${ethers.utils.formatUnits(mmproxyUsdtBalance, 6)}`)
      console.log(`mmproxyUsdtAllowance: ${ethers.utils.formatUnits(mmproxyUsdtAllowance, 6)}`)
      console.log(`mmproxy: ${mmproxy.address}`)
      expect(mmproxy.address).is.not.null
      replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      const rfqAddr = RFQV2[chainId]
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
      // TODO: test with a real ERC1271 wallet contract
    }).timeout(360000)
    it('should sign rfqv2 order by EIP712', async function () {
      replaceMarketMakingAddress(chainId, signer.address, updaterStack)
      const userAddr = Wallet.createRandom().address.toLowerCase()
      const usdt = new ethers.Contract(USDT[chainId], ABI.IERC20, ethers.provider)
      await usdt.connect(signer).approve(RFQV2[chainId], ethers.constants.MaxUint256)
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(
        order.makerAssetData,
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      const rfqAddr = RFQV2[chainId]
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
      console.log(`sig: ${signedOrderResp.order.makerWalletSignature}`)
      expect(recovered.toLowerCase()).eq(signer.address.toLowerCase())
      const result = await rfqv2.callStatic.isValidSignature(
        signer.address,
        getOfferSignDigest(toOffer(signedOrderResp.order), chainId, RFQV2[chainId]),
        '0x',
        order.makerWalletSignature
      )
      expect(result).true

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
      replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      const rfqAddr = RFQV1[chainId]
      const orderSignDigest = getOrderSignDigest(
        toRFQOrder(signedOrderResp.order),
        chainId,
        rfqAddr
      )
      const message = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(orderSignDigest),
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
      const result = await rfqv1.callStatic.isValidSignature(
        mmproxy.address,
        orderSignDigest,
        '0x',
        order.makerWalletSignature
      )
      console.log(`result: ${result}`)
      expect(result).true
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
      replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
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
      expect(order.makerAssetAddress).eq(USDT_ADDRESS[chainId].toLowerCase())
      expect(order.makerAssetData).eq(
        `0xf47261b0000000000000000000000000${USDT_ADDRESS[chainId].toLowerCase().slice(2)}`
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
      const rfqAddr = RFQV1[chainId]
      const orderSignDigest = getOrderSignDigest(
        toRFQOrder(signedOrderResp.order),
        chainId,
        rfqAddr
      )
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
      // TODO: call isValidSignature with a real ERC1271 wallet contract
    }).timeout(360000)
    it('should sign rfqv1 order by EIP712', async function () {
      replaceMarketMakingAddress(chainId, signer.address, updaterStack)
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
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(98)
      expect(sigBytes[97]).eq(SignatureType.EIP712)
      // verify signature
      const rfqAddr = RFQV1[chainId]
      const orderSignDigest = getOrderSignDigest(
        toRFQOrder(signedOrderResp.order),
        chainId,
        rfqAddr
      )
      const result = await rfqv1.callStatic.isValidSignature(
        signer.address,
        orderSignDigest,
        '0x',
        order.makerWalletSignature
      )
      console.log(`result: ${result}`)
      expect(result).true
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
        USDT_ADDRESS[chainId].toLowerCase().slice(2)
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
  it('Should forward unsigned PMMV5 orders to signing service', async () => {
    const url = `http://localhost:3000`
    const pmm = '0x8D90113A1e286a5aB3e496fbD1853F265e5913c6'
    const order: ExtendedZXOrder = {
      protocol: Protocol.PMMV5,
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
    const signedOrder = await buildPMMV5SignedOrder(
      undefined,
      order,
      Wallet.createRandom().address.toLowerCase(),
      chainId,
      pmm,
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
  it('Should forward unsigned RFQV2 orders to signing service', async () => {
    const url = `http://localhost:3000`
    const rfqV2Addr = RFQV2[chainId]
    const order: ExtendedZXOrder = {
      protocol: Protocol.RFQV2,
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
    const signedOrder = await buildRFQV2SignedOrder(
      undefined,
      order,
      Wallet.createRandom().address.toLowerCase(),
      chainId,
      rfqV2Addr,
      WalletType.MMP_VERSION_4,
      PermitType.ALLOWANCE_TARGET,
      {
        signingUrl: url,
        salt: '0x11111111111111111111111111111111',
      }
    )
    scope.done()
    expect(signedOrder).not.null
    expect(signedOrder.makerWalletSignature).not.null
    expect(signedOrder.makerWalletSignature).eq(defaultSignature)
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
