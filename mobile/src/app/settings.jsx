import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '@/services/store'

export default () => {
	const router = useRouter()
	const locationEnabled = useStore(s => s.locationEnabled)
	const toggleLocation = useStore(s => s.toggleLocation)

	return (
		<SafeAreaView className="flex-1 bg-slate-100 p-8">
			<View className="gap-8">
				<View className="flex-row items-center gap-4">
					<TouchableOpacity
						onPress={() => router.back()}
						activeOpacity={0.75}
						className="w-12 h-12 rounded-2xl bg-white items-center justify-center border border-slate-200 shadow-sm"
					>
						<MaterialIcons name="arrow-back" size={24} color="#0f172a" />
					</TouchableOpacity>
					<Text className="text-3xl font-black text-slate-900">Settings</Text>
				</View>

				<View className="bg-white border border-slate-200 rounded-3xl p-6 flex-row items-center justify-between shadow-sm">
					<Text className="text-lg font-black text-slate-900">Location</Text>
					<TouchableOpacity
						onPress={toggleLocation}
						activeOpacity={0.8}
						className={`w-14 h-8 rounded-full p-1 flex-row items-center ${locationEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'}`}
					>
						<View className="w-6 h-6 rounded-full bg-white shadow-sm" />
					</TouchableOpacity>
				</View>
			</View>
		</SafeAreaView>
	)
}
