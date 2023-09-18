# Public API provided by MMSK

**tokenlon-mmsk** also provides following public APIs to marker makers.

## getSupportedTokenList

> example

```json
{
  "result": true,
  "tokens": [
    {
      "symbol": "ETH",
      "opposites": [
        "MANA",
        "SNT",
      ]
    },
    {
      "symbol": "MANA",
      "opposites": [
        "ETH"
      ]
    },
    {
      "symbol": "SNT",
      "opposites": [
        "ETH"
      ]
    }
  ]
}
```

Tokenlon will return the tokens supported by the market maker and Tokenlon through this interface, through the pairs interface of the market maker and the  `getTokenList` interface of Tokenlon Server.

#### Request mode
GET

#### Request parameter
None

#### request return
|Name|Type|Description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|tokens|Array| token item array|

## getRate

> example

```json
{
  "result": true,
  "exchangeable": true,
  "minAmount": 0.0002,
  "maxAmount": 100,
  "rate": 124.28
}
```

Tokenlon Server will continuously poll the `getRate` interface of the requesting market maker mmsk Server to provide the best quotation to the user. This interface is only a simple derivative of the market maker's indicativePrice interface.

#### Request mode
GET

#### Request parameters
|Name|Type|Mandatory|description|
|----|----|----|----|
|base|String|YES|base symbol|
|quote|String|YES|quote symbol|
|side|String|YES|'BUY' or 'SELL'|
|amount|Number|**NO**|**BUY** or **SELL** base amount|

#### request return
#### Returned in normal conditions
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|rate|Number||

#### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|message|String|error message|

## newOrder

> example

```json
{
  "result": true,
  "rate": 0.00002,
  "exchangeable": true,
  "minAmount": 0.0002,
  "maxAmount": 100,
  "order": {
    "makerAddress": "0xb6025914f4e631d458f4668cc232d1e38ddbd569",
    "makerAssetAmount": "1000000000000000000000",
    "makerAssetData": "0xf47261b0000000000000000000000000744d70fdbe2ba4cf95131626614a1763df805b9e",
    "makerFee": "0",
    "takerAddress": "0x08053129c3967f4a496958aac5a1e8e6df6c7652",
    "takerAssetAmount": "23324453240000000000",
    "takerAssetData": "0xf47261b0000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "takerFee": "0",
    "senderAddress": "0x8f19bf4b5dfae80c1e3f91bd33f3bbc37326d5e7",
    "feeRecipientAddress": "0x0000000000000000000000000000000000000000",
    "expirationTimeSeconds": "1539498614",
    "exchangeAddress": "0x2002d3812f58e35f0ea1ffbf80a75a38c32175fa",
    "salt": "59572482685924225672407231424301404205239289582722616080644908172098386763718",
    "makerWalletSignature": "0x1b66353b9b6cff19d5acbdf275d55e988c2a077c6c6074bcf49705e09b7efd3a61212821ff244b96623fa5181507da0b796a6693b1d511e9355a83c4c06ac88a66fba2ff8436171ddd3653cd2ca1c5595046144d7f04",
    "quoteId": "TD-190109-173025-NqGaWun",
    "feeFactor": 10,
    "protocol": "PMMV5"
  }
}
```

When the user clicks quote request button in the imToken app, they will get the order for the corresponding price. The Tokenlon server polls the newOrder interface of each market maker’s **mmsk server** to provide the order with the best quote prices to the user.


#### Request mode
GET

#### Request parameters
|Name|Type|Mandatory|description|
|----|----|----|----|
|base|String|YES|base symbol|
|quote|String|YES|quote symbol|
|side|String|YES|'BUY' or 'SELL'|
|userAddr|String|YES|user's address|
|amount|Number|**YES**|**BUY** or **SELL** base amount|
|uniqId|String|**YES**|represents the user's unique Id|
protocol|String|YES|'PMMV5', 'RFQV1' and 'RFQV2'
|feefactor|Number|YES|fee in bps unit


#### request return

#### Returned in normal conditions
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|rate|Number|This order's rate|
|order|Object| 0x's maker signed order|

#### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|message|String|error message|

## dealOrder

> example

```ts
{
  makerToken: 'SNT',
  takerToken: 'ETH',
  makerTokenAmount: 1000,
  takerTokenAmount: 1,
  quoteId: '234dsfasd-sdfasdf-sdfasf',
  timestamp: 1231234324,
}
```

#### Request mode
POST

#### Request parameters
|Name|Type|Mandatory|Description|
|----|----|----|----|
|makerToken|String|YES|token symbol|
|takerToken|String|YES|token symbol|
|makerTokenAmount|Number|YES|maker token's amount|
|takerTokenAmount|Number|YES|taker token's amount|
|quoteId|String|YES|quoteId from price interface|
|timestamp|Number|YES||

#### request return

#### Returned in normal conditions
|Name|Type|description|
|----|----|----|
|result|true||

#### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|false||
|message|String|error message|


## exceptionOrder

> example

