import { View, Pressable } from 'react-native'
import { Txt } from '@/components/ui/Txt'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/** Built per render so the segment colours follow the active theme. */
const optionsFor = theme => [
	{ value: 'open', filled: 1, fg: theme.capacity.open.fg },
	{ value: 'filling', filled: 2, fg: theme.capacity.filling.fg },
	{ value: 'full', filled: 3, fg: theme.capacity.full.fg }
]

/**
 * The driver's one-tap job while moving, so the targets are large and the state
 * is encoded in segment COUNT as well as colour — same language the commuter
 * sees on the vehicle card.
 */
export const CapacityPicker = ({ value, onChange }) => {
	const copy = useCopy()
	const { theme } = useTheme()
	const OPTIONS = optionsFor(theme)

	return (
	<View className="flex-row gap-3">
		{OPTIONS.map(option => {
			const active = option.value === value

			return (
				<Pressable
					key={option.value}
					onPress={() => onChange(option.value)}
					accessibilityRole="radio"
					accessibilityState={{ selected: active }}
					accessibilityLabel={copy.capacity[option.value]}
					className={`flex-1 items-center gap-3 rounded-lg border-2 py-4 active:opacity-80 ${
						active ? 'border-brand bg-brand-subtle' : 'border-transparent bg-surface-sunken'
					}`}
				>
					<View className="flex-row items-end gap-[3px]">
						{[0, 1, 2].map(i => (
							<View
								key={i}
								style={{ backgroundColor: option.fg, opacity: i < option.filled ? 1 : 0.3 }}
								className="h-[18px] w-[5px] rounded-[2px]"
							/>
						))}
					</View>
					<Txt variant="labelL" className={active ? 'text-fg' : 'text-fg-secondary'}>
						{copy.capacity[option.value]}
					</Txt>
				</Pressable>
			)
		})}
	</View>
)
}
