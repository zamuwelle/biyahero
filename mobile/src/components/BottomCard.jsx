import { View, Text } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'

export const BottomCard = ({ icon, iconBg = 'bg-slate-100', iconColor = '#64748b', label, title, status, statusColor = 'text-slate-500', subtext }) => {
	const insets = useSafeAreaInsets()
	return (
		<View style={{ bottom: insets.bottom + 8 }} className="absolute left-2 right-2 p-2 rounded-2xl bg-white shadow-lg flex-row items-center justify-between z-10 gap-2">
			<View className="flex-row items-center gap-2">
				<View className={`w-12 h-12 rounded-xl ${iconBg} items-center justify-center`}>
					<MaterialIcons name={icon} size={28} color={iconColor} />
				</View>
				<View>
					<Text className="text-xs font-bold text-slate-400 uppercase">{label}</Text>
					<Text className="text-base font-black text-slate-900">{title}</Text>
				</View>
			</View>
			<View className="items-end pr-2">
				<Text className={`text-base font-black ${statusColor}`}>{status}</Text>
				{!!subtext && <Text className="text-xs font-semibold text-slate-400">{subtext}</Text>}
			</View>
		</View>
	)
}
