import { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Animated } from 'react-native'
import { Stack } from 'expo-router'
import '../global.css'

export default () => {
	const [ready, setReady] = useState(false)
	const fadeAnim = useRef(new Animated.Value(0)).current

	useEffect(() => {
		Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
		const timer = setTimeout(() => setReady(true), 500)
		return () => clearTimeout(timer)
	}, [])

	return ready ? (
		<Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
	) : (
		<View className="flex-1 bg-amber-400 items-center justify-center p-8">
			<Animated.View style={{ opacity: fadeAnim }} className="items-center gap-4">
				<Image source={require('@/assets/logo.png')} className="w-24 h-24 rounded-3xl shadow-sm" resizeMode="contain" />
				<Text className="text-3xl font-black text-slate-900 tracking-tight">Biyahero</Text>
			</Animated.View>
		</View>
	)
}
