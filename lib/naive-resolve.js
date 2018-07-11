const mapValues = require('lodash/mapValues')

module.exports = function naiveResolve (data, locale, seen) {
  seen = seen || new Map()
  // Return cached result if an obj has previously been resolved
  if (seen.has(data)) {
    return seen.get(data)
  }

  let res = {}
  seen.set(data, res)

  Object.keys(data).forEach(key => {
    let value = data[key][locale.code]
    if (Array.isArray(value)) {
      value = value.map(item => {
        if (item.fields) {
          return naiveResolve(item.fields, locale, new Map(seen.entries()))
        }
        return item
      })
    }
    if (value && value.fields) {
      value = naiveResolve(value.fields, locale, new Map(seen.entries()))
    }
    res[key] = value
  })

  return res
}
