import { generatePseudoRandomSalt, signatureUtils, SignedOrder, Order, assetDataUtils } from '0x-v3-order-utils'
import { BigNumber } from '0x-v3-utils';
import { getTokenBySymbol } from '../../utils/token'
import { toBN } from '../../utils/math'
import { extractAssetAmounts } from '../../utils/order'
import { BaseWalletSubprovider } from '@0x/subproviders/lib/src/subproviders/base_wallet_subprovider'
import { Web3ProviderEngine } from '@0x/subproviders'

// tslint:disable-next-line:custom-no-magic-numbers
export const ONE_SECOND_MS = 1000;
// tslint:disable-next-line:custom-no-magic-numbers
export const ONE_MINUTE_MS = ONE_SECOND_MS * 60;
// tslint:disable-next-line:custom-no-magic-numbers
export const TEN_MINUTES_MS = ONE_MINUTE_MS * 10;
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000';
export const NULL_BYTES = '0x';
export const ZERO = new BigNumber(0);

const NETWORK_CONFIGS = {
  chainId: 42, // Kovan
}

/**
 * Returns an amount of seconds that is greater than the amount of seconds since epoch.
 */
export const getRandomFutureDateInSeconds = (): BigNumber => {
  return new BigNumber(Date.now() + TEN_MINUTES_MS).div(ONE_SECOND_MS).integerValue(BigNumber.ROUND_CEIL);
};

/**
 * Sign 0x v3 order by maker wallet
 * @param params
 */
export async function signOrderByMaker(params, makerWallet: BaseWalletSubprovider): Promise<SignedOrder> {
  const { userAddr, rate, simpleOrder, tokenList } = params
  const { side, amount } = simpleOrder
  const baseToken = getTokenBySymbol(tokenList, simpleOrder.base)
  const quoteToken = getTokenBySymbol(tokenList, simpleOrder.quote)
  const makerToken = side === 'BUY' ? baseToken : quoteToken
  const takerToken = side === 'BUY' ? quoteToken : baseToken
  const { makerAssetAmount, takerAssetAmount } = extractAssetAmounts(makerToken, takerToken, side, rate, toBN(amount))
  const makerAddress = (await makerWallet.getAccountsAsync())[0]

  // Set up the Order and fill it
  const randomExpiration = getRandomFutureDateInSeconds();

  // Create the order
  const order: Order = {
    chainId: NETWORK_CONFIGS.chainId,
    exchangeAddress: NULL_ADDRESS, // TODO: add exchange contract address
    makerAddress: makerAddress,
    takerAddress: userAddr,
    senderAddress: NULL_ADDRESS, // TODO: set sender as userAddress
    feeRecipientAddress: NULL_ADDRESS, // TODO: fill recipient address as tokenlon
    expirationTimeSeconds: randomExpiration,
    salt: generatePseudoRandomSalt(),
    makerAssetAmount,
    takerAssetAmount,
    makerAssetData: assetDataUtils.encodeERC20AssetData(makerToken.address),
    takerAssetData: assetDataUtils.encodeERC20AssetData(takerToken.address),
    // TODO: add fee
    makerFeeAssetData: NULL_BYTES,
    takerFeeAssetData: NULL_BYTES,
    makerFee: ZERO,
    takerFee: ZERO,
  }

  const pe = new Web3ProviderEngine()
  pe.addProvider(makerWallet)
  const result = await signatureUtils.ecSignOrderAsync(pe, order, makerAddress)
  pe.stop()
  return result
}
