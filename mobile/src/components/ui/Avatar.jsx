import { View } from 'react-native'
import { Txt } from './Txt'

/** Initial in a circle. Drivers have no photo — plate and licence are the identity. */
export const Avatar = ({ name = '', size = 40, tone = 'muted' }) => (
	<View
		style={{ width: size, height: size, borderRadius: size / 2 }}
		className={`items-center justify-center ${tone === 'brand' ? 'bg-brand' : 'bg-surface-sunken'}`}
	>
		<Txt variant={size >= 72 ? 'displayS' : 'headingS'} className="text-fg">
			{(name.trim().charAt(0) || '?').toUpperCase()}
		</Txt>
	</View>
)
