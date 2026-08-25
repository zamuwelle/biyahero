import { View } from 'react-native'
import { Map } from '../components/Map'
import { RadarButton } from '../components/RadarButton'
import { CompassButton } from '../components/CompassButton'

export default () => (
	<View className="flex-1">
		<Map showRadar />
		<View className="absolute right-4 bottom-8 gap-2">
			<RadarButton />
			<CompassButton />
		</View>
	</View>
)
