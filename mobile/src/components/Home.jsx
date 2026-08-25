import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'

export const Home = () => {
	const router = useRouter()
	return (
		<View className="flex-1 p-2 gap-2 bg-slate-950">
			<TouchableOpacity onPress={() => router.push('/commuter')} className="flex-1 bg-blue-600 rounded-2xl items-center justify-center gap-2">
				<MaterialIcons name="directions-bus" size={32} color="white" />
				<Text className="text-white text-2xl font-black">Commuter</Text>
			</TouchableOpacity>
			<TouchableOpacity onPress={() => router.push('/driver')} className="flex-1 bg-emerald-600 rounded-2xl items-center justify-center gap-2">
				<MaterialIcons name="local-taxi" size={32} color="white" />
				<Text className="text-white text-2xl font-black">Driver</Text>
			</TouchableOpacity>
		</View>
	)
}
