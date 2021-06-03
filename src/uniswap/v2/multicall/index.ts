import { Interface, Fragment, JsonFragment } from '@ethersproject/abi'
import { Contract } from '@ethersproject/contracts'
import { abi as multicallAbi } from '../abi/Multicall.json'

export const MULTICALL: Record<string, string> = {
  '1': '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',
  '3': '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
  '4': '0x42ad527de7d4e9d9d011ac45b31d8551f8fe9821',
  '5': '0x77dca2c955b15e9de4dbbcf1246b4b85b651e50e',
  '6': '0x53c43764255c17bd724f74c4ef150724ac50a3ed',
  '17': '0xB9cb900E526e7Ad32A2f26f1fF6Dee63350fcDc5',
  '42': '0x2cc8688c5f75e365aaeeb4ea8d6a480405a48d2a',
  '56': '0x1ee38d535d541c55c9dae27b12edf090c608e6fb',
  '82': '0x579De77CAEd0614e3b158cb738fcD5131B9719Ae',
  '97': '0x8b54247c6BAe96A6ccAFa468ebae96c4D7445e46',
  '100': '0xb5b692a88bdfc81ca69dcb1d924f59f0413a602a',
  '128': '0x37ab26db3df780e7026f3e767f65efb739f48d8e',
  '137': '0xCBca837161be50EfA5925bB9Cc77406468e76751',
  '256': '0xC33994Eb943c61a8a59a918E2de65e03e4e385E0',
  '1337': '0x566131e85d46cc7BBd0ce5C6587E9912Dc27cDAc',
  '2109': '0x7E9985aE4C8248fdB07607648406a48C76e9e7eD',
  wanchain: '0xba5934ab3056fca1fa458d30fbb3810c3eb5145f',
  '250': '0x7f6A10218264a22B4309F3896745687E712962a0'
}

export async function multicall(
  provider: any,
  chainId: number,
  abi: string | Array<Fragment | JsonFragment | string>,
  calls: any,
  options?: any,
  decode: boolean = true,
) {
  const multi = new Contract(MULTICALL[chainId.toString()], multicallAbi, provider)
  const itf = new Interface(abi)
  try {
    const [, res] = await multi.aggregate(
      calls.map((call: any) => [
        call[0].toLowerCase(),
        itf.encodeFunctionData(call[1], call[2])
      ]),
      options || {}
    )
    if (decode) {
      return res.map((call: any, i: number) => itf.decodeFunctionResult(calls[i][1], call));
    }
    return res
  } catch (e) {
    return Promise.reject(e);
  }
}