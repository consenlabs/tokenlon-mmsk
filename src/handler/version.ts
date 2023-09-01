export const VERSION = '5.3.1'

export const version = (ctx) => {
  ctx.body = {
    result: true,
    version: VERSION,
  }
}
