import { View } from 'react-native'
import { Map } from '../components/Map'
import { CompassButton } from '../components/CompassButton'

export default () => (
	<View className="flex-1">
		<Map />
		<CompassButton />
	</View>
)
