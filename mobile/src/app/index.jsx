import { View, Text, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'

export default () => {
	const router = useRouter()
	return (
		<SafeAreaView className="flex-1 bg-slate-100 p-8 gap-8">
			<View className="flex-row items-center justify-between">
				<Text className="text-slate-900 text-3xl font-black tracking-tight">Where to next?</Text>
				<TouchableOpacity
					onPress={() => router.push('/settings')}
					activeOpacity={0.75}
					className="w-12 h-12 rounded-2xl bg-white items-center justify-center border border-slate-200 shadow-sm"
				>
					<MaterialIcons name="settings" size={24} color="#64748b" />
				</TouchableOpacity>
			</View>

			<View className="gap-4">
				<TouchableOpacity
					onPress={() => router.push('/commuter')}
					activeOpacity={0.75}
					className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-4"
				>
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-4">
							<View className="w-12 h-12 rounded-2xl bg-amber-500/10 items-center justify-center">
								<MaterialIcons name="directions-bus" size={24} color="#d97706" />
							</View>
							<Text className="text-xl font-black text-slate-900">Commuter</Text>
						</View>
						<MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
					</View>
					<Text className="text-slate-500 text-sm leading-relaxed">
						No sign-up required. Instantly view live radar, track approaching vehicles, and check arrival times.
					</Text>
				</TouchableOpacity>

				<TouchableOpacity
					onPress={() => router.push('/driver')}
					activeOpacity={0.75}
					className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-4"
				>
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-4">
							<View className="w-12 h-12 rounded-2xl bg-slate-900/10 items-center justify-center">
								<MaterialIcons name="drive-eta" size={24} color="#0f172a" />
							</View>
							<Text className="text-xl font-black text-slate-900">Driver</Text>
						</View>
						<MaterialIcons name="chevron-right" size={24} color="#94a3b8" />
					</View>
					<Text className="text-slate-500 text-sm leading-relaxed">
						One-time registration required. Select your vehicle and broadcast your live route to passengers.
					</Text>
				</TouchableOpacity>
			</View>
		</SafeAreaView>
	)
}
