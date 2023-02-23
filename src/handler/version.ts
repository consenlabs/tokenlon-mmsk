export const VERSION = '5.2.9'

export const version = (ctx) => {
  ctx.body = {
    result: true,
    version: VERSION,
  }
}
