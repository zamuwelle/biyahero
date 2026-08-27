import { Pressable, ActivityIndicator, View } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from './Txt'
import { theme } from '@/theme/tokens'

const TONES = {
	primary: { box: 'bg-brand', text: 'text-fg-on-brand', icon: theme.text.onBrand },
	secondary: { box: 'bg-surface border-[1.5px] border-line-subtle', text: 'text-fg', icon: theme.icon.primary },
	danger: { box: 'bg-danger', text: 'text-fg-inverse', icon: theme.text.inverse },
	ghost: { box: 'bg-transparent', text: 'text-fg-secondary', icon: theme.icon.secondary }
}

/**
 * 56 px tall, not 48 — the driver's primary actions get tapped in a moving
 * vehicle, and these are the only buttons on their screens.
 */
export const Button = ({ label, onPress, tone = 'primary', icon, disabled, loading, className = '' }) => {
	const t = TONES[tone] ?? TONES.primary
	const inert = disabled || loading

	return (
		<Pressable
			onPress={onPress}
			disabled={inert}
			accessibilityRole="button"
			accessibilityState={{ disabled: !!inert, busy: !!loading }}
			className={`h-14 flex-row items-center justify-center gap-2 rounded-lg px-6 ${t.box} ${inert ? 'opacity-40' : 'active:opacity-80'} ${className}`}
		>
			{loading ? (
				<ActivityIndicator color={t.icon} />
			) : (
				<View className="flex-row items-center gap-2">
					{!!icon && <MaterialIcons name={icon} size={20} color={t.icon} />}
					<Txt variant="bodyMStrong" className={t.text}>{label}</Txt>
				</View>
			)}
		</Pressable>
	)
}
