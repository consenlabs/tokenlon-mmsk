import 'dotenv/config'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-gas-reporter'

const MAINNET_NODE_RPC_URL = process.env.MAINNET_NODE_RPC_URL || ''

module.exports = {
  networks: {
    hardhat: {
      chainId: 1,
      forking: {
        url: `${MAINNET_NODE_RPC_URL}`,
        blockNumber: 18118600,
      },
    },
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
