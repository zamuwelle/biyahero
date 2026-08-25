require('dotenv/config')

module.exports = ({ config }) => ({
	...config,
	name: 'Biyahero',
	slug: 'biyahero',
	scheme: 'biyahero',
	version: '1.0.1',
	orientation: 'portrait',
	icon: './assets/icon.png',
	userInterfaceStyle: 'light',
	ios: {
		supportsTablet: true,
		bundleIdentifier: 'com.anonymous.biyahero',
		config: {
			googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
		}
	},
	android: {
		adaptiveIcon: {
			backgroundColor: '#E6F4FE',
			foregroundImage: './assets/android-icon-foreground.png',
			backgroundImage: './assets/android-icon-background.png',
			monochromeImage: './assets/android-icon-monochrome.png'
		},
		package: 'com.anonymous.biyahero',
		config: {
			googleMaps: {
				apiKey: process.env.GOOGLE_MAPS_API_KEY
			}
		}
	},
	web: {
		bundler: 'metro',
		favicon: './assets/favicon.png'
	},
	plugins: ['expo-router'],
	extra: {
		router: {},
		eas: {
			projectId: '7556787b-9d13-409d-996a-42a640c6de1d'
		}
	}
})
