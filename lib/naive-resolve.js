const mapValues = require('lodash/mapValues')

const depth = 2

module.exports = function naiveResolve (data, locale, seen) {
  seen = seen || new WeakMap()
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
          return naiveResolve(item.fields, locale, seen)
        }
        return item
      })
    }
    if (value && value.fields) {
      return naiveResolve(value.fields, locale, seen)
    }
    return value
  })
}
