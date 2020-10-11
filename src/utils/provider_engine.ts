import { RPCSubprovider, Web3ProviderEngine } from '@0x/subproviders'
import { providerUtils } from '0x-v3-utils'

export const determineProvider = (rpcUrl: string): Web3ProviderEngine => {
  const pe = new Web3ProviderEngine()
  // TODO: move wallet key here
  // pe.addProvider(mnemonicWallet)
  // if (NETWORK_CONFIGS === GANACHE_CONFIGS) {
  //   pe.addProvider(
  //     new GanacheSubprovider({
  //       vmErrorsOnRPCResponse: false,
  //       network_id: GANACHE_CONFIGS.networkId,
  //       mnemonic: MNEMONIC,
  //     })
  //   )
  // } else {
  pe.addProvider(new RPCSubprovider(rpcUrl))
  // }
  providerUtils.startProviderEngine(pe)
  return pe
}
