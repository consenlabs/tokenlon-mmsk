export const VERSION = '5.3.5'

export const version = (ctx) => {
  ctx.body = {
    result: true,
    version: VERSION,
  }
}
