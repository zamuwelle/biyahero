import { View, Text, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export const Home = () => (
	<View className="flex-1 p-2 gap-2">
		<Link href="/commuter" asChild>
			<Pressable className="flex-1 rounded-2xl bg-blue-600 items-center justify-center shadow-lg active:opacity-90">
				<Text className="text-white text-3xl font-black">Commuter</Text>
			</Pressable>
		</Link>

		<Link href="/driver" asChild>
			<Pressable className="flex-1 rounded-2xl bg-emerald-600 items-center justify-center shadow-lg active:opacity-90">
				<Text className="text-white text-3xl font-black">Driver</Text>
			</Pressable>
		</Link>

		<StatusBar style="light" />
	</View>
)
