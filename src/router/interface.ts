export interface QueryInterface {
  base: string
  quote: string
  side: 'BUY' | 'SELL'
  amount?: number
  feefactor?: number
  uniqId?: number | string
  userAddr?: string
}