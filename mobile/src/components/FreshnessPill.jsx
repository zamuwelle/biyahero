import { View } from 'react-native'
import { Txt } from '@/components/ui/Txt'
import { useCopy } from '@/constants/copy'
import { useTheme } from '@/theme/useTheme'

/**
 * How fresh the last ping is — this is what the commuter gets INSTEAD of an ETA.
 * A live vehicle shows a solid dot; a stale one shows a hollow ring plus its age,
 * so "we don't know" never masquerades as "it's here".
 */
export const FreshnessPill = ({ minutesAgo = null, stale = false }) => {
	const copy = useCopy()
	const { theme } = useTheme()
	if (!stale) {
		return (
			<View className="h-7 flex-row items-center gap-[6px] rounded-full bg-capacity-open-bg pl-[9px] pr-[11px]">
				<View className="h-[9px] w-[9px] rounded-full bg-capacity-open-fg" />
				<Txt variant="labelS" className="text-capacity-open-fg">{copy.freshness.live}</Txt>
			</View>
		)
	}

	return (
		<View className="h-7 flex-row items-center gap-[6px] rounded-full bg-capacity-stale-bg pl-[9px] pr-[11px]">
			<View
				className="h-[9px] w-[9px] rounded-full border-[1.5px]"
				style={{ borderColor: theme.capacity.stale.fg }}
			/>
			<Txt variant="labelS" className="text-capacity-stale-fg">
				{minutesAgo == null ? copy.freshness.unknown : copy.freshness.minutes(Math.max(1, Math.round(minutesAgo)))}
			</Txt>
		</View>
	)
}
