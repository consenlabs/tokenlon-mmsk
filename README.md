# Tokenlon MMSK

Market maker server kit, for tokenlon's MM(Market Maker).

See [docs](https://docs.token.im/tokenlon-mmsk/)

## Setup

Require Node.JS v12 as runtime.

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
    - PERMIT_TYPE, approve tokens to `RFQv2` contract directly or approve tokens to `AllowanceTarget` contract.
    - WALLET_ADDRESS, as your signer wallet address
    - WALLET_PRIVATE_KEY, private key of above wallet, or use WALLET_KEYSTORE
    - WALLET_TYPE, a market maker's wallet smart contract.
        - types.WalletType.MMP_VERSION_4 (compatible with PMM protocol, see [example contract](https://gist.github.com/NIC619/a3db1a743175bf592f2db983f17680dd#file-mmpv4-sol-L1236))
        - types.WalletType.MMP_VERSION_5
        - types.WalletType.ERC1271
        - types.WalletType.EOA
    - SIGNING_URL, If you wanna sign orders in your own service instead of the mmsk,
   please set the SIGNING_URL to your service endpoint. the mmsk would post every unsigned PMM/RFQV1/RFQV2 orders to your service. Remember to set the WALLET_ADDRESS as well. An example RFQV1 request is shown below:
    ```
    {
      rfqOrder: {
        takerAddr: '0x87fca7135c1c54876a62dc4922da3ce45f38debf',
        makerAddr: '0x86B9F429C3Ef44c599EB560Eb531A0E3f2E36f64',
        takerAssetAddr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        makerAssetAddr: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        takerAssetAmount: '1000000000000000000',
        makerAssetAmount: '100000000',
        deadline: 1620444917,
        feeFactor: 30,
        salt: '54987026777386128963216107663301166813737035846370728350988439404382800511006'
      },
      userAddr: '0x87fca7135c1c54876a62dc4922da3ce45f38debf',
      signer: '0xb5419119e04498C3eC43A9468D6480aF0DAE3A0c',
      chainId: 1,
      rfqAddr: '0xfD6C2d2499b1331101726A8AC68CCc9Da3fAB54F'
    }
    ```
    An example response the signing service should return
    ```
    {
      signature: "0x122344..."
    }
    ```
    - HTTP_SERVER_ENDPOINT, your backend http quoting server
    - CHAIN_ID, 1 for mainnet, 5 for testnet(Goerli)
- Testing with `node app/check.js`
- Register contract address, signer address and MMSK server url to Tokenlon team

## Version Release

1. bump version in `package.json`, please follow [semantic versioning](https://semver.org/).
2. update server version response at `src/handler/version.ts`
3. commit above changes and git tag new version
4. run release script under `script` folder
5. upload tar file on github release page with writing change log

copyright© imToken PTE. LTD.
