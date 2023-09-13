import 'dotenv/config'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-gas-reporter'

const ALCHEMY_TOKEN = process.env.ALCHEMY_TOKEN || ''
const FORK_NETWORK = (process.env.FORK_NETWORK as string) || 'mainnet'

const ForkedNetwork: Record<string, any> = {
  mainnet: {
    chainId: 1,
    forking: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_TOKEN}`,
      blockNumber: 18118600,
    },
  },
  goerli: {
    chainId: 5,
    forking: {
      url: `https://eth-goerli.g.alchemy.com/v2/${ALCHEMY_TOKEN}`,
      blockNumber: 9685800,
    },
  },
}

module.exports = {
  networks: {
    hardhat: ForkedNetwork[FORK_NETWORK],
  },
  solidity: {
    compilers: [
      {
        version: '0.5.16',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000,
          },
        },
      },
    ],
  },
}
