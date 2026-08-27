import { View } from 'react-native'
import { Txt } from '@/components/ui/Txt'

/** One figure from the driver's day — 6 BIYAHE, 5.5 ORAS ONLINE, 48 KM NABIYAHE. */
export const StatCard = ({ value, label }) => (
	<View className="flex-1 items-center gap-1 rounded-lg border-[1.5px] border-line-subtle bg-surface px-2 py-4">
		<Txt variant="displayS">{value}</Txt>
		<Txt variant="labelS" className="text-center text-fg-secondary">{label}</Txt>
	</View>
)
