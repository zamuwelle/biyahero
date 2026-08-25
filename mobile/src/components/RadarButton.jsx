import { Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const RadarButton = () => {
	const isRadarActive = useStore(s => s.isRadarActive)
	const toggleRadar = useStore(s => s.toggleRadar)

	return (
		<Pressable
			onPress={toggleRadar}
			className="p-2 rounded-2xl bg-white shadow-lg items-center justify-center active:scale-95"
		>
			<MaterialIcons name="radar" size={32} color={isRadarActive ? '#2563eb' : '#94a3b8'} />
		</Pressable>
	)
}
