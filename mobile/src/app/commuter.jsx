import { useEffect } from 'react'
import { View } from 'react-native'
import { useStore } from '@/services/store'
import { Map } from '@/components/Map'
import { IconButton } from '@/components/IconButton'
import { BottomCard } from '@/components/BottomCard'

export default () => {
	const vehicles = useStore(s => s.vehicles)
	const isRadarActive = useStore(s => s.isRadarActive)
	const toggleRadar = useStore(s => s.toggleRadar)
	const startRadar = useStore(s => s.startRadar)
	const stopRadar = useStore(s => s.stopRadar)
	const nearest = vehicles[0]

	useEffect(() => {
		startRadar()
		return () => stopRadar()
	}, [])

	return (
		<View className="flex-1">
			<Map showRadar action={<IconButton name="radar" size={32} color={isRadarActive ? '#2563eb' : '#94a3b8'} onPress={toggleRadar} />} />
			<BottomCard
				icon="directions-bus"
				iconBg={nearest ? 'bg-blue-50' : 'bg-slate-100'}
				iconColor={nearest ? '#2563eb' : '#64748b'}
				label={nearest ? 'Nearest Transit' : 'Active Route'}
				title={nearest ? nearest.vehicle_id : 'Route · City'}
				status={nearest ? (nearest.predicted_eta_minutes < 1 ? 'Arriving' : `${Math.round(nearest.predicted_eta_minutes)} mins`) : (isRadarActive ? 'Scanning' : 'Radar Off')}
				statusColor={nearest ? 'text-blue-600' : 'text-slate-500'}
				subtext={nearest ? `${Math.round(nearest.distance_km * 1000)} meters away` : (isRadarActive ? '2.0 km scan active' : '')}
			/>
		</View>
	)
}
