const { withProjectBuildGradle } = require('expo/config-plugins')

module.exports = (config) =>
	withProjectBuildGradle(config, (config) => {
		config.modResults.contents = config.modResults.contents.replace(
			'maven { url \'https://www.jitpack.io\' }',
			'maven { url \'https://www.jitpack.io\' }\n    maven { url \'https://api.mapbox.com/downloads/v2/releases/maven\' }\n    maven { url \'https://mapbox.bintray.com/maven\' }'
		)
		return config
	})
