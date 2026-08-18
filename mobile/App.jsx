import { StatusBar } from 'expo-status-bar'
import { Text, View } from 'react-native'
import './global.css'

export default function App() {
	return (
		<View className="flex-1 items-center justify-center bg-white">
			<Text>Open up App.jsx to start working on your app!</Text>
			<Text>Something</Text>
			<StatusBar style="auto" />
		</View>
	)
}
