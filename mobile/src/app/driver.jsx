import { useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '@/services/store'
import { Map } from '@/components/Map'
import { IconButton } from '@/components/IconButton'
import { BottomCard } from '@/components/BottomCard'

const VEHICLES = [
	{ id: 1, code: 'JEEP-001' },
	{ id: 2, code: 'JEEP-002' },
	{ id: 3, code: 'JEEP-003' }
]

export default () => {
	const insets = useSafeAreaInsets()
	const vehicleId = useStore(s => s.vehicleId)
	const isBroadcasting = useStore(s => s.isBroadcasting)
	const toggleBroadcast = useStore(s => s.toggleBroadcast)
	const stopBroadcast = useStore(s => s.stopBroadcast)
	const setVehicleId = useStore(s => s.setVehicleId)
	const current = VEHICLES.find(v => v.id === vehicleId) || VEHICLES[0]

	useEffect(() => () => stopBroadcast(), [])

	return (
		<View className="flex-1">
			<Map action={<IconButton name="cell-tower" size={32} color={isBroadcasting ? '#059669' : '#94a3b8'} onPress={toggleBroadcast} />} />
			<View style={{ top: insets.top + 8 }} className="absolute self-center bg-white/95 p-2 rounded-2xl shadow-lg flex-row gap-2 z-10">
				{VEHICLES.map(v => (
					<TouchableOpacity
						key={v.id}
						disabled={isBroadcasting}
						activeOpacity={0.75}
						onPress={() => setVehicleId(v.id)}
						className={`px-4 py-2 rounded-xl ${vehicleId === v.id ? 'bg-emerald-600' : 'bg-transparent'} ${isBroadcasting && vehicleId !== v.id ? 'opacity-40' : 'opacity-100'}`}
					>
						<Text className={`text-xs font-black ${vehicleId === v.id ? 'text-white' : 'text-slate-600'}`}>{v.code}</Text>
					</TouchableOpacity>
				))}
			</View>
			<BottomCard
				icon="drive-eta"
				iconBg={isBroadcasting ? 'bg-emerald-50' : 'bg-slate-100'}
				iconColor={isBroadcasting ? '#059669' : '#64748b'}
				label="Driver"
				title={current.code}
				status={isBroadcasting ? 'Live' : 'Off-Duty'}
				statusColor={isBroadcasting ? 'text-emerald-600' : 'text-slate-500'}
			/>
		</View>
	)
}
