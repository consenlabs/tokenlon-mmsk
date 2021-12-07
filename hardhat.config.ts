import 'dotenv/config'
import { task } from 'hardhat/config'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-ethers'
import 'hardhat-gas-reporter'

const chainId = process.env.chainId as string
console.log(`Chain ID: ${chainId}`)

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task('accounts', 'Prints the list of accounts', async (_, hre) => {
  const { ethers } = hre
  const signers = await ethers.getSigners()
  for (const signer of signers) {
    console.log(signer.address)
  }
})

const now = new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' })
const weekday = new Date(now).getDay()

const FORK_NETWORK_POOLS = {
  Goerli: [
    'https://eth-goerli.alchemyapi.io/v2/5YHFpU_wScqBks0YM27UVsJrsfeiO_s-',
    'https://eth-goerli.alchemyapi.io/v2/SApYz7Tg5O6AGUlynnxndybQ9DG7ymHt',
    'https://eth-goerli.alchemyapi.io/v2/m1Et8DBCaRQbPAb8bq3aJASO6PdfTbQi',
  ],
  Mainnet: [
    'https://eth-mainnet.alchemyapi.io/v2/cCsYHzvHm_fdKeGHo_PEeliRoAC4JKyp'
  ]
}

const goerli = {
  chainId: 5,
  hardfork: 'london',
  gasPrice: 'auto',
  initialBaseFeePerGas: 1_000_000_000,
  forking: {
    url: FORK_NETWORK_POOLS.Goerli[weekday % FORK_NETWORK_POOLS.Goerli.length],
  },
}

const mainnet = {
  chainId: 1,
  hardfork: 'london',
  gasPrice: 'auto',
  initialBaseFeePerGas: 1_000_000_000,
  forking: {
    url: FORK_NETWORK_POOLS.Mainnet[weekday % FORK_NETWORK_POOLS.Mainnet.length],
  },
}

const Network: Record<string, any> = {
  '1': mainnet,
  'staging': mainnet,
  '5': goerli
}

const hardhat = Network[chainId]

console.log('hardhat config')
console.log(JSON.stringify(hardhat, null, 2))

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  networks: {
    localhost: {
      url: 'http://localhost:8545',
    },
    hardhat: hardhat,
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
    ],
  },
}
