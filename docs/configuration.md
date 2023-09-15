## Configuration

Require Node.JS v12 or above as runtime.

Program setup,
- Create a wallet as order signer, and save it as keystore or private key
- Deploy market maker proxy contract on ethereum
    - with several permissions setting, such as token allowance, withdrawal account
    - deposit token asset to contract
- Implement a market maker backend http server
    - see [interfaces](interfaces.md), mostly quote with (buy, sell, amount) returning a price number
- Modify the options in `app/mmConfig.js`, including,
    - EXCHANGE_URL, point to tokenlon exchange server
    - PROVIDER_URL, point to ethereum node, like your infura endpoint
    - HTTP_SERVER_ENDPOINT, your backend http quoting server. See [interfaces](interfaces.md)
    - CHAIN_ID, 1 for mainnet, 5 for testnet(Goerli)
    - PERMIT_TYPE, approve tokens to `RFQv2` protocol contract directly or approve tokens to `AllowanceTarget` contract for PMMV5/RFQV1 protocols.
    - WALLET_ADDRESS, as your signer wallet address
    - WALLET_PRIVATE_KEY, private key of above wallet, or use WALLET_KEYSTORE
    - WALLET_TYPE, a type of market making wallet contract.
        - types.WalletType.MMP_VERSION_4 (see [example contract](https://gist.github.com/NIC619/a3db1a743175bf592f2db983f17680dd#file-mmpv4-sol-L1236))
        - types.WalletType.ERC1271_EIP712: your market making contract could verify standard EIP712 signatures.
        - types.WalletType.ERC1271_EIP712_EIP191: your market making contract could verify signatures correspond to the digest of EIP712 struct hash with a EIP191 prefix.
        - types.WalletType.EOA
    - SIGNING_URL, If you wanna sign orders in your own service instead of the mmsk,
   please set the SIGNING_URL to your service endpoint. the mmsk would post every unsigned PMMV5/RFQV1/RFQV2 orders to your service. Remember to set the WALLET_ADDRESS as well. Example PMMV5/RFQV1/RFQV2 requests are shown below:

   PMMV5:
    ```
    {
      quoteId: '0x123',
      protocol: 'PMMV5',
      pmmOrder: {
        makerAddress: '0x86b9f429c3ef44c599eb560eb531a0e3f2e36f64',
        makerAssetAmount: '100000000',
        makerAssetData: '0xf47261b0000000000000000000000000dac17f958d2ee523a2206206994597c13d831ec7',
        makerFee: '0',
        takerAddress: '0x7bd7d025d4231aad1233967b527ffd7416410257',
        takerAssetAmount: '1000000000000000000',
        takerAssetData: '0xf47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
        takerFee: '0',
        senderAddress: '0x7bd7d025d4231aad1233967b527ffd7416410257',
        feeRecipientAddress: '0x8fba2dd6968ddc51aea563091008d8451fec4db6',
        expirationTimeSeconds: '1620444917',
        exchangeAddress: '0x86b9f429c3ef44c599eb560eb531a0e3f2e36f64',
        salt: '22685491128062564230891640495451214097'
      },
      feeFactor: 30,
      orderHash: '0x9f9bb186d77c19a763266f54978eef923f3e6ebd5ac6d2c687b1323abe91d8b5',
      orderSignDigest: '0x6e95144f3539f8679b94e858a0bcd755e8b17a4011e2fdf025387e4523a9b0fe',
      userAddr: '0x8fba2dd6968ddc51aea563091008d8451fec4db6',
      chainId: 1,
      pmmAddr: '0x7bd7d025D4231aAD1233967b527FFd7416410257'
    }
    ```

    RFQV1:
    ```
    {
      quoteId: '0x123',
      protocol: 'RFQV1',
      rfqOrder: {
        takerAddr: '0xcabfea3a7f41452a9c8e475a53b30c43fbff6683',
        makerAddr: '0x86b9f429c3ef44c599eb560eb531a0e3f2e36f64',
        takerAssetAddr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        makerAssetAddr: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        takerAssetAmount: '1000000000000000000',
        makerAssetAmount: '100000000',
        deadline: 1620444917,
        feeFactor: 30,
        salt: '7719472615821079694904732333912527190235994441565629342017219118620679208990'
      },
      feeFactor: 30,
      orderHash: '0x77eda617afe88090a34cf031470b0968c1754a474f573dfb5c5b5c67cf8167ce',
      orderSignDigest: '0xdd785ffa1a694db8af972523ee115fc95580929e23ac5c46a62692b0f6600fc5',
      userAddr: '0xcabfea3a7f41452a9c8e475a53b30c43fbff6683',
      chainId: 1,
      rfqAddr: '0x117CAf73eB142eDC431E707DC33D4dfeF7c5BAd0'
    }
    ```

    RFQV2:
    ```
    {
      quoteId: '0x123',
      protocol: 'RFQV2',
      rfqOrder: {
        taker: '0x8fda8bc038af1c426838248718eb2fd5425882cc',
        maker: '0x86b9f429c3ef44c599eb560eb531a0e3f2e36f64',
        takerToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        takerTokenAmount: '1000000000000000000',
        makerToken: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        makerTokenAmount: '100000000',
        feeFactor: '30',
        expiry: '1620444917',
        salt: '0x11111111111111111111111111111111'
      },
      feeFactor: 30,
      orderHash: '0xd431d9a453b67d76244e6ea1244895fa4c2e874eee03bc2af1f6e171afa938ae',
      orderSignDigest: '0x9573a91c47d9bdad67354a5a677d778eff3ccb94866bfe3c2907827db7866c91',
      userAddr: '0x8fda8bc038af1c426838248718eb2fd5425882cc',
      chainId: 1,
      rfqAddr: '0xaE5FDd548E5B107C54E5c0D36952fB8a089f10C7'
    }
    ```

    An example response the signing service should return
    ```
    {
      signature: "0x122344..."
    }
    ```
- Testing with `node app/check.js`
- Register contract address, signer address and MMSK server url to Tokenlon team