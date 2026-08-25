import { View } from 'react-native'
import MapView, { Circle, PROVIDER_GOOGLE } from 'react-native-maps'
import { useStore } from '../services/store'

export const Map = () => {
	const coords = useStore(s => s.coords)
	const isRadarActive = useStore(s => s.isRadarActive)
	const radiusKm = useStore(s => s.radiusKm)
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
			>
				{isRadarActive && coords && (
					<Circle
						center={coords}
						radius={radiusKm * 1000}
						fillColor="rgba(37, 99, 235, 0.08)"
						strokeColor="rgba(37, 99, 235, 0.35)"
						strokeWidth={1.5}
					/>
				)}
			</MapView>
		</View>
	)
}