```ts
{
  makerToken: 'SNT',
  takerToken: 'ETH',
  makerTokenAmount: 1000,
  takerTokenAmount: 1,
  quoteId: '234dsfasd-sdfasdf-sdfasf',
  timestamp: 1231234324,
  type: 'FAILED',
}
```

#### Request parameters
POST

#### Request parameters
|Name|Type|Mandatory|Description|
|----|----|----|----|
|makerToken|String|YES|token symbol|
|takerToken|String|YES|token symbol|
|makerTokenAmount|Number|YES|maker token's amount|
|takerTokenAmount|Number|YES|taker token's amount|
|quoteId|String|YES|quoteId from price interface|
|type|String|YES|'FAILED': the order transaction failed to execute on-chain；'TIMEOUT' means the order was expired；'DELAY' if an order executed on-chain, but Tokenlon server never sent the corresponding deal signal to the market maker. Should investigate the transaction ASAP.
|timestamp|Number|YES||

#### request return

#### Returned in normal conditions
|Name|Type|description|
|----|----|----|
|result|true||

#### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|false||
|message|String|error message  |


## version
#### Request mode
GET

#### request return
|Name|Type|description|
|----|----|----|
|result|true||
|version|String|The version of MMSK|


## getBalance

> example

```json
{
  "result": true,
  "balance": 0.13371396
}
```

Market maker can get `marketMakerProxyContract` contract’s corresponding token balance through this interface.

#### Request mode
GET

#### Request parameters
|Name|Type|Mandatory|description|
|----|----|----|----|
|token|String|YES|token symbol|

#### request return
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|balance|Number|the token's balance|

## getBalances

> example

```json
{
  "result": true,
  "balances": [
    {
      "symbol": "ETH",
      "balance": 0.13371396
    },
    {
      "symbol": "ZRX",
      "balance": 0
    },
    {
      "symbol": "DAI",
      "balance": 5.78464455
    },
    {
      "symbol": "KNC",
      "balance": 49.99451026
    },
    {
      "symbol": "MKR",
      "balance": 0
    },
    {
      "symbol": "OMG",
      "balance": 0
    },
    {
      "symbol": "SNT",
      "balance": 0
    },
    {
      "symbol": "MANA",
      "balance": 0
    }
  ]
}
```


Same as getBalance, but can get multiple balances. The market maker can get token balances of multiple `marketMakerProxyContract` contract through this interface.

<aside class="warning">
  If the market maker has N tokens, this interface will send N web3 requests at once. If the market maker calls this interface too frequently, it is likely to exceed the limit. Refer to this section <a href="#provider_url">PROVIDER_URL configuration</a>
</aside>


#### Request mode
GET

#### Request parameters
无

#### request return
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|balances|Array|balance item array|

## getOrdersHistory

> example

```json
{
  "result": true,
  "orders": [
    {
      "makerToken": "SNT",
      "takerToken": "ETH",
      "makerTokenAmount": 1000,
      "takerTokenAmount": 1,
      "quoteId": "234dsfasd-sdfasdf-sdfasf",
      "status": "success",
      "txHash": "0x953e9641811865e2a5da0bcfbee1c0da2f88e252efb9e782e60730ac0e730807",
      "timestamp": 1549349662
    }
  ]
}
```

The Market Maker can get the order of all transactions through this interface.

#### Request mode
GET

#### Request parameters
|Name|Type|Mandatory|description|
|----|----|----|----|
|page|Number|YES||
|perpage|Number|YES|per page|

#### request return
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|orders|Array|See the example|

## getOrderState

> example

```json
{
  "result": true,
  "order": {
    "makerToken": "SNT",
    "takerToken": "ETH",
    "makerTokenAmount": 1000,
    "takerTokenAmount": 1,
    "quoteId": "234dsfasd-sdfasdf-sdfasf",
    "status": "success",
    "txHash": "0x953e9641811865e2a5da0bcfbee1c0da2f88e252efb9e782e60730ac0e730807",
    "timestamp": 1549349662
  }
}
```

The Market Maker can get the order status of each transaction by quoteId through this interface.

#### Request mode
GET

#### Request parameters
|Name|Type|Mandatory|description|
|----|----|----|----|
|quoteId|String|YES|a unique value final order for tracking the offer, and if transaction|

#### request return
|Name|Type|description|
|----|----|----|
|result|Boolean|Whether Returned in normal conditions|
|order|Object|See the example|

## Appendix：order status
**corresponding `status` to an `order` can be:**

|status|description|
|----|----|
|unbroadcast | Order has not been forwarded by the service to the chain|
|pending | Transaction is in mempool, waiting to be mined|
|success | Successfully submitted on chain |
|failed | Failure of on-chain transaction|
|timeout | Timeout of transaction on chain|
|invalid | Order is invalid|
|abandoned| Order isn't be used|

<aside class="warning">
  <strong>For security reasons</strong>, we recommend to use https and set up white list access (Tokenlon will provide corresponding external access IP).
</aside>