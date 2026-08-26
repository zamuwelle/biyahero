require('dotenv/config')

module.exports = ({ config }) => ({
	...config,
	name: 'Biyahero',
	slug: 'biyahero',
	scheme: 'biyahero',
	version: '1.0.1',
	orientation: 'portrait',
	icon: './src/assets/icon.png',
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
			foregroundImage: './src/assets/icon.png',
			backgroundImage: './src/assets/icon.png',
			monochromeImage: './src/assets/icon.png'
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
		favicon: './src/assets/icon.png'
	},
	plugins: ['expo-router'],
	extra: {
		apiUrl: process.env.API_URL,
		router: {},
		eas: {
			projectId: '7556787b-9d13-409d-996a-42a640c6de1d'
		}
	}
})
