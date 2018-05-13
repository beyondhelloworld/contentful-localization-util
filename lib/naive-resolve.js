const mapValues = require('lodash/mapValues')

module.exports = function naiveResolve (data, locale, seen, depth = 1) {
  seen = seen || new Map()
  // Stop & return null if an obj has previously been resolved ${depth} times
  if (seen.has(data) && seen.get(data) >= depth) {
    return null
  }
  seen.set(data, seen.has(data) ? seen.get(data) + 1 : 1)

  return mapValues(data, value => {
    value = value[locale.code]
    if (Array.isArray(value)) {
      value = value.map(item => {
        if (item.fields) {
          return naiveResolve(item.fields, locale, new Map(seen.entries()), depth)
        }
        return item
      })
    }
    if (value && value.fields) {
      return naiveResolve(value.fields, locale, new Map(seen.entries()), depth)
    }
    return value
  })
}
