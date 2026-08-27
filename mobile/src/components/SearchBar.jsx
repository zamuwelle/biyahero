import { View, Pressable, TextInput } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from '@/components/ui/Txt'
import { theme, type, elevation } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/**
 * Floats over the map. Search FILTERS the map rather than replacing it —
 * matching vehicles stay, non-matching fade out.
 *
 * Renders as a button when `onPress` is given (Map Home taps through to the
 * search screen) and as a live input when `onChangeText` is given.
 */
export const SearchBar = ({ value, onChangeText, onPress, onClear, autoFocus, placeholder = copy.mapHome.searchPlaceholder }) => {
	const box = 'h-14 flex-row items-center gap-3 rounded-full border-[1.5px] border-line-subtle bg-surface pl-[18px] pr-[14px]'

	if (onPress) {
		return (
			<Pressable onPress={onPress} accessibilityRole="search" style={elevation.float} className={`${box} active:opacity-90`}>
				<MaterialIcons name="search" size={20} color={theme.icon.muted} />
				<Txt variant="bodyL" className={value ? 'flex-1 text-fg' : 'flex-1 text-icon-muted'} numberOfLines={1}>
					{value || placeholder}
				</Txt>
				{!!value && !!onClear && (
					<Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.search.clear}>
						<MaterialIcons name="close" size={20} color={theme.icon.secondary} />
					</Pressable>
				)}
			</Pressable>
		)
	}

	return (
		<View style={elevation.float} className={box}>
			<MaterialIcons name="search" size={20} color={theme.icon.muted} />
			<TextInput
				value={value}
				onChangeText={onChangeText}
				placeholder={placeholder}
				placeholderTextColor={theme.icon.muted}
				autoFocus={autoFocus}
				returnKeyType="search"
				style={[type.bodyL, { flex: 1, color: theme.text.primary, padding: 0 }]}
			/>
			{!!value && (
				<Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.search.clear}>
					<MaterialIcons name="close" size={20} color={theme.icon.secondary} />
				</Pressable>
			)}
		</View>
	)
}
