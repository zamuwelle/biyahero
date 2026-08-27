import { View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Txt } from '@/components/ui/Txt'
import { useStore } from '@/services/store'
import { elevation } from '@/theme/tokens'

export const Toast = () => {
	const insets = useSafeAreaInsets()
	const toast = useStore(s => s.toast)

	if (!toast) return null

	return (
		<View
			pointerEvents="none"
			style={{ bottom: insets.bottom + 96, ...elevation.float }}
			className="absolute self-center rounded-full bg-surface-inverse px-5 py-3"
		>
			<Txt variant="labelL" className="text-fg-inverse">{toast}</Txt>
		</View>
	)
}
