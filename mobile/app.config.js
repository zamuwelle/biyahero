require('dotenv/config')

module.exports = ({ config }) => ({
	...config,
	name: 'Biyahero',
	slug: 'biyahero',
	scheme: 'biyahero',
	version: '1.0.2',
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
			// The launcher masks the foreground to its own shape and crops ~28%,
			// so the artwork is inset on a transparent canvas over a flat white.
			backgroundColor: '#FFFFFF',
			foregroundImage: './src/assets/icon-foreground.png',
			monochromeImage: './src/assets/icon-foreground.png'
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
	plugins: [
		'expo-router',
		[
			'expo-camera',
			{
				cameraPermission:
					'Ginagamit ang camera para kunan ng larawan ang lisensya mo para sa beripikasyon.'
			}
		],
		[
			'expo-location',
			{
				// Drivers only, and only while a trip is running.
				locationAlwaysAndWhenInUsePermission:
					'Ginagamit ang lokasyon mo habang may biyahe ka para makita ka ng mga pasahero.'
			}
		]
	],
	extra: {
		apiUrl: process.env.API_URL,
		router: {},
		eas: {
			projectId: '7556787b-9d13-409d-996a-42a640c6de1d'
		}
	}
})
