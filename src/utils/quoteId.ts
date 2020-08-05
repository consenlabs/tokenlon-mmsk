import { updaterStack } from '../worker'

const getPrefix = () => `${updaterStack.markerMakerConfigUpdater.cacheResult.mmId}--`

export const addQuoteIdPrefix = (quoteId) => `${getPrefix()}${quoteId}`

export const removeQuoteIdPrefix = (quoteId) => {
  const prefix = getPrefix()
  if (quoteId.startsWith(prefix)) return quoteId.replace(prefix, '')
  return quoteId
}
