import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Map } from '../components/Map'
import { BackButton } from '../components/BackButton'
import { CompassButton } from '../components/CompassButton'

export default () => {
	const insets = useSafeAreaInsets()
	return (
		<View className="flex-1">
			<Map />
			<BackButton />
			<View style={{ bottom: insets.bottom + 8 }} className="absolute right-2 gap-2 z-10">
				<CompassButton />
			</View>
		</View>
	)
}
