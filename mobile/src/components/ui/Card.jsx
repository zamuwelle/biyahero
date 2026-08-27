import { View, Pressable } from 'react-native'

/**
 * The default surface. `selected` is the Signal Yellow treatment the Role Select
 * screen uses for the recommended path.
 */
export const Card = ({ children, onPress, selected = false, className = '', ...rest }) => {
	const skin = selected
		? 'bg-brand-subtle border-[2.5px] border-brand'
		: 'bg-surface border-[1.5px] border-line-subtle'
	const box = `rounded-xl p-5 ${skin} ${className}`

	if (!onPress) return <View className={box} {...rest}>{children}</View>

	return (
		<Pressable onPress={onPress} accessibilityRole="button" className={`${box} active:opacity-80`} {...rest}>
			{children}
		</Pressable>
	)
}
