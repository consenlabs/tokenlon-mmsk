import { expect } from 'chai';
import 'mocha'
import { signOrderByMaker } from '../src/0x/v3/sign_order'
import { PrivateKeyWalletSubprovider } from '@0x/subproviders'
import { Wallet } from 'ethers'

describe('0x/v3/sign_order', function() {
  it('signOrderByMaker', function() {
    const randomWallet  = Wallet.createRandom()
    const pkw = new PrivateKeyWalletSubprovider(process.env.WALLET_PRIVATE_KEY)
    signOrderByMaker({
      userAddr: randomWallet.address,
      rate: 200,
      simpleOrder: {
        base: 'ETH',
        quote: 'DAI',
        side: 'BUY',
        amount: 1,
      },
      tokenList: [
        {
          symbol: 'ETH', decimal: 18, address: '0xd0a1e359811322d97991e03f863a0c30c2cf029c'
        },
        {
          symbol: 'DAI', decimal: 18, address: '0xc7cc3413f169a027dccfeffe5208ca4f38ef0c40'
        }
      ],
    }, pkw).then(function(order) {
      expect(order.signature.length).to.greaterThan(0)
    })
  })

})
