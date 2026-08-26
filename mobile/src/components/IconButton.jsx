import { TouchableOpacity } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'

export const IconButton = ({ name, size = 28, color = '#1e293b', onPress, style, className = '' }) => (
	<TouchableOpacity onPress={onPress} activeOpacity={0.75} style={style} className={`w-12 h-12 rounded-2xl bg-white shadow-lg items-center justify-center ${className}`}>
		<MaterialIcons name={name} size={size} color={color} />
	</TouchableOpacity>
)
