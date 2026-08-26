import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

const VEHICLES = [
	{ id: 1, code: 'JEEP-001' },
	{ id: 2, code: 'JEEP-002' },
	{ id: 3, code: 'JEEP-003' }
]

export const DriverCard = () => {
	const insets = useSafeAreaInsets()
	const vehicleId = useStore(s => s.vehicleId)
	const isBroadcasting = useStore(s => s.isBroadcasting)
	const current = VEHICLES.find(v => v.id === vehicleId) || VEHICLES[0]

	return (
		<View
			style={{ bottom: insets.bottom + 8 }}
			className="absolute left-2 right-2 p-2 rounded-2xl bg-white shadow-lg flex-row items-center justify-between z-10 gap-2"
		>
			<View className="flex-row items-center gap-2">
				<View className={`w-12 h-12 rounded-xl ${isBroadcasting ? 'bg-emerald-50' : 'bg-slate-100'} items-center justify-center`}>
					<MaterialIcons name="local-taxi" size={28} color={isBroadcasting ? '#059669' : '#64748b'} />
				</View>
				<View>
					<Text className="text-xs font-bold text-slate-400 uppercase">Driver Cockpit</Text>
					<Text className="text-base font-black text-slate-900">{current.code}</Text>
				</View>
			</View>

			<View className="items-end pr-2">
				<Text className={`text-base font-black ${isBroadcasting ? 'text-emerald-600' : 'text-slate-500'}`}>
					{isBroadcasting ? 'Broadcasting Live' : 'Off-Duty'}
				</Text>
				<Text className="text-xs font-semibold text-slate-400">
					{isBroadcasting ? 'GPS Transmitting' : 'Tap tower to broadcast'}
				</Text>
			</View>
		</View>
	)
}
