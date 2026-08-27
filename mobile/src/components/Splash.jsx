import { useEffect, useRef } from 'react'
import { View, Animated, Easing } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Txt } from '@/components/ui/Txt'
import { LogoMark } from '@/components/LogoMark'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * 01 · Splash. Full Signal Yellow — the one screen that is all brand.
 * Shown while fonts load and the stored role/session is restored.
 */
export const Splash = () => {
	const copy = useCopy()
	const { theme } = useTheme()
	const progress = useRef(new Animated.Value(0)).current

	useEffect(() => {
		Animated.loop(
			Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
		).start()
	}, [])

	const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-26, 64] })

	return (
		<SafeAreaView className="flex-1 bg-brand">
			<StatusBar style="dark" />
			<View className="flex-1 items-center justify-center px-8">
				<LogoMark size={104} />
				<Txt variant="displayS" className="mt-8 text-fg">{copy.app.name}</Txt>
				<Txt variant="bodyM" className="mt-4 text-center text-fg-secondary">{copy.app.tagline}</Txt>
			</View>
			<View className="mb-16 items-center">
				<View className="h-1 w-16 overflow-hidden rounded-full" style={{ backgroundColor: `${theme.text.primary}26` }}>
					<Animated.View className="h-1 w-[26px] rounded-full bg-fg" style={{ transform: [{ translateX }] }} />
				</View>
			</View>
		</SafeAreaView>
	)
}
