import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const ArrivalCard = () => {
	const insets = useSafeAreaInsets()
	const vehicles = useStore(s => s.vehicles)
	const nearest = vehicles[0]

	if (!nearest) return null

	return (
		<View
			style={{ bottom: insets.bottom + 8 }}
			className="absolute left-2 right-2 p-2 rounded-2xl bg-white shadow-lg flex-row items-center justify-between z-10 gap-2"
		>
			<View className="flex-row items-center gap-2">
				<View className="w-12 h-12 rounded-xl bg-blue-50 items-center justify-center">
					<MaterialIcons name="directions-bus" size={28} color="#2563eb" />
				</View>
				<View>
					<Text className="text-xs font-bold text-slate-400 uppercase">Nearest Transit</Text>
					<Text className="text-base font-black text-slate-900">{nearest.vehicle_id}</Text>
				</View>
			</View>
			<View className="items-end pr-2">
				<Text className="text-lg font-black text-blue-600">
					{nearest.predicted_eta_minutes < 1 ? 'Arriving' : `${Math.round(nearest.predicted_eta_minutes)} mins`}
				</Text>
				<Text className="text-xs font-semibold text-slate-500">{Math.round(nearest.distance_km * 1000)} meters away</Text>
			</View>
		</View>
	)
}
