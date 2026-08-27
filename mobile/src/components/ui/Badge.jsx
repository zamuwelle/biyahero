import { View } from 'react-native'
import { Txt } from './Txt'

const TONES = {
	open: 'bg-capacity-open-bg',
	filling: 'bg-capacity-filling-bg',
	full: 'bg-capacity-full-bg',
	stale: 'bg-capacity-stale-bg',
	brand: 'bg-brand-subtle'
}

const TEXT = {
	open: 'text-capacity-open-fg',
	filling: 'text-capacity-filling-fg',
	full: 'text-capacity-full-fg',
	stale: 'text-capacity-stale-fg',
	brand: 'text-fg'
}

/** Small uppercase status label — WALANG ACCOUNT, VERIFIED, KAILANGAN NG REHISTRO. */
export const Badge = ({ label, tone = 'open', className = '' }) => (
	<View className={`self-start rounded-xs px-2 py-1 ${TONES[tone] ?? TONES.open} ${className}`}>
		<Txt variant="labelS" className={TEXT[tone] ?? TEXT.open}>{label}</Txt>
	</View>
)
