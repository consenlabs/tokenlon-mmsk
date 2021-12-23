import { ethers } from 'hardhat'
import { Wallet, utils, Contract } from 'ethers'
import { newOrder } from '../src/handler'
import { updaterStack, Updater } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'
import { Protocol } from '../src/types'
import { SignatureType, toRFQOrder } from '../src/signer/rfqv1'
import { getOrderSignDigest } from '../src/signer/orderHash'
import * as ethUtils from 'ethereumjs-util'
import {
  Signer as TokenlonSigner,
  AllowanceTarget,
  USDT,
  ABI,
  WETH,
  Tokenlon,
  RFQ,
  UserProxy,
  AMMWrapper,
} from '@tokenlon/sdk'
import { expect } from 'chai'
import * as dotenv from 'dotenv'
dotenv.config()

const userPrivateKey = process.env.USER_KEY
const mmpSignerPrivateKey = process.env.MMP_SIGNER_KEY
const mmpContractAddress = process.env.MMP_CONTRACT_ADDRESS

console.log(`userPrivateKey: ${userPrivateKey}`)

console.log(`mmpContractAddress: ${mmpContractAddress}`)

describe('NewOrder', function () {
  let chainId: number
  let usdt: Contract

  before(async () => {
    const network = await ethers.provider.getNetwork()
    chainId = network.chainId
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
      mmProxyContractAddress: mmpContractAddress.toLowerCase(),
      tokenlonExchangeContractAddress: Tokenlon[chainId].toLowerCase(),
      exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b'.toLowerCase(),
      userProxyContractAddress: UserProxy[chainId].toLowerCase(),
      wethContractAddress: WETH[chainId].toLowerCase(),
      orderExpirationSeconds: 600,
      feeFactor: 30,
      addressBookV5: {
        Tokenlon: Tokenlon[chainId].toLowerCase(),
        PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257'.toLowerCase(),
        AMMWrapper: AMMWrapper[chainId].toLowerCase(),
        RFQ: RFQ[chainId].toLowerCase(),
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
        contractAddress: NULL_ADDRESS.toLowerCase(),
        decimal: 18,
        precision: 4,
        minTradeAmount: 0.01,
        maxTradeAmount: 10,
      },
      {
        symbol: 'USDT',
        contractAddress: USDT[chainId].toLowerCase(),
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

  describe('Dispatch to protocol signer', function () {
    it('Should use specifc private key signing rfqv1 order for MMP contract', async () => {
      const ethersNetwork = await ethers.provider.getNetwork()
      const chainId = ethersNetwork.chainId
      usdt = await ethers.getContractAt(ABI.IERC20, USDT[chainId])
      const [ ethHolder ] = await ethers.getSigners()
      const user = new ethers.Wallet(userPrivateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      console.log(`userAddr: ${userAddr}`)
      await ethHolder.sendTransaction({
        to: userAddr,
        value: ethers.utils.parseEther('10')
      })
      const mmproxy = {
        address: mmpContractAddress
      }
      const mmpSigner = new Wallet(mmpSignerPrivateKey, ethers.provider)
      console.log(`mmpSigner: ${mmpSigner.address}`)
      // @ts-ignore
      // await mmproxy.connect(deployer).setAllowance([USDT[chainId]], AllowanceTarget[chainId])
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
        tokenlonExchangeContractAddress: Tokenlon[chainId].toLowerCase(),
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b'.toLowerCase(),
        userProxyContractAddress: UserProxy[chainId].toLowerCase(),
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: Tokenlon[chainId].toLowerCase(),
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257'.toLowerCase(),
          AMMWrapper: AMMWrapper[chainId].toLowerCase(),
          RFQ: RFQ[chainId].toLowerCase(),
        },
      }
      console.log(`mmproxy.address: ${mmproxy.address.toLowerCase()}`)
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater

      const signedOrderResp = await newOrder({
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
      console.log(`order.makerAddress: ${order.makerAddress.toLowerCase()}`)
      expect(order.makerAddress).eq(mmproxy.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq(USDT[chainId].toLowerCase())
      expect(order.makerAssetData).eq(`0xf47261b0000000000000000000000000${USDT[chainId].toLowerCase().slice(2)}`)
      expect(order.takerAddress).eq(userAddr.toLowerCase())
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(order.takerAssetData).eq(`0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`)
      expect(order.senderAddress).eq(Tokenlon[chainId].toLowerCase())
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7'.toLowerCase())
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b'.toLowerCase())
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
      const orderSignDigest = getOrderSignDigest(toRFQOrder(signedOrderResp.order), chainId, rfqAddr)
      console.log(`orderSignDigest: ${orderSignDigest}`)
      const message = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(orderSignDigest),
          ethUtils.toBuffer(user.address.toLowerCase()),
          ethUtils.toBuffer(order.feeFactor > 255 ? order.feeFactor : [0, order.feeFactor]),
        ])
      )
      const v = utils.hexlify(sigBytes.slice(0, 1))
      const r = utils.hexlify(sigBytes.slice(1, 33))
      const s = utils.hexlify(sigBytes.slice(33, 65))
      const recovered = utils.verifyMessage(
        utils.arrayify(message), {
          v: parseInt(v),
          r: r,
          s: s
        }
      )
      let sig = await mmpSigner.signMessage(utils.arrayify(message))
      const vrs = await ethers.utils.splitSignature(sig)
      sig = `0x${vrs.v.toString(16)}${vrs.r.slice(2)}${vrs.s.slice(2)}`
      const walletSign = ethUtils.bufferToHex(
        Buffer.concat([
          ethUtils.toBuffer(utils.arrayify(sig)).slice(0, 65),
          ethUtils.toBuffer(userAddr.toLowerCase()),
          ethUtils.toBuffer(order.feeFactor > 255 ? order.feeFactor : [0, order.feeFactor]),
          ethUtils.toBuffer(SignatureType.Wallet),
        ])
      )
      console.log(`walletSign: ${walletSign}`)
      expect(walletSign).eq(order.makerWalletSignature)
      console.log(`recovered: ${recovered.toLowerCase()}`)
      console.log(`mmpSigner.address: ${mmpSigner.address.toLowerCase()}`)
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
      console.log(`recovered === mmpSigner.address`)
      const tokenlonSigner = new TokenlonSigner(user)
      const signResult = await tokenlonSigner.signOrder(order, {
        receiverAddress: user.address
      })
      console.log(`signResult`)
      console.log(signResult)
      const userUsdtBalanceBefore = await usdt.balanceOf(user.address)
      const txRequest = await tokenlonSigner.getRawTransactionFromOrder(signResult, {
        receiverAddress: user.address,
      }, {
        gasLimit: '1000000',
        maxFeePerGas: '100000000000',
        maxPriorityFeePerGas: '5000000000',
      })
      console.log(`txRequest:`)
      console.log(txRequest)
      const tx = await tokenlonSigner.sendTransaction(txRequest)
      console.log(tx)
      const receipt = await tx.wait()
      console.log(receipt)
      const userUsdtBalanceAfter = await usdt.balanceOf(user.address)
      console.log(`user got ${ethers.utils.formatUnits(userUsdtBalanceAfter.sub(userUsdtBalanceBefore), 6)} usdt`)
      expect(Number(userUsdtBalanceAfter.sub(userUsdtBalanceBefore))).gt(0)
    }).timeout(360000)

    it('Should sign rfqv1 order by EOA', async function () {
      const user = new ethers.Wallet(userPrivateKey, ethers.provider)
      const userAddr = user.address.toLowerCase()
      const mmpSigner = new Wallet(mmpSignerPrivateKey, ethers.provider)
      const mockMarkerMakerConfigUpdater = new Updater({
        name: 'mockMarkerMakerConfigUpdater',
        updater() {
          return Promise.resolve({})
        },
      })
      const cacheResult = {
        mmId: 1,
        mmProxyContractAddress: mmpSigner.address.toLowerCase(), // sign for v4 MMP contract
        tokenlonExchangeContractAddress: Tokenlon[chainId].toLowerCase(),
        exchangeContractAddress: '0x30589010550762d2f0d06f650d8e8b6ade6dbf4b'.toLowerCase(),
        userProxyContractAddress: UserProxy[chainId].toLowerCase(),
        wethContractAddress: WETH[chainId].toLowerCase(),
        orderExpirationSeconds: 600,
        feeFactor: 30,
        addressBookV5: {
          Tokenlon: Tokenlon[chainId].toLowerCase(),
          PMM: '0x7bd7d025D4231aAD1233967b527FFd7416410257'.toLowerCase(),
          AMMWrapper: AMMWrapper[chainId].toLowerCase(),
          RFQ: RFQ[chainId].toLowerCase(),
        },
      }
      console.log(`mmpSigner.address: ${mmpSigner.address.toLowerCase()}`)
      mockMarkerMakerConfigUpdater.cacheResult = cacheResult
      updaterStack['markerMakerConfigUpdater'] = mockMarkerMakerConfigUpdater

      const signedOrderResp = await newOrder({
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
      expect(order).is.not.null
      expect(order.protocol).eq(Protocol.RFQV1)
      expect(order.quoteId).eq('1--echo-testing-8888')
      expect(order.makerAddress).eq(mmpSigner.address.toLowerCase())
      expect(order.makerAssetAmount).eq('100000')
      expect(order.makerAssetAddress).eq(USDT[chainId].toLowerCase())
      expect(
        order.makerAssetData,
        `0xf47261b0000000000000000000000000${USDT[chainId].toLowerCase().slice(2)}`
      )
      expect(order.takerAddress).eq(userAddr.toLowerCase())
      expect(order.takerAssetAmount).eq('100000000000000000')
      expect(order.takerAssetAddress).eq(WETH[chainId].toLowerCase())
      expect(
        order.takerAssetData,
        `0xf47261b0000000000000000000000000${WETH[chainId].toLowerCase().slice(2)}`
      )
      expect(order.senderAddress).eq(Tokenlon[chainId].toLowerCase())
      expect(order.feeRecipientAddress).eq('0xb9e29984fe50602e7a619662ebed4f90d93824c7')
      expect(order.exchangeAddress).eq('0x30589010550762d2f0d06f650d8e8b6ade6dbf4b')
      // The following fields are to be compatible `Order` struct.
      expect(order.makerFee).eq('0')
      expect(order.takerFee).eq('0')
      // verify signature type
      const sigBytes = utils.arrayify(signedOrderResp.order.makerWalletSignature)
      expect(sigBytes.length).eq(98)
      expect(sigBytes[97]).eq(SignatureType.EthSign)
      // verify signature
      const rfqAddr = updaterStack['markerMakerConfigUpdater'].cacheResult.addressBookV5.RFQ
      const orderHash = getOrderSignDigest(toRFQOrder(signedOrderResp.order), chainId, rfqAddr)
      const recovered = utils.verifyMessage(
        utils.arrayify(orderHash),
        utils.hexlify(sigBytes.slice(0, 65)),
      )
      expect(recovered.toLowerCase()).eq(mmpSigner.address.toLowerCase())
      // verify random values
      expect(signedOrderResp.order.salt.length > 0).is.true
      expect(Number(signedOrderResp.order.expirationTimeSeconds) > 0).is.true
      const tokenlonSigner = new TokenlonSigner(user)
      const signResult = await tokenlonSigner.signOrder(order, {
        receiverAddress: user.address
      })
      console.log(`signResult`)
      console.log(signResult)
      const userUsdtBalanceBefore = await usdt.balanceOf(user.address)
      const txRequest = await tokenlonSigner.getRawTransactionFromOrder(signResult, {
        receiverAddress: user.address,
      }, {
        gasLimit: '1000000',
        maxFeePerGas: '100000000000',
        maxPriorityFeePerGas: '5000000000',
      })
      console.log(`txRequest:`)
      console.log(txRequest)
      const tx = await tokenlonSigner.sendTransaction(txRequest)
      console.log(tx)
      const receipt = await tx.wait()
      console.log(receipt)
      const userUsdtBalanceAfter = await usdt.balanceOf(user.address)
      console.log(`user got ${ethers.utils.formatUnits(userUsdtBalanceAfter.sub(userUsdtBalanceBefore), 6)} usdt`)
      expect(Number(userUsdtBalanceAfter.sub(userUsdtBalanceBefore))).gt(0)
    }).timeout(360000)
  })
})
