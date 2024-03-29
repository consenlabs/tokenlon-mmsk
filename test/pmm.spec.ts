import { ethers, network } from 'hardhat'
import { Wallet, utils } from 'ethers'
import { updaterStack } from '../src/worker'
import { Protocol } from '../src/types'
import { EIP712_ORDER_SCHEMA, buildSignedOrder as buildPMMV5SignedOrder } from '../src/signer/pmmv5'
import { ExtendedZXOrder, WalletType } from '../src/signer/types'
import { BigNumber, toBN } from '../src/utils'
import { ABI, WETH } from '@tokenlon/sdk'
import { expect } from 'chai'
import { assetDataUtils, eip712Utils, orderHashUtils } from '0x-v2-order-utils'
import * as nock from 'nock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import {
  USDT_ADDRESS,
  WALLET_TYPE_MAGIC_VALUE,
  callNewOrder,
  deployMMPV4Wallet,
  expectOrder,
  getMarketMakingInfo,
  init,
  replaceMarketMakingAddress,
  toZXOrder,
  usdtHolders,
} from './utils'

describe('PMM NewOrder', function () {
  const chainId: number = network.config.chainId!
  let signer: SignerWithAddress
  before(async () => {
    const signers = await ethers.getSigners()
    signer = signers[0]
    const usdtHolderAddr = usdtHolders[chainId]
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [usdtHolderAddr],
    })
  })
  beforeEach(() => {
    init(chainId, signer)
  })
  it('should raise error for pmmv4 order', async function () {
    expect(
      await callNewOrder({
        chainId: chainId,
        base: 'ETH',
        quote: 'USDT',
        side: 'SELL',
        amount: 0.1,
        signer,
        walletType: WalletType.MMP_VERSION_4,
        userAddr: Wallet.createRandom().address.toLowerCase(),
        protocol: 'PMMV4',
      }),
      'Unrecognized protocol: PMMV4'
    )
  })
  it('should sign pmmv5 order by EOA', async function () {
    replaceMarketMakingAddress(chainId, signer.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    const userAddr = Wallet.createRandom().address.toLowerCase()
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      protocol: Protocol.PMMV5,
      signer,
      walletType: WalletType.EOA,
    })
    expectOrder({
      order: order,
      expectedProtocol: Protocol.PMMV5,
      expectedTakerAddress: marketMakingInfo.addressBookV5.PMM,
      expectedMakerAddress: signer.address,
      expectedTakerAssetAddress: WETH[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: userAddr,
      expectedSenderAddress: marketMakingInfo.addressBookV5.PMM,
    })
    const zxOrder = toZXOrder(order)
    const orderHashBuffer = eip712Utils.structHash(EIP712_ORDER_SCHEMA, zxOrder)
    const orderHash = '0x' + orderHashBuffer.toString('hex')
    console.log(`orderHash: ${orderHash}`)
    const orderSignDigest = orderHashUtils.getOrderHashHex(zxOrder)
    console.log(`orderSignDigest: ${orderSignDigest}`)
    const sigBytes = utils.arrayify(order.makerWalletSignature!)
    const v = utils.hexlify(sigBytes.slice(0, 1))
    const r = utils.hexlify(sigBytes.slice(1, 33))
    const s = utils.hexlify(sigBytes.slice(33, 65))
    const recovered = ethers.utils.verifyMessage(utils.arrayify(orderSignDigest), {
      v: parseInt(v),
      r: r,
      s: s,
    })
    expect(recovered.toLowerCase()).eq(signer.address.toLowerCase())
  })
  it('should sign pmmv5 order for MMPv4', async function () {
    const usdtHolder = await ethers.provider.getSigner(usdtHolders[chainId])
    const usdt = await ethers.getContractAt(ABI.IERC20, USDT_ADDRESS[chainId])
    const mmpSigner = Wallet.createRandom()
    const [deployer] = await ethers.getSigners()
    const mmproxy = await deployMMPV4Wallet(mmpSigner, deployer)
    replaceMarketMakingAddress(chainId, mmproxy.address, updaterStack)
    const marketMakingInfo = getMarketMakingInfo()
    await usdt.connect(usdtHolder).transfer(mmproxy.address, ethers.utils.parseUnits('1000', 6))
    const userAddr = Wallet.createRandom().address.toLowerCase()
    const order = await callNewOrder({
      chainId: chainId,
      base: 'ETH',
      quote: 'USDT',
      side: 'SELL',
      amount: 0.1,
      userAddr: userAddr,
      protocol: Protocol.PMMV5,
      signer: mmpSigner,
      makerAddress: mmproxy.address,
      walletType: WalletType.MMP_VERSION_4,
    })
    expectOrder({
      order: order,
      expectedProtocol: Protocol.PMMV5,
      expectedTakerAddress: marketMakingInfo.addressBookV5.PMM,
      expectedMakerAddress: mmproxy.address,
      expectedTakerAssetAddress: WETH[chainId],
      expectedMakerAssetAddress: USDT_ADDRESS[chainId],
      expectedTakerAssetAmount: utils.parseEther('0.1').toString(),
      expectedMakerAssetAmount: utils.parseUnits('0.1', 6).toString(),
      expectedFeeRecipient: userAddr,
      expectedSenderAddress: marketMakingInfo.addressBookV5.PMM,
    })
    console.log(`order.makerWalletSignature: ${order.makerWalletSignature}`)
    const magicValue = await mmproxy.callStatic.isValidSignature(
      orderHashUtils.getOrderHashHex(toZXOrder(order)),
      order.makerWalletSignature?.slice(0, -2)
    )
    console.log(`magicValue: ${magicValue}`)
    expect(magicValue).eq(WALLET_TYPE_MAGIC_VALUE)
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
})
