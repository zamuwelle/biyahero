import { View, Text, Pressable } from 'react-native'
import { Link } from 'expo-router'
import { StatusBar } from 'expo-status-bar'

export default () => (
	<View className="flex-1 items-center justify-center gap-4 bg-blue-100">
		<Text className="text-2xl font-bold">Home</Text>
		<Link href="/driver" asChild>
			<Pressable className="rounded bg-blue-500 px-4 py-2">
				<Text className="text-white">Driver Screen</Text>
			</Pressable>
		</Link>
		<StatusBar style="auto" />
	</View>
)
