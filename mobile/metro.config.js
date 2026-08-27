const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const config = getDefaultConfig(__dirname)

// `@/` resolves to src/ — keeps deep imports readable from any screen depth.
config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName.startsWith('@/')) {
		return context.resolveRequest(context, path.resolve(__dirname, 'src', moduleName.slice(2)), platform)
	}
	return context.resolveRequest(context, moduleName, platform)
}

// Import .svg files as React components so the Figma glyphs stay vector and tintable.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo')
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg')
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg']

module.exports = withNativeWind(config, { input: './src/global.css' })
