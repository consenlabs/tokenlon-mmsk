const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

const randomString = (length) => {
  const arr = []
  for (; length--; ) {
    arr.push(possible.charAt(Math.floor(Math.random() * possible.length)))
  }
  return arr.join('')
}

export const generateQuoteId = () => {
  return `${randomString(8)}-${randomString(4)}-${randomString(4)}-${randomString(4)}-${randomString(12)}`
}