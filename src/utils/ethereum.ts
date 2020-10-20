import { ethers, BigNumber } from 'ethers'
import { config } from '../config'

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
