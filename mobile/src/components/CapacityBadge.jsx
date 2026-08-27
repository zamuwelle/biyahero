import { View } from 'react-native'
import { Txt } from '@/components/ui/Txt'
import { useCopy } from '@/constants/copy'

const STATES = {
	open: { filled: 1, bg: 'bg-capacity-open-bg', fg: 'text-capacity-open-fg', seg: 'bg-capacity-open-fg' },
	filling: { filled: 2, bg: 'bg-capacity-filling-bg', fg: 'text-capacity-filling-fg', seg: 'bg-capacity-filling-fg' },
	full: { filled: 3, bg: 'bg-capacity-full-bg', fg: 'text-capacity-full-fg', seg: 'bg-capacity-full-fg' },
	unknown: { filled: 0, bg: 'bg-capacity-stale-bg', fg: 'text-capacity-stale-fg', seg: 'bg-capacity-stale-fg' }
}

/**
 * Seat availability. Fill level is encoded in the SEGMENT COUNT as well as the
 * colour, so it survives colour-blindness and greyscale. Never ship this as a
 * bare coloured dot.
 */
export const CapacityBadge = ({ state = 'unknown' }) => {
	const copy = useCopy()
	const s = STATES[state] ?? STATES.unknown

	return (
		<View
			accessibilityRole="text"
			accessibilityLabel={copy.capacity[state] ?? copy.capacity.unknown}
			className={`h-8 flex-row items-center gap-2 self-start rounded-full pl-[10px] pr-3 ${s.bg}`}
		>
			<View className="flex-row items-center gap-[2px]">
				{[0, 1, 2].map(i => (
					<View key={i} className={`h-[14px] w-1 rounded-[2px] ${s.seg} ${i < s.filled ? '' : 'opacity-30'}`} />
				))}
			</View>
			<Txt variant="labelS" className={s.fg}>{copy.capacity[state] ?? copy.capacity.unknown}</Txt>
		</View>
	)
}
