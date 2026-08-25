import { View, Text, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../services/store'
import { Map } from '../components/Map'
import { BackButton } from '../components/BackButton'
import { CompassButton } from '../components/CompassButton'
import { BroadcastButton } from '../components/BroadcastButton'
import { DriverCard } from '../components/DriverCard'
import { Toast } from '../components/Toast'

const VEHICLES = [
	{ id: 1, code: 'JEEP-001' },
	{ id: 2, code: 'JEEP-002' },
	{ id: 3, code: 'JEEP-003' }
]

export default () => {
	const insets = useSafeAreaInsets()
	const vehicleId = useStore(s => s.vehicleId)
	const isBroadcasting = useStore(s => s.isBroadcasting)
	const setVehicleId = useStore(s => s.setVehicleId)

	return (
		<View className="flex-1">
			<Map />
			<BackButton />
			<Toast />
			<View style={{ top: insets.top + 8 }} className="absolute self-center bg-white/95 p-1 rounded-2xl shadow-lg flex-row gap-1 z-10">
				{VEHICLES.map(v => (
					<TouchableOpacity
						key={v.id}
						disabled={isBroadcasting}
						onPress={() => setVehicleId(v.id)}
						className={`px-3 py-1.5 rounded-xl ${vehicleId === v.id ? 'bg-emerald-600' : 'bg-transparent'} ${isBroadcasting && vehicleId !== v.id ? 'opacity-40' : 'opacity-100'}`}
					>
						<Text className={`text-xs font-black ${vehicleId === v.id ? 'text-white' : 'text-slate-600'}`}>
							{v.code}
						</Text>
					</TouchableOpacity>
				))}
			</View>
			<View style={{ bottom: insets.bottom + 80 }} className="absolute right-2 gap-2 z-10">
				<BroadcastButton />
				<CompassButton />
			</View>
			<DriverCard />
		</View>
	)
}
