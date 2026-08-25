import { View } from 'react-native'
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps'
import { useStore } from '../services/store'

export const Map = () => {
	const setMapRef = useStore(s => s.setMapRef)

	return (
		<View className="flex-1 overflow-hidden">
			<MapView
				ref={setMapRef}
				provider={PROVIDER_GOOGLE}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: -60 }}
				showsUserLocation
				showsMyLocationButton={false}
				showsCompass={false}
				toolbarEnabled={false}
			/>
		</View>
	)
}
