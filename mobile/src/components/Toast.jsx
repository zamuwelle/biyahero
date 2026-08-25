import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useStore } from '../services/store'

export const Toast = () => {
	const insets = useSafeAreaInsets()
	const toast = useStore(s => s.toast)
	if (!toast) return null

	return (
		<View
			style={{ bottom: insets.bottom + 96 }}
			className="absolute self-center px-4 py-2 rounded-2xl bg-slate-900/95 shadow-xl border border-slate-700 items-center z-50 pointer-events-none"
		>
			<Text className="text-white text-xs font-black tracking-wide">{toast}</Text>
		</View>
	)
}
