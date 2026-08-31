import { Text } from 'react-native'
import { type } from '@/theme/tokens'

/**
 * Every piece of text in the app goes through here.
 * `variant` picks a step off the Figma type ramp (family + size + leading +
 * tracking travel together); colour stays a className so it reads at the callsite.
 */
export const Txt = ({ variant = 'bodyM', className = 'text-fg', style, children, ...rest }) => (
	<Text style={[type[variant], style]} className={className} {...rest}>
		{children}
	</Text>
)
