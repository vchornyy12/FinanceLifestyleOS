const { withNativeWind } = require('nativewind/babel')

/** @type {import('@babel/core').TransformOptions} */
module.exports = function (api) {
  api.cache(true)
  return withNativeWind(
    {
      presets: ['babel-preset-expo'],
    },
    { input: './global.css' }
  )
}
