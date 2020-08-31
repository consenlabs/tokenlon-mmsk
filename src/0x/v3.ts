import {
  generatePseudoRandomSalt,
  signatureUtils,
  SignedOrder,
  SignatureType,
  Order,
  assetDataUtils,
  orderHashUtils,
} from '0x-v3-order-utils'
import { BigNumber, NULL_ADDRESS, NULL_BYTES, providerUtils } from '0x-v3-utils'
import { BaseWalletSubprovider } from '@0x/subproviders/lib/src/subproviders/base_wallet_subprovider'
import { Web3ProviderEngine } from '@0x/subproviders'
import { getContractAddressesForChainOrThrow } from '@0x/contract-addresses'
import * as ethUtil from 'ethereumjs-util'
import { constants } from 'ethers'
import { BigNumber as XBN } from '@0xproject/utils'

import { getTokenBySymbol } from '../utils/token'
import { toBN } from '../utils/math'
import { extractAssetAmounts } from './v2'
import { FEE_RECIPIENT_ADDRESS, ONE_SECOND_MS, ZERO } from '../constants'

/**
 * Returns an amount of seconds that is greater than the amount of seconds since epoch.
 */
export const getRandomFutureDateInSeconds = (): BigNumber => {
  return new BigNumber(Date.now() + ONE_SECOND_MS * 90) // expired 90s By default
    .div(ONE_SECOND_MS)
    .integerValue(BigNumber.ROUND_CEIL)
}

/**
 * Sign 0x v3 order by maker wallet
 * @param params
 * @param signerWallet wallet provider for signing
 */
export async function signOrderByMaker(
  params,
  signerWallet: BaseWalletSubprovider
): Promise<SignedOrder> {
  const {
    userAddr,
    makerAddr,
    rate,
    simpleOrder,
    tokenList,
    chainID,
    tokenConfigs,
    cfgFeeFactor,
  } = params
  const { side, amount, base, quote, feefactor: simpleOrderFee } = simpleOrder
  console.log('simpleorder', simpleOrder)

  const baseToken = getTokenBySymbol(tokenList, base == 'ETH' ? 'WETH' : base)
  const quoteToken = getTokenBySymbol(tokenList, quote == 'ETH' ? 'WETH' : quote)
  const makerToken = side === 'BUY' ? baseToken : quoteToken
  const takerToken = side === 'BUY' ? quoteToken : baseToken
  const { makerAssetAmount, takerAssetAmount } = extractAssetAmounts(
    makerToken,
    takerToken,
    side,
    rate,
    toBN(amount)
  )
  const signerAddress = (await signerWallet.getAccountsAsync())[0]

  const foundTokenConfig = tokenConfigs.find((t) => t.symbol === makerToken.symbol)

  let fFactor = cfgFeeFactor || 0
  if (foundTokenConfig?.feeFactor) {
    fFactor = foundTokenConfig.feeFactor
  }
  const queryFeeFactor = simpleOrderFee && simpleOrderFee[1]
  if (queryFeeFactor && !Number.isNaN(+queryFeeFactor) && +queryFeeFactor >= 0) {
    fFactor = +queryFeeFactor
  }
  const takerFee = takerAssetAmount.mul(new XBN(fFactor)).dividedBy(new XBN(10000))

  // Set up the Order and fill it
  const randomExpiration = getRandomFutureDateInSeconds()
  const contractAddresses = getContractAddressesForChainOrThrow(chainID)

  // Create the order
  const order: Order = {
    chainId: chainID,
    exchangeAddress: contractAddresses.exchange,
    makerAddress: makerAddr,
    takerAddress: userAddr,
    senderAddress: NULL_ADDRESS, // TODO: set sender as userAddress
    feeRecipientAddress: FEE_RECIPIENT_ADDRESS,
    expirationTimeSeconds: randomExpiration,
    salt: generatePseudoRandomSalt(),
    makerAssetAmount,
    takerAssetAmount,
    makerAssetData: assetDataUtils.encodeERC20AssetData(makerToken.contractAddress),
    takerAssetData: assetDataUtils.encodeERC20AssetData(takerToken.contractAddress),
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: assetDataUtils.encodeERC20AssetData(takerToken.contractAddress),
    makerFee: ZERO,
    takerFee: takerFee,
  }

  const pe = new Web3ProviderEngine()
  pe.addProvider(signerWallet)
  try {
    providerUtils.startProviderEngine(pe)
    const orderHash = orderHashUtils.getOrderHash(order)
    const hash = ethUtil.bufferToHex(
      Buffer.concat([
        ethUtil.toBuffer(orderHash),
        ethUtil.toBuffer(constants.AddressZero),
        Buffer.from([0, 30]),
      ])
    )
    const signatureHex = await signatureUtils.ecSignHashAsync(pe, hash, signerAddress)
    const walletSign = ethUtil.bufferToHex(
      Buffer.concat([
        ethUtil.toBuffer(signatureHex).slice(0, 65),
        ethUtil.toBuffer(constants.AddressZero),
        ethUtil.toBuffer([0, 30]),
      ])
    )
    return {
      ...order,
      signature: signatureUtils.convertToSignatureWithType(walletSign, SignatureType.Wallet),
    }
  } finally {
    pe.stop()
  }
}
