# contentful-localization-util

> Utility for resolving a responses from the contentful SDK for a given locale

## The problem

Contentful allows the user to specify more than one locale per space. Individual fields in the content model can be defined as "localized" or not. Each field may independent of the localization be marked as "required" or not. Contentful also allows to set a fallback locale for when an entry doesn't have a localization.

It turns out that this isn't sufficient to infer the correct values for a given entry for a given locale on its own. Rather, when you want to get a complete object of the localized values of an entire entry for a certain locale, you need to consider whether a field is localized, required and part of a collection or not.

## The solution

This utility provides a resolve function that runs an algorithm to completely resolve an entry for each of the space's locale. The algorithm resolves the tree of field values and references (also called links) down to the last leave and also handles circular references. It determines each field's value by checking whether the field is localized and required and also whether it is part of a collection.

When an entry cannot be resolved for a certain locale, a stacktrace-like error object is returned instead for this locale.

## Usage

This package builds upon the official [contentful.js](https://www.npmjs.com/package/contentful) SDK. This SDK will return a `client` object, which is what you need to pass to the utility as follows:

```javascript
import util from 'contentful-localization-util'
const { locales, defaultLocale, resolve } = await util(client)
```

The default exported function takes a contentful `client` object and returns an object. The returned object contains the space's `locales`, the space's `defaultLocale` and a `resolve` function. Given any entry, the `resolve` function asynchronously resolves the entry and returns an object with the properties `data` and `errors`.

```javascript
let {data, errors} = await resolve(entry)
console.log(data[locales[0].code]) // { ... }
console.log(errors[locales[1].code]) // "..."
```

The above code example assumes that the entry could be resolved for the first locale but not for the second one. Hence the `data` object has a property with the key equal to `locales[0].code` and a value of type object and the `errors` object has a property with the key equal to `locales[1].code` and a value of type string (the error "stacktrace").

## Errors

The `error` object has a property for each locale - the property's key is the locale code - for which the entry could not be resolved. The reason why an entry cannot be resolved might located deep into the tree of fields and references to other entrys and their fields and so on. To be able to find the error, it bubbles up to the entry, creating a stracktrace-like string.
