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
export const Sheet = ({ children, head = null, peekHeight = 320, heightRatio = 0.86, onExpandedChange }) => {
	const { height: screenHeight } = useWindowDimensions()
	const insets = useSafeAreaInsets()

	const sheetHeight = Math.round(screenHeight * heightRatio)
	const collapsed = Math.max(0, sheetHeight - peekHeight)

	const translateY = useSharedValue(collapsed)
	const startY = useSharedValue(collapsed)

	const pan = useMemo(
		() =>
			Gesture.Pan()
				// The head band holds tappable chips: only a clearly vertical drag
				// may claim the touch, or a sloppy tap twitches the sheet instead
				// of applying the filter.
				.activeOffsetY([-10, 10])
				.failOffsetX([-15, 15])
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
			{/* Everything above the scrolling list drags the sheet — a 5px grabber
			    alone is a target nobody hits. Pass the static header as `head`. */}
			<GestureDetector gesture={pan}>
				<View>
					<View className="items-center pb-1 pt-[10px]">
						<View className="h-[5px] w-10 rounded-[3px] bg-line" />
					</View>
					{!!head && <View className="px-6">{head}</View>}
				</View>
			</GestureDetector>
			<View className="flex-1 px-6">{children}</View>
		</Animated.View>
	)
}
