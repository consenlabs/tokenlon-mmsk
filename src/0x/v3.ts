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
  const { userAddr, makerAddr, rate, simpleOrder, tokenList, chainID } = params
  const { side, amount, base, quote } = simpleOrder
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
    // TODO: add fee
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: NULL_BYTES,
    makerFee: ZERO,
    takerFee: ZERO,
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
