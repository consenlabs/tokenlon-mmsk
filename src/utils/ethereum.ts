import { ethers, BigNumber, utils } from 'ethers'
import { config } from '../config'
import { updaterStack } from '../worker'
import { NULL_ADDRESS } from '../constants'

// ERC20 ABI
const abi = [
  // Read-Only Functions
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',

  // Authenticated Functions
  'function transfer(address to, uint amount) returns (boolean)',

  // Events
  'event Transfer(address indexed from, address indexed to, uint amount)',
]

export const getTokenBalance = async ({ address, contractAddress }): Promise<BigNumber> => {
  const provider = new ethers.providers.JsonRpcProvider(config.PROVIDER_URL)
  const erc20 = new ethers.Contract(contractAddress, abi, provider)
  return await erc20.balanceOf(address)
}

export const getTokenlonTokenBalance = async (token) => {
  const config = updaterStack.markerMakerConfigUpdater.cacheResult
  const balanceBN = await getTokenBalance({
    address: config.mmProxyContractAddress,
    contractAddress: getWethAddrIfIsEth(token.contractAddress, config.wethContractAddress),
  })
  return balanceBN ? +utils.formatUnits(balanceBN, token.decimal) : 0
}

export const getWethAddrIfIsEth = (address, wethAddress) => {
  return address.toLowerCase() === NULL_ADDRESS ? wethAddress.toLowerCase() : address.toLowerCase()
}
