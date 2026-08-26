import { TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const BroadcastButton = () => {
	const isBroadcasting = useStore(s => s.isBroadcasting)
	const toggleBroadcast = useStore(s => s.toggleBroadcast)

	return (
		<TouchableOpacity onPress={toggleBroadcast} className="w-12 h-12 rounded-2xl bg-white shadow-lg items-center justify-center">
			<MaterialIcons name="cell-tower" size={32} color={isBroadcasting ? '#059669' : '#94a3b8'} />
		</TouchableOpacity>
	)
}
