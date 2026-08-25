import { View, Text, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default () => (
	<View className="flex-1 items-center justify-center gap-4 bg-blue-50 px-6">
		<Text className="text-3xl font-bold text-blue-900">Biyahero</Text>
		<Text className="text-sm text-slate-500 mb-4">Who are you today?</Text>

		<Link href="/commuter" asChild>
			<Pressable className="w-full rounded-xl bg-blue-600 px-6 py-4 items-center">
				<Text className="text-white text-lg font-semibold">📍 I'm a Commuter</Text>
				<Text className="text-blue-200 text-xs mt-1">Find nearby jeepneys</Text>
			</Pressable>
		</Link>

		<Link href="/driver" asChild>
			<Pressable className="w-full rounded-xl bg-green-600 px-6 py-4 items-center">
				<Text className="text-white text-lg font-semibold">🚌 I'm a Driver</Text>
				<Text className="text-green-200 text-xs mt-1">Broadcast your location</Text>
			</Pressable>
		</Link>

		<StatusBar style="auto" />
	</View>
)
