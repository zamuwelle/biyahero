import { TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'

export const BackButton = () => {
	const insets = useSafeAreaInsets()
	const router = useRouter()
	return (
		<TouchableOpacity
			onPress={() => router.back()}
			style={{ top: insets.top + 8 }}
			className="absolute left-2 w-12 h-12 rounded-2xl bg-white shadow-lg items-center justify-center z-10"
		>
			<MaterialIcons name="arrow-back" size={24} color="#1e293b" />
		</TouchableOpacity>
	)
}
