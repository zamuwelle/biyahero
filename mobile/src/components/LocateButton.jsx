import { Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { elevation } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * Back to where the driver is standing.
 *
 * The commuter map has its own crosshair with opt-in semantics — it ASKS for a
 * location the app otherwise never holds, and long-press turns it off again.
 * A driver has already handed over their position to broadcast it, so theirs
 * is the plain version: one tap, always available, nothing to consent to.
 *
 * Sized and bordered to match the layer button so the two stack cleanly when a
 * screen shows both.
 */
export const LocateButton = ({ onPress, style }) => {
	const { theme } = useTheme()
	const copy = useCopy()

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={copy.mapHome.myLocation}
			style={[elevation.float, style]}
			className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
		>
			<MaterialIcons name="my-location" size={24} color={theme.icon.secondary} />
		</Pressable>
	)
}
