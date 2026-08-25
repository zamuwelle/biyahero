import { View } from 'react-native'
import { Map } from '../components/Map'
import { CompassButton } from '../components/CompassButton'

export default () => (
	<View className="flex-1">
		<Map />
		<View className="absolute right-4 bottom-8 gap-2">
			<CompassButton />
		</View>
	</View>
)
