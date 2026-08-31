import { View } from 'react-native'
import { Txt } from '@/components/ui/Txt'

/**
 * One figure from the driver's day — 6 BIYAHE, 5.5 ORAS ONLINE, 48 KM NABIYAHE.
 *
 * Both lines are pinned to the card's width with `w-full`. Without it they size
 * to their own content and overflow the card, and because a rounded background
 * clips its children on Android the overflow is silently cut — "SA RUTA"
 * rendered as "SA", "425.9" as "424". Constrained, they wrap or shrink instead.
 */
export const StatCard = ({ value, label }) => (
	<View className="min-w-0 flex-1 items-center gap-1 rounded-lg border-[1.5px] border-line-subtle bg-surface px-2 py-4">
		<Txt
			variant="displayS"
			numberOfLines={1}
			adjustsFontSizeToFit
			minimumFontScale={0.5}
			className="w-full text-center text-fg"
		>
			{value}
		</Txt>
		<Txt variant="labelS" numberOfLines={2} className="w-full text-center text-fg-secondary">
			{label}
		</Txt>
	</View>
)
