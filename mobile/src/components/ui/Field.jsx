import { View, TextInput } from 'react-native'
import { Txt } from './Txt'
import { theme, type } from '@/theme/tokens'

/**
 * Labelled input. `prefix` carries the fixed +63 on the sign-up screen;
 * `mono` switches to JetBrains for plate numbers, which scan faster in mono.
 */
export const Field = ({ label, error, prefix, mono = false, hint, className = '', ...input }) => (
	<View className={`gap-2 ${className}`}>
		{!!label && <Txt variant="labelS" className="text-fg-secondary">{label}</Txt>}
		<View
			className={`h-14 flex-row items-center gap-2 rounded-lg border-[1.5px] bg-surface px-4 ${
				error ? 'border-danger' : 'border-line-subtle'
			}`}
		>
			{!!prefix && <Txt variant="bodyL" className="text-fg-secondary">{prefix}</Txt>}
			<TextInput
				style={[mono ? type.monoData : type.bodyL, { flex: 1, color: theme.text.primary, padding: 0 }]}
				placeholderTextColor={theme.icon.muted}
				{...input}
			/>
		</View>
		{!!error && <Txt variant="caption" className="text-fg-danger">{error}</Txt>}
		{!error && !!hint && <Txt variant="caption" className="text-fg-secondary">{hint}</Txt>}
	</View>
)
