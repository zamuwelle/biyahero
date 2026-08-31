import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { useTheme } from '@/theme/useTheme'

/**
 * Standard page frame: canvas background, 24 px gutters (the Figma grid),
 * status-bar glyphs matched to the active theme.
 * `edges` is forwarded so map screens can opt out of the bottom inset.
 */
export const Screen = ({ children, className = '', padded = true, edges = ['top', 'bottom'] }) => {
	const { statusBar } = useTheme()

	return (
		<SafeAreaView edges={edges} className="flex-1 bg-surface-canvas">
			<StatusBar style={statusBar} />
			<View className={`flex-1 ${padded ? 'px-6' : ''} ${className}`}>{children}</View>
		</SafeAreaView>
	)
}
