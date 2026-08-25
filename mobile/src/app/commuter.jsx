import { useCallback } from 'react'
import { View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../services/store'
import { Map } from '../components/Map'
import { BackButton } from '../components/BackButton'
import { RadarButton } from '../components/RadarButton'
import { CompassButton } from '../components/CompassButton'
import { ArrivalCard } from '../components/ArrivalCard'
import { Toast } from '../components/Toast'

export default () => {
	const insets = useSafeAreaInsets()
	const startRadar = useStore(s => s.startRadar)
	const stopRadar = useStore(s => s.stopRadar)

	useFocusEffect(useCallback(() => {
		startRadar()
		return () => stopRadar()
	}, []))

	return (
		<View className="flex-1">
			<Map showRadar />
			<BackButton />
			<Toast />
			<View style={{ bottom: insets.bottom + 80 }} className="absolute right-2 gap-2 z-10">
				<RadarButton />
				<CompassButton />
			</View>
			<ArrivalCard />
		</View>
	)
}
