import { ethers, network } from 'hardhat'
import { Wallet, utils, Contract } from 'ethers'
import { updaterStack } from '../src/worker'
import { Protocol } from '../src/types'
import { buildSignedOrder as buildRFQV2SignedOrder } from '../src/signer/rfqv2'
import { ExtendedZXOrder, PermitType, SignatureType, WalletType } from '../src/signer/types'
import { getOfferSignDigest } from '../src/signer/orderHash'
import { BigNumber, toBN } from '../src/utils'
import { ABI, WETH, ZERO } from '@tokenlon/sdk'
import * as crypto from 'crypto'
import { expect } from 'chai'
import { toOffer } from '../src/signer/rfqv2'
import { assetDataUtils } from '0x-v2-order-utils'
import * as nock from 'nock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  RFQV2,
  USDT_ADDRESS,
  callNewOrder,
  deployEIP1271Plus191Wallet,
  deployERC1271Wallet,
  deployMMPV4Wallet,
  expectOrder,
  getMarketMakingInfo,
  init,
  replaceMarketMakingAddress,
  usdtHolders,
} from './utils'
import { FEE_RECIPIENT_ADDRESS } from '../src/constants'

describe('RFQV2 NewOrder', function () {
  const chainId: number = network.config.chainId!
  let signer: SignerWithAddress
  let rfqv2: Contract
  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
    const usdtHolderAddr = usdtHolders[chainId]
    rfqv2 = await ethers.getContractAt('ISignatureValidator', RFQV2[chainId])
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [usdtHolderAddr],
    })
  })
  beforeEach(function () {
    init(chainId, signer)
  })
  it('should sign rfqv2 order by EIP712', async function () {
    replaceMarketMakingAddress(chainId, signer.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    const userAddr = Wallet.createRandom().address.toLowerCase()
    const usdt = new ethers.Contract(USDT_ADDRESS[chainId], ABI.IERC20, ethers.provider)
    await usdt.connect(signer).approve(RFQV2[chainId], ethers.constants.MaxUint256)
    const order = await callNewOrder({
      chainId: chainId,
      base: 'USDT',
      quote: 'ETH',
      side: 'SELL',
      amount: 1,
      walletType: WalletType.EOA,
      signer: signer,
      userAddr: userAddr,
      protocol: Protocol.RFQV2,
    })
    expectOrder({
      order: order,
      expectedProtocol: Protocol.RFQV2,
      expectedTakerAddress: userAddr,
      expectedMakerAddress: signer.address,
      expectedTakerAssetAddress: USDT_ADDRESS[chainId],
      expectedMakerAssetAddress: WETH[chainId],
      expectedTakerAssetAmount: utils.parseUnits('1', 6).toString(),
      expectedMakerAssetAmount: utils.parseEther('1').toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(66)
    expect(sigBytes[65]).eq(SignatureType.EIP712)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
    // verify signature
    const isValid = await rfqv2.callStatic.isValidSignature(
      signer.address,
      getOfferSignDigest(toOffer(order), chainId, RFQV2[chainId]),
      '0x',
      order.makerWalletSignature
    )
    expect(isValid).true
  })
  it('should sign rfqv2 order for MMPv4', async () => {
    const [deployer] = await ethers.getSigners()
    const privateKey = crypto.randomBytes(32)
    const user = new ethers.Wallet(privateKey, ethers.provider)
    const userAddr = user.address.toLowerCase()
    const mmpSigner = Wallet.createRandom()
    console.log(`mmpSigner: ${mmpSigner.address}`)
    const mmproxy = await deployMMPV4Wallet(mmpSigner, deployer)
    replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      walletType: WalletType.MMP_VERSION_4,
      signer: mmpSigner,
      userAddr: userAddr,
      protocol: Protocol.RFQV2,
    })
    // taker asset would be a ZERO address in RFQV2 protocol
    expectOrder({
      order: order,
      expectedProtocol: Protocol.RFQV2,
      expectedTakerAddress: userAddr,
      expectedMakerAddress: mmproxy.address,
      expectedTakerAssetAddress: ZERO[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(88)
    expect(sigBytes[87]).eq(SignatureType.Wallet)
    // verify random values
    expect(order.salt?.toString().length).gt(0)
    expect(Number(order.expirationTimeSeconds)).gt(0)
    const orderSignDigest = getOfferSignDigest(toOffer(order), chainId, RFQV2[chainId])
    const isValid = await rfqv2.callStatic.isValidSignature(
      order.makerAddress,
      orderSignDigest,
      '0x',
      order.makerWalletSignature
    )
    expect(isValid).true
  }).timeout(360000)
  it('should sign rfqv2 order for a ERC1271_EIP712_EIP191 MMP contract', async () => {
    const [deployer] = await ethers.getSigners()
    const user = Wallet.createRandom()
    const userAddr = user.address.toLowerCase()
    const allowSigner = Wallet.createRandom()
    const walletContract = await deployEIP1271Plus191Wallet(allowSigner, deployer)
    replaceMarketMakingAddress(chainId, walletContract.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    const order = await callNewOrder({
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      walletType: WalletType.ERC1271_EIP712_EIP191,
      signer: allowSigner,
      chainId: chainId,
      userAddr: userAddr,
      protocol: Protocol.RFQV2,
    })

    expectOrder({
      order: order,
      expectedProtocol: Protocol.RFQV2,
      expectedTakerAddress: userAddr,
      expectedMakerAddress: walletContract.address,
      expectedTakerAssetAddress: ZERO[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })

    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(66)
    expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
    // verify signature
    const isValid = await rfqv2.callStatic.isValidSignature(
      order.makerAddress,
      getOfferSignDigest(toOffer(order), chainId, RFQV2[chainId]),
      '0x',
      order.makerWalletSignature
    )
    expect(isValid).true
  }).timeout(360000)
  it('should sign rfqv2 order for a ERC1271_EIP712 MMP contract', async () => {
    const [deployer] = await ethers.getSigners()
    const user = Wallet.createRandom()
    const userAddr = user.address.toLowerCase()
    const allowSigner = Wallet.createRandom()
    const walletContract = await deployERC1271Wallet(allowSigner, deployer)
    replaceMarketMakingAddress(chainId, walletContract.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    const order = await callNewOrder({
      walletType: WalletType.ERC1271_EIP712,
      signer: allowSigner,
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      protocol: Protocol.RFQV2,
    })
    expectOrder({
      order: order,
      expectedProtocol: Protocol.RFQV2,
      expectedTakerAddress: userAddr,
      expectedMakerAddress: walletContract.address,
      expectedTakerAssetAddress: ZERO[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: FEE_RECIPIENT_ADDRESS,
      expectedSenderAddress: marketMakingInfo.tokenlonExchangeContractAddress,
    })
    // verify signature type
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    expect(sigBytes.length).eq(66)
    expect(sigBytes[65]).eq(SignatureType.WalletBytes32)
    // verify signature
    const isValid = await rfqv2.callStatic.isValidSignature(
      order.makerAddress,
      getOfferSignDigest(toOffer(order), chainId, RFQV2[chainId]),
      '0x',
      order.makerWalletSignature
    )
    expect(isValid).true
  }).timeout(360000)
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
      takerAssetData: assetDataUtils.encodeERC20AssetData(ZERO[chainId]),
      makerAssetData: assetDataUtils.encodeERC20AssetData(USDT_ADDRESS[chainId]),
      takerFee: toBN(0),
      makerFee: toBN(0),
      takerAssetAddress: ZERO[chainId],
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
})
