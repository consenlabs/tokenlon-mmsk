import { ethers } from 'hardhat'
import { BigNumber } from '0x-v2-utils'
import { Order as ZXOrder } from '0x-v2-order-utils'
import { Updater } from '../src/worker'
import { WETH } from '@tokenlon/sdk'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, Wallet } from 'ethers'
import { Protocol } from '../src/types'
import { WalletType } from '../src/signer/types'
import { Order, newOrder } from '../src/handler/newOrder'
import { updaterStack } from '../src/worker'
import { NULL_ADDRESS } from '../src/constants'

export const WALLET_TYPE_MAGIC_VALUE = ethers.utils.keccak256(
  Buffer.from('isValidWalletSignature(bytes32,address,bytes)')
)

export const RFQV2: Record<number, string> = {
  1: '0x91C986709Bb4fE0763edF8E2690EE9d5019Bea4a',
  5: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7',
}

export const RFQV1: Record<number, string> = {
  1: '0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F',
  5: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0',
}

export const usdtHolders = {
  1: '0x15abb66bA754F05cBC0165A64A11cDed1543dE48',
  5: '0x031BBFB9379c4e6E3F42fb93a9f09C060c7fA037',
}

export const USDT_ADDRESS: Record<number, string> = {
  1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  5: '0xa93ef9215b907c19e739e2214e1aa5412a0401b5',
}

export const replaceMarketMakingAddress = (
  chainId: number,
  address: string,
  updaterStack: Record<string, Updater>
): void => {
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

export const callNewOrder = async ({
  chainId,
  base,
  quote,
  side,
  amount,
  signer,
  userAddr,
  protocol,
  walletType,
  makerAddress,
  payload,
}: {
  chainId: number
  base: string
  quote: string
  side: 'SELL' | 'BUY'
  amount: number
  signer: SignerWithAddress | Wallet
  userAddr: string
  protocol: Protocol | string
  walletType?: WalletType
  makerAddress?: string
  payload?: string
}): Promise<Order> => {
  const signedOrderResp = await newOrder({
    walletType: walletType,
    signer: signer,
    chainID: chainId,
    quoter: {
      getPrice: () => {
        return Promise.resolve({
          result: true,
          exchangeable: true,
          minAmount: 0,
          maxAmount: 1000,
          makerAddress: makerAddress,
          price: 1,
          quoteId: 'echo-testing-8888',
          payload: payload,
        })
      },
    },
    query: {
      base: base,
      quote: quote,
      side: side,
      amount: amount,
      uniqId: 'testing-1111',
      userAddr: userAddr,
      protocol: protocol,
    },
  })
  return signedOrderResp.order as Order
}

export const deployMMPV4Wallet = async (
  mmpSigner: SignerWithAddress | Wallet,
  deployer: SignerWithAddress | Wallet
): Promise<Contract> => {
  const mmproxy: Contract = await (
    await ethers.getContractFactory('MarketMakerProxy', deployer)
  ).deploy(mmpSigner.address)
  return mmproxy
}

export const deployERC1271Wallet = async (
  allowSigner: SignerWithAddress | Wallet,
  deployer: SignerWithAddress | Wallet
): Promise<Contract> => {
  const erc1271Wallet: Contract = await (
    await ethers.getContractFactory('EIP1271Wallet', deployer)
  ).deploy(allowSigner.address)
  return erc1271Wallet
}

export const deployEIP1271Plus191Wallet = async (
  allowSigner: SignerWithAddress | Wallet,
  deployer: SignerWithAddress | Wallet
): Promise<Contract> => {
  const erc1271Plus191Wallet: Contract = await (
    await ethers.getContractFactory('EIP1271Plus191Wallet', deployer)
  ).deploy(allowSigner.address)
  return erc1271Plus191Wallet
}

export const toZXOrder = (order: Order): ZXOrder => {
  const o: ZXOrder = {
    makerAddress: order.makerAddress,
    makerAssetAmount: new BigNumber(order.makerAssetAmount),
    makerAssetData: order.makerAssetData,
    makerFee: new BigNumber(order.makerFee),
    takerAddress: order.takerAddress,
    takerAssetAmount: new BigNumber(order.takerAssetAmount),
    takerAssetData: order.takerAssetData,
    takerFee: new BigNumber(order.takerFee),
    senderAddress: order.senderAddress,
    feeRecipientAddress: order.feeRecipientAddress,
    expirationTimeSeconds: new BigNumber(order.expirationTimeSeconds),
    exchangeAddress: order.exchangeAddress,
    salt: new BigNumber(order.salt!.toString()),
  }
  return o
}

export const init = (chainId: number, signer: SignerWithAddress | Wallet): void => {
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
}
