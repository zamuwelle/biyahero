import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const ArrivalCard = () => {
	const insets = useSafeAreaInsets()
	const vehicles = useStore(s => s.vehicles)
	const isRadarActive = useStore(s => s.isRadarActive)
	const nearest = vehicles[0]

	return (
		<View
			style={{ bottom: insets.bottom + 8 }}
			className="absolute left-2 right-2 p-2 rounded-2xl bg-white shadow-lg flex-row items-center justify-between z-10 gap-2"
		>
			<View className="flex-row items-center gap-2">
				<View className={`w-12 h-12 rounded-xl ${nearest ? 'bg-blue-50' : 'bg-slate-100'} items-center justify-center`}>
					<MaterialIcons name="directions-bus" size={28} color={nearest ? '#2563eb' : '#64748b'} />
				</View>
				<View>
					<Text className="text-xs font-bold text-slate-400 uppercase">
						{nearest ? 'Nearest Transit' : 'Active Route'}
					</Text>
					<Text className="text-base font-black text-slate-900">
						{nearest ? nearest.vehicle_id : 'Route 1 · Manila'}
					</Text>
				</View>
			</View>

			<View className="items-end pr-2">
				<Text className={`text-base font-black ${nearest ? 'text-blue-600' : 'text-slate-500'}`}>
					{nearest ? (nearest.predicted_eta_minutes < 1 ? 'Arriving' : `${Math.round(nearest.predicted_eta_minutes)} mins`) : (isRadarActive ? 'Scanning' : 'Radar Off')}
				</Text>
				<Text className="text-xs font-semibold text-slate-400">
					{nearest ? `${Math.round(nearest.distance_km * 1000)} meters away` : (isRadarActive ? '2.0 km scan active' : 'Tap radar to scan')}
				</Text>
			</View>
		</View>
	)
}
