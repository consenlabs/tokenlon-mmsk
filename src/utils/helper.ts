export const leftPadWith0 = (str, len) => {
  str = str + ''
  len = len - str.length
  if (len <= 0) return str
  return '0'.repeat(len) + str
}