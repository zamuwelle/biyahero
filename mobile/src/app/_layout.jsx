import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import { useFonts } from 'expo-font'
import {
	PlusJakartaSans_400Regular,
	PlusJakartaSans_500Medium,
	PlusJakartaSans_600SemiBold,
	PlusJakartaSans_700Bold,
	PlusJakartaSans_800ExtraBold
} from '@expo-google-fonts/plus-jakarta-sans'
import { JetBrainsMono_500Medium, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useStore } from '@/services/store'
import { Splash } from '@/components/Splash'
import { Toast } from '@/components/Toast'
import '../global.css'

export default function RootLayout() {
	const hydrate = useStore(s => s.hydrate)
	const hydrated = useStore(s => s.hydrated)
	const [minimumElapsed, setMinimumElapsed] = useState(false)

	const [fontsLoaded] = useFonts({
		PlusJakartaSans_400Regular,
		PlusJakartaSans_500Medium,
		PlusJakartaSans_600SemiBold,
		PlusJakartaSans_700Bold,
		PlusJakartaSans_800ExtraBold,
		JetBrainsMono_500Medium,
		JetBrainsMono_700Bold
	})

	useEffect(() => {
		hydrate()
		// Hold the splash briefly even on a fast device — a 90 ms flash of the
		// brand reads as a glitch rather than a launch.
		const timer = setTimeout(() => setMinimumElapsed(true), 900)
		return () => clearTimeout(timer)
	}, [])

	if (!fontsLoaded || !hydrated || !minimumElapsed) return <Splash />

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
			<Toast />
		</GestureHandlerRootView>
	)
}
