const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)
config.watchFolders = [path.resolve(__dirname, 'modules/android-sms')]
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, 'modules/android-sms'),
]

module.exports = config
