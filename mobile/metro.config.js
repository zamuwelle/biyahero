const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const config = getDefaultConfig(__dirname)

config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName.startsWith('@/')) {
		return context.resolveRequest(context, path.resolve(__dirname, 'src', moduleName.slice(2)), platform)
	}
	return context.resolveRequest(context, moduleName, platform)
}

module.exports = withNativeWind(config, { input: './src/global.css' })