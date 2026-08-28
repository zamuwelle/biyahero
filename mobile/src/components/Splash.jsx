import { useEffect, useRef } from 'react'
import { View, Animated, Easing } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Txt } from '@/components/ui/Txt'
import { LogoMark } from '@/components/LogoMark'
import { useCopy } from '@/constants/copy'

/**
 * 01 · Splash. Full Signal Yellow — the one screen that is all brand.
 * Shown while fonts load and the stored role/session is restored.
 *
 * The yellow does not flip with the theme, so neither may the ink on it:
 * theme-driven text tokens rendered white-on-yellow in dark mode.
 */
/** Fixed ink for the fixed yellow ground, in either theme. */
const INK = '#0B1220'
const INK_MUTED = '#3A4757'

export const Splash = () => {
	const copy = useCopy()
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
				<Txt variant="displayS" className="mt-8" style={{ color: INK }}>{copy.app.name}</Txt>
				<Txt variant="bodyM" className="mt-4 text-center" style={{ color: INK_MUTED }}>{copy.app.tagline}</Txt>
			</View>
			<View className="mb-16 items-center">
				<View className="h-1 w-16 overflow-hidden rounded-full" style={{ backgroundColor: `${INK}26` }}>
					<Animated.View className="h-1 w-[26px] rounded-full" style={{ backgroundColor: INK, transform: [{ translateX }] }} />
				</View>
			</View>
		</SafeAreaView>
	)
}
