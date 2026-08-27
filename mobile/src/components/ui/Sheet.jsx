import { useMemo } from 'react'
import { View, useWindowDimensions } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { elevation } from '@/theme/tokens'

const SPRING = { damping: 20, stiffness: 180, mass: 0.6 }

/**
 * Two-position bottom sheet. Peek shows the count, the filters and the first
 * card; dragging up reveals the full list ("I-swipe pataas ang sheet para sa
 * buong listahan"). Built on the Reanimated already in the project rather than
 * pulling in a sheet library for two snap points.
 */
export const Sheet = ({ children, peekHeight = 320, heightRatio = 0.86, onExpandedChange }) => {
	const { height: screenHeight } = useWindowDimensions()
	const insets = useSafeAreaInsets()

	const sheetHeight = Math.round(screenHeight * heightRatio)
	const collapsed = Math.max(0, sheetHeight - peekHeight)

	const translateY = useSharedValue(collapsed)
	const startY = useSharedValue(collapsed)

	const pan = useMemo(
		() =>
			Gesture.Pan()
				.onStart(() => {
					startY.value = translateY.value
				})
				.onUpdate(event => {
					translateY.value = Math.min(collapsed, Math.max(0, startY.value + event.translationY))
				})
				.onEnd(event => {
					// Velocity wins over position: a decisive flick snaps even from mid-travel.
					const expand = event.velocityY < -400 || (event.velocityY < 400 && translateY.value < collapsed / 2)
					translateY.value = withSpring(expand ? 0 : collapsed, SPRING)
					if (onExpandedChange) runOnJS(onExpandedChange)(expand)
				}),
		[collapsed, onExpandedChange]
	)

	const style = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))

	return (
		<Animated.View
			style={[
				style,
				elevation.sheet,
				{ height: sheetHeight, paddingBottom: insets.bottom },
				{ position: 'absolute', left: 0, right: 0, bottom: 0 }
			]}
			className="rounded-t-2xl bg-surface"
		>
			<GestureDetector gesture={pan}>
				<View className="items-center pb-1 pt-[10px]">
					<View className="h-[5px] w-10 rounded-[3px] bg-line" />
				</View>
			</GestureDetector>
			<View className="flex-1 px-6">{children}</View>
		</Animated.View>
	)
}
