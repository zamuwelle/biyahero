import { View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from '@/components/ui/Txt'
import { theme } from '@/theme/tokens'

/**
 * 10 · Empty State. Explains WHY there is nothing and what is normal, rather
 * than showing a bare "no results" — the usual cause is the time of night.
 */
export const EmptyState = ({ icon = 'search-off', title, body, action }) => (
	<View className="items-center gap-4 px-4 py-10">
		<View className="h-16 w-16 items-center justify-center rounded-xl bg-surface-sunken">
			<MaterialIcons name={icon} size={30} color={theme.icon.muted} />
		</View>
		<Txt variant="headingM" className="text-center text-fg">{title}</Txt>
		{!!body && <Txt variant="bodyM" className="text-center text-fg-secondary">{body}</Txt>}
		{action}
	</View>
)
