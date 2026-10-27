export const VERSION = '6.0.0'

export const version = (ctx) => {
  ctx.body = {
    result: true,
    version: VERSION,
  }
}
