# Interfaces for Market-Makers

The market maker needs to implement following 5 **Tokenlon-MMSK** interfaces:

1. The pairs interface asks market maker for authorized trading currency pairs
2. The indicativePrice interface asks market maker to provide a reference price for a specific trading currency pair
3. The price interface asks the market maker quoting prices for a specific trading amount
4. The deal interface: Once the quote confirmed by the users, the Tokenlon Server will push an order to the MMSK, and MMSK then notifies the market maker via the deal interface
5. The exception interface: Once the order has some exception situation, the Tokenlon Server will push an exception order to the MMSK, and MMSK then notifies the market maker via the exception interface

## HTTP approach

### pairs interface

> Request

```bash
curl 'HTTP_SERVER_ENDPOINT/pairs'
```

> Response

```json
// Returned in normal conditions
{
  "result": true,
  "pairs": [
    "SNT/ETH",
    "OMG/ETH",
    "DAI/ETH"
  ]
}

// Returned in other circumstances
{
  "result": false,
  "message": "Exception"
}
```

Request address: `HTTP_SERVER_ENDPOINT/pairs`

<aside class="warning">
<code>pairs</code> array item represents a trading pair, such as <code>"SNT/ETH"</code> Market makers need to support <code>{ base: 'SNT', quote: 'ETH' }</code> and <code>{ base: 'ETH', quote: 'SNT' }</code>.
</aside>

#### Parameter
GET

#### return
none

#### request return


##### Returned in normal conditions

|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|pairs|Array|pair string array|

##### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|message|String|possible error information|

### indicativePrice interface

> Request

```bash
curl 'HTTP_SERVER_ENDPOINT/indicativePrice?base=SNT&quote=OMG&amount=30&side=BUY'
```

> Response

```json
// Returned in normal conditions
{
  "result": true,
  "exchangeable": true,
  "price": 0.00017508,
  "minAmount": 0.0002,
  "maxAmount": 100
}

// Returned in other circumstances
{
  "result": false,
  "exchangeable": false,
  "minAmount": 0.0002,
  "maxAmount": 100,
  "message": "insufficient balance"
}
```

Request URL: `HTTP_SERVER_ENDPOINT/indicativePrice`

<aside class="warning">
In the indicativePrice interface，<code>amount</code> can be <code>0</code> or <code>undefined</code>The primary use for this is the initial price, that is displayed when the user hasn’t yet entered a quantity into the exchange frontend, and at that time, the <strong>Indicative Price</strong> need is expected to response an price without amount.  After the user entered an <code>amount</code> into the frontend，if that amount is valid(can accept this amount's trade) the <strong>Indicative Price</strong>  is expected to be close to <strong>Quotes/Deal Price</strong>
</aside>

#### Request return
GET

#### Request parameters
|Name|Type|Mandatory|Description|
|----|----|----|----|
|base|String|YES|base symbol|
|quote|String|YES|quote symbol|
|side|String|YES|'BUY' or 'SELL'|
|amount|Number|**NO**|**BUY** or **SELL** base amount|

#### Request return

##### Returned in normal conditions
|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|price|Number||

##### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|message|String|possible error information|



### price interface

> Request

```bash
curl 'HTTP_SERVER_ENDPOINT/price?base=SNT&quote=OMG&amount=30&side=BUY&uniqId=dfdsfjsidf'
```

> Response

```json
// Returned in normal conditions
{
  "result": true,
  "exchangeable": true,
  "price": 0.00017508,
  "minAmount": 0.0002,
  "maxAmount": 100,
  "quoteId": "asfadsf-dsfsdf-ggsd-qwe-rgjty"
}

// Returned in other circumstances
{
  "result": false,
  "exchangeable": false,
  "minAmount": 0.0002,
  "maxAmount": 100,
  "message": "insufficient balance"
}
```

Request URL: `HTTP_SERVER_ENDPOINT/price`

<aside class="warning">
Market maker need to lock his/her inventory - according to the <code>uniqId</code> (<strong><code>uniqId: pujft40a</code>、<code>uniqId: pujft40a-1</code>、<code>uniqId: pujft40a-2</code> are treated as the same <code>uniqId</code></strong>) of the user. The market maker needs to return the quoteId to track orders’ life-cycle. If the order corresponding to the <code>quoteId</code> exceeds 30s and the <code>deal</code> interface does not receive the order confirmed notification corresponding to the <code>quoteId</code>, the quotes corresponding to the <code>quoteId</code> is considered invalid and the position locks can be removed.
</aside>

#### Request return
GET

#### Request parameters
|Name|Type|Mandatory|Description|
|----|----|----|----|
|base|String|YES|base symbol|
|quote|String|YES|quote symbol|
|side|String|YES|'BUY' or 'SELL'|
|amount|Number|**YES**|**BUY** or **SELL** base amount|
|uniqId|String|**YES**|Identifies each unique user|

#### Request return

##### Returned in normal conditions
|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|price|Number||
|quoteId|String|A unique value used to track the final order of the quotation and the transaction status.|

##### Returned in other circumstances
|Name|Type|Description|
|----|----|----|
|result|Boolean|whether normal return|
|exchangeable|Boolean|Whether is tradable|
|minAmount|Number|The minimum amount that base token can be traded|
|maxAmount|Number|The maximum amount that base token can be traded|
|message|String|possible error information|

### deal interface

> Request

```bash
curl -X POST \
  HTTP_SERVER_ENDPOINT/deal \
  -H 'Content-Type: application/json' \
  -H 'cache-control: no-cache' \
  -d '{"makerToken": "SNT","takerToken":"OMG","makerTokenAmount":30,"takerTokenAmount":0.1,"quoteId":"234dsfasd-sdfasdf-sdfasf","timestamp":1231234324}'
```

> Response

```json
{
  "result": true
}
```

Request address: `HTTP_SERVER_ENDPOINT/deal`

#### Request return
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

#### Request return
|Name|Type|Description|
|----|----|----|
|result|Boolean|<span style="color:#FF4136;font-weight:bold;">We suggest you just return `true`, If you return `false`，imToken will always retry to send this notification to you, and it maybe repeat your hedge.</span>|


### exception interface

> Request

```bash
curl -X POST \
  HTTP_SERVER_ENDPOINT/exception \
  -H 'Content-Type: application/json' \
  -H 'cache-control: no-cache' \
  -d '{"makerToken": "SNT","takerToken":"OMG","makerTokenAmount":30,"takerTokenAmount":0.1,"quoteId":"234dsfasd-sdfasdf-sdfasf","timestamp":1231234324,"type":"FAILED"}'
```

> Response

```json
{
  "result": true
}
```

#### Parameter
|Name|Type|Mandatory|Description|
|----|----|----|----|
|makerToken|String|YES|token symbol|
|takerToken|String|YES|token symbol|
|makerTokenAmount|Number|YES|maker token's amount|
|takerTokenAmount|Number|YES|taker token's amount|
|quoteId|String|YES|quoteId from price interface|
|type|String|YES|'FAILED' means that order failed; 'TIMEOUT' means that order timeout(also failed too)；'DELAY' means that order is executed but Tokenlon didn't notify MM by deal API |
|timestamp|Number|YES||

#### return
|Name|Type|Description|
|----|----|----|
|result|Boolean|<span style="color:#FF4136;font-weight:bold;">We suggest you just return `true`, **If you return `false`，imToken will always retry to send this notification to you, and it maybe repeat your processing.</span>|