import { Pressable } from 'react-native'
import { Txt } from './Txt'

/** Filter pill — Lahat / Jeepney / E-Jeep / Bus / UV Express. */
export const Chip = ({ label, active = false, onPress }) => (
	<Pressable
		onPress={onPress}
		accessibilityRole="button"
		accessibilityState={{ selected: active }}
		className={`h-[38px] items-center justify-center rounded-full border-[1.5px] px-[14px] active:opacity-80 ${
			active ? 'border-brand bg-brand' : 'border-line-subtle bg-surface'
		}`}
	>
		<Txt variant="labelL" className={active ? 'text-fg-on-brand' : 'text-fg-secondary'}>{label}</Txt>
	</Pressable>
)
