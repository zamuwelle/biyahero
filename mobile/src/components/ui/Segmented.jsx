import { View, Pressable } from 'react-native'
import { Txt } from './Txt'
import { elevation } from '@/theme/tokens'

/** Two-up mode switch — the Settings screen's role toggle. */
export const Segmented = ({ options, value, onChange }) => (
	<View className="flex-row rounded-lg bg-surface-sunken p-1">
		{options.map(option => {
			const active = option.value === value
			return (
				<Pressable
					key={option.value}
					onPress={() => onChange(option.value)}
					accessibilityRole="tab"
					accessibilityState={{ selected: active }}
					style={active ? elevation.float : undefined}
					className={`h-12 flex-1 items-center justify-center rounded-md ${active ? 'bg-surface' : ''}`}
				>
					<Txt variant="bodyMStrong" className={active ? 'text-fg' : 'text-fg-secondary'}>{option.label}</Txt>
				</Pressable>
			)
		})}
	</View>
)
