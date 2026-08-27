import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '@/services/store'
import { Map } from '@/components/Map'
import { IconButton } from '@/components/IconButton'
import { BottomCard } from '@/components/BottomCard'

const FILTERS = ['All', 'Jeepney', 'E-Jeep', 'Bus', 'UV Express']

const OCCUPANCY_CONFIG = {
	available: { label: 'Seats Available', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
	moderate: { label: 'Moderate', bg: 'bg-amber-50 text-amber-700 border-amber-200' },
	full: { label: 'Full', bg: 'bg-red-50 text-red-700 border-red-200' }
}

export default () => {
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const vehicles = useStore(s => s.vehicles)
	const isRadarActive = useStore(s => s.isRadarActive)
	const toggleRadar = useStore(s => s.toggleRadar)
	const startRadar = useStore(s => s.startRadar)
	const stopRadar = useStore(s => s.stopRadar)
	const vehicleFilter = useStore(s => s.vehicleFilter)
	const setVehicleFilter = useStore(s => s.setVehicleFilter)
	const searchQuery = useStore(s => s.searchQuery)
	const setSearchQuery = useStore(s => s.setSearchQuery)
	const selectedVehicle = useStore(s => s.selectedVehicle)
	const setSelectedVehicle = useStore(s => s.setSelectedVehicle)

	useEffect(() => {
		startRadar()
		return () => stopRadar()
	}, [])

	const filtered = vehicles.filter(v => {
		const matchesFilter = vehicleFilter === 'all' || (v.vehicle_type && v.vehicle_type.toLowerCase() === vehicleFilter.toLowerCase()) || (v.model && v.model.toLowerCase().includes(vehicleFilter.toLowerCase()))
		const matchesQuery = !searchQuery || (v.destination && v.destination.toLowerCase().includes(searchQuery.toLowerCase())) || (v.vehicle_id && v.vehicle_id.toLowerCase().includes(searchQuery.toLowerCase())) || (v.plate_number && v.plate_number.toLowerCase().includes(searchQuery.toLowerCase()))
		return matchesFilter && matchesQuery
	})

	const nearest = filtered[0] || null

	return (
		<View className="flex-1">
			<Map showRadar action={<IconButton name="radar" size={32} color={isRadarActive ? '#2563eb' : '#94a3b8'} onPress={toggleRadar} />} />

			<View style={{ top: insets.top + 8 }} className="absolute left-4 right-4 z-20 gap-2">
				<View className="bg-white/95 rounded-2xl p-2 shadow-lg flex-row items-center gap-2 border border-slate-100">
					<TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} className="p-2">
						<MaterialIcons name="arrow-back" size={22} color="#0f172a" />
					</TouchableOpacity>
					<TextInput
						value={searchQuery}
						onChangeText={setSearchQuery}
						placeholder="Where to?"
						className="flex-1 text-slate-900 font-bold text-sm py-2"
					/>
					{!!searchQuery && (
						<TouchableOpacity onPress={() => setSearchQuery('')} className="p-2">
							<MaterialIcons name="close" size={20} color="#64748b" />
						</TouchableOpacity>
					)}
				</View>

				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
					{FILTERS.map(f => (
						<TouchableOpacity
							key={f}
							onPress={() => setVehicleFilter(f.toLowerCase())}
							activeOpacity={0.75}
							className={`px-4 py-2 rounded-xl shadow-sm ${vehicleFilter === f.toLowerCase() ? 'bg-slate-900' : 'bg-white/95'}`}
						>
							<Text className={`text-xs font-black ${vehicleFilter === f.toLowerCase() ? 'text-white' : 'text-slate-700'}`}>{f}</Text>
						</TouchableOpacity>
					))}
				</ScrollView>
			</View>

			{selectedVehicle ? (
				<View style={{ bottom: insets.bottom + 8 }} className="absolute left-2 right-2 p-4 rounded-3xl bg-white shadow-xl z-20 gap-3 border border-slate-100">
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-3">
							<View className="w-12 h-12 rounded-2xl bg-blue-50 items-center justify-center">
								<MaterialIcons name="directions-bus" size={26} color="#2563eb" />
							</View>
							<View>
								<View className="flex-row items-center gap-2">
									<Text className="text-lg font-black text-slate-900">{selectedVehicle.destination}</Text>
									<View className="px-2 py-0.5 bg-emerald-50 rounded-lg">
										<Text className="text-emerald-700 font-black text-[10px]">VERIFIED</Text>
									</View>
								</View>
								<Text className="text-xs font-bold text-slate-400">{selectedVehicle.plate_number} · {selectedVehicle.model}</Text>
							</View>
						</View>
						<IconButton name="close" size={20} onPress={() => setSelectedVehicle(null)} />
					</View>

					<View className="flex-row items-center justify-between pt-2 border-t border-slate-100">
						<View className={`px-3 py-1 rounded-xl border ${OCCUPANCY_CONFIG[selectedVehicle.occupancy]?.bg || 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
							<Text className="text-xs font-black">{OCCUPANCY_CONFIG[selectedVehicle.occupancy]?.label || 'Seats Available'}</Text>
						</View>
						<View className="items-end">
							<Text className="text-base font-black text-blue-600">
								{selectedVehicle.predicted_eta_minutes < 1 ? 'Arriving' : `${Math.round(selectedVehicle.predicted_eta_minutes)} mins`}
							</Text>
							<Text className="text-xs font-semibold text-slate-400">{Math.round(selectedVehicle.distance_km * 1000)}m away</Text>
						</View>
					</View>
				</View>
			) : (
				<BottomCard
					icon="directions-bus"
					iconBg={nearest ? 'bg-blue-50' : 'bg-slate-100'}
					iconColor={nearest ? '#2563eb' : '#64748b'}
					label={nearest ? nearest.destination : 'Active Route'}
					title={nearest ? nearest.plate_number : 'Route · City'}
					status={nearest ? (nearest.predicted_eta_minutes < 1 ? 'Arriving' : `${Math.round(nearest.predicted_eta_minutes)} mins`) : (isRadarActive ? 'Scanning' : 'Radar Off')}
					statusColor={nearest ? 'text-blue-600' : 'text-slate-500'}
					subtext={nearest ? `${Math.round(nearest.distance_km * 1000)} meters away · ${OCCUPANCY_CONFIG[nearest.occupancy]?.label || 'Seats Available'}` : (isRadarActive ? '2.0 km scan active' : '')}
				/>
			)}
		</View>
	)
}
