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

// npm leaves dot-prefixed staging directories inside node_modules (e.g.
// `.react-native-css-interop-1RWvIT5x`). They are never part of a build, and a
// half-written one stops Metro's crawler dead rather than being skipped.
// The character class covers both path separators so this holds on Windows.
config.resolver.blockList = /node_modules[\\/]\.[^\\/]+[\\/].*/

// Import .svg files as React components so the Figma glyphs stay vector and tintable.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer/expo')
config.resolver.assetExts = config.resolver.assetExts.filter(ext => ext !== 'svg')
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg']

module.exports = withNativeWind(config, { input: './src/global.css' })
