const mapValues = require('lodash/mapValues')

module.exports = function naiveResolve (data, locale) {
  return mapValues(data, value => {
    value = value[locale.code]
    if (Array.isArray(value)) {
      value = value.map(item => {
        if (item.fields) {
          return naiveResolve(item.fields, locale)
        }
        return item
      })
    }
    if (value && value.fields) {
      return naiveResolve(value.fields, locale)
    }
    return value
  })
}
