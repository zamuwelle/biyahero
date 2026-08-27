import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'

/**
 * Standard page frame: canvas background, 24 px gutters (the Figma grid),
 * dark status-bar glyphs to suit the light palette.
 * `edges` is forwarded so map screens can opt out of the bottom inset.
 */
export const Screen = ({ children, className = '', padded = true, edges = ['top', 'bottom'] }) => (
	<SafeAreaView edges={edges} className="flex-1 bg-surface-canvas">
		<StatusBar style="dark" />
		<View className={`flex-1 ${padded ? 'px-6' : ''} ${className}`}>{children}</View>
	</SafeAreaView>
)
