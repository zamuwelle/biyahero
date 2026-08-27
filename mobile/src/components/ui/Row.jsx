import { View, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from './Txt'
import { theme } from '@/theme/tokens'

/** Settings / profile list row: title over subtitle, chevron on the right. */
export const Row = ({ title, subtitle, onPress, icon, right, danger = false }) => (
	<Pressable
		onPress={onPress}
		disabled={!onPress}
		accessibilityRole={onPress ? 'button' : 'text'}
		className="flex-row items-center gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-4 active:opacity-80"
	>
		{!!icon && <MaterialIcons name={icon} size={22} color={danger ? theme.text.danger : theme.icon.secondary} />}
		<View className="min-w-0 flex-1 gap-[2px]">
			<Txt variant="headingS" className={danger ? 'text-fg-danger' : 'text-fg'}>{title}</Txt>
			{!!subtitle && <Txt variant="caption" className="text-fg-secondary">{subtitle}</Txt>}
		</View>
		{right ?? (onPress ? <MaterialIcons name="chevron-right" size={22} color={theme.icon.muted} /> : null)}
	</Pressable>
)
