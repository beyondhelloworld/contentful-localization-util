const isObject = require('lodash/isObject')
const memoize = require('lodash/memoize')
const mapValues = require('lodash/mapValues')

const naiveResolve = require('./lib/naive-resolve')

const makeGetFields = contentful => memoize(async contentType => {
  const type = await contentful.getContentType(contentType)
  return type.fields
})

const getLocales = async contentful => {
  const space = await contentful.getSpace()
  return space.locales
}

const isEntry = data => isObject(data) && data.sys && data.sys.type === 'Entry'
const isAsset = data => isObject(data) && data.sys && data.sys.type === 'Asset'
const isLink = data => isObject(data) && data.sys && data.sys.contentType.sys.type

const makeResolve = ({locale, defaultLocale, getFields}) => {
  return async function resolve ({data, defaultData, seen}) {
    seen = seen || new Map()
    // Return cached result if an obj has previously been resolved
    if (seen.has(data)) {
      return seen.get(data)
    }
    // If data is not an entry, we reached a primitive value
    // we can return.
    if (!isEntry(data) && !isAsset(data)) {
      return data
    }

    // Assets are localized, but only one level deep. so we can resolve naively:
    if (isAsset(data)) {
      return mapValues(data.fields, value => {
        if (value[locale.code] !== undefined) {
          return value[locale.code]
        }
        return value[defaultLocale.code]
      })
    }

    const result = {
      locale$$: locale,
    }
    seen.set(data, result)

    const contentType = data.sys.contentType.sys.id
    const fields = await getFields(contentType)
    for (let key of Object.keys(data.fields)) {
      const value = data.fields[key]
      const field = fields.find(field => field.id === key)

      if (field.localized) {
        if (value[locale.code] !== undefined) {
          if (Array.isArray(value[locale.code])) {
            let subresult = []
            for (let i in value[locale.code]) {
              const item = value[locale.code][i]
              let res
              try {
                res = await resolve({
                  data: item,
                  defaultData: defaultData[key][i],
                  seen,
                })
                subresult.push(res)
              } catch (e) {
                // "Many references" fields fall back to default locale
                if (isLink(item)) {
                  res = defaultData[key][i]
                  res.locale$$ = defaultLocale
                  subresult.push(res)
                } else {
                  throw new Error(`${e.message}\n\tin localized field "${field.id}" of type "${field.type}" for key "${key}"`)
                }
              }
            }
            result[key] = subresult
            continue
          }

          let subresult
          try {
            subresult = await resolve({
              data: value[locale.code],
              defaultData: defaultData[key],
              seen,
            })
          } catch (e) {
            // Append kind a "stack-trace-like" message so the error can be
            // traced back to the entry that was incomplete.
            throw new Error(`${e.message}\n\tin localized field "${field.id}" of type "${field.type}" for key "${key}"`)
          }
          result[key] = subresult
          continue
        }

        // if not value[locale.code] && field.required
        if (field.required) {
          throw new Error(`Required, localized field "${field.id}" of type "${field.type}" is missing value for key "${key}" for locale "${locale.code}".`)
        }

        // log('yellow')(`Non-required localized field ${field.id} will be set to null for locale ${locale.code}`)
        result[key] = null
        continue
      }

      if (Array.isArray(value[defaultLocale.code])) {
        let subresult = []
        for (const i in value[defaultLocale.code]) {
          const item = value[defaultLocale.code][i]
          let res
          try {
            res = await resolve({
              data: item,
              defaultData: defaultData[key][i],
              seen,
            })
            subresult.push(res)
          } catch (e) {
            // "Many references" fields fall back to default locale
            if (isLink(item)) {
              res = defaultData[key][i]
              res.locale$$ = defaultLocale
              subresult.push(res)
            } else {
              throw new Error(`${e.message}\n\tin localized field "${field.id}" of type "${field.type}" for key "${key}"`)
            }
          }
        }
        result[key] = subresult
        continue
      }

      let subresult
      try {
        subresult = await resolve({
          data: value[defaultLocale.code],
          defaultData: defaultData[key],
          seen,
        })
      } catch (e) {
        // Append kind a "stack-trace-like" message so the error can be
        // traced back to the entry that was incomplete.
        throw new Error(`${e.message}\n\tin non-localized field "${field.id}" of type Link for key "${key}"`)
      }
      result[key] = subresult
    }
    return result
  }
}

// Returns dataByLocale
module.exports = async client => {
  const getFields = makeGetFields(client)
  const locales = await getLocales(client)
  const defaultLocale = locales.filter(locale => locale.default)[0]
  return {
    locales,
    defaultLocale,
    resolve: async data => {
      const dataByLocale = {}
      const errorsByLocale = {}
      const defaultData = dataByLocale[defaultLocale.code] = naiveResolve(data.fields, defaultLocale)
      const alternativeLocales = locales.filter(locale => locale !== defaultLocale)
      await Promise.all(alternativeLocales.map(async locale => {
        const resolve = makeResolve({locale, defaultLocale, getFields})
        let fields
        try {
          fields = await resolve({data, defaultData})
        } catch (e) {
          return errorsByLocale[locale.code] = e.message + `\n\t for locale ${locale.code}`
        }
        dataByLocale[locale.code] = fields
      }))
      return {data: dataByLocale, errors: errorsByLocale}
    }
  }
}
