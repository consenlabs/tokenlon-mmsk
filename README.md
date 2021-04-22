# Tokenlon MMSK

Market maker server kit, for tokenlon's MM(Market Maker).

See [docs](https://docs.token.im/tokenlon-mmsk/)

## Setup

Require Node.JS v10 as runtime.

Program setup,
- Create a wallet as order signer, and save it as keystore or private key
- Deploy market maker proxy contract on ethereum
    - with several permissions setting, such as token allowance, withdrawal account
    - deposit token asset to contract
- Implement a market maker backend http server
    - see Quoter interface, mostly quote with (buy, sell, amount) returning a price number
- Modify the options in `app/mmConfig.js`, including,
    - EXCHANGE_URL, point to tokenlon exchange server
    - PROVIDER_URL, point to ethereum node, like your infura endpoint
    - WALLET_ADDRESS, as your signer wallet address
    - WALLET_PRIVATE_KEY, private key of above wallet, or use WALLET_KEYSTORE
    - HTTP_SERVER_ENDPOINT, your backend http server
    - CHAIN_ID, 1 for mainnet, 42 for testnet(kovan)
- Testing with `node app/check.js`
- Register contract address & signer address & MMSK server url to Tokenlon team

## Version Release

1. bump version in `package.json`, please follow [semantic versioning](https://semver.org/).
2. update server version response at `src/handler/version.ts`
3. commit above changes and git tag new version
4. run release script under `script` folder
5. upload tar file on github release page with writing change log

copyright© imToken PTE. LTD.
