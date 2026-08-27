import { View, Pressable } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from '@/components/ui/Txt'
import { VehicleGlyph } from './VehicleGlyph'
import { CapacityBadge } from './CapacityBadge'
import { FreshnessPill } from './FreshnessPill'
import { useStore } from '@/services/store'
import { distanceM } from '@/services/geo'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * Destination first — the question the commuter is actually asking.
 * The distance line appears only after the commuter opts in via the map
 * crosshair; it is computed on-device and the position never leaves the phone.
 * Still no ETA — traffic makes any minutes figure invented.
 */
export const VehicleCard = ({ vehicle, onPress }) => {
	const copy = useCopy()
	const myLocation = useStore(s => s.myLocation)
	const away = vehicle.position ? distanceM(myLocation, vehicle.position) : null
	const { theme } = useTheme()
	const { destination, plate_number, vehicle_type, capacity, current_street, is_verified, stale, minutesAgo } = vehicle
	const routeColor = stale ? theme.border.strong : theme.route[1]

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${destination}, ${plate_number}`}
			className={`flex-row items-start gap-3 rounded-lg border-[1.5px] border-line-subtle bg-surface p-[14px] active:opacity-80 ${stale ? 'opacity-75' : ''}`}
		>
			<View
				className="h-12 w-12 items-center justify-center rounded-md border-2 bg-surface-sunken"
				style={{ borderColor: routeColor }}
			>
				<VehicleGlyph type={vehicle_type} color={stale ? theme.icon.muted : theme.icon.primary} />
			</View>

			<View className="min-w-0 flex-1 gap-[7px]">
				<Txt variant="headingS" numberOfLines={1}>{destination}</Txt>

				<View className="flex-row items-center gap-[7px]">
					<Txt variant="monoData" className="text-fg-secondary">{plate_number}</Txt>
					{!!is_verified && <MaterialIcons name="verified" size={18} color={stale ? theme.icon.muted : theme.text.success} />}
				</View>

				<CapacityBadge state={stale ? 'unknown' : capacity} />

				{!!current_street && (
					<Txt variant="caption" className="text-fg-secondary" numberOfLines={1}>
						{stale ? copy.vehicle.lastOnStreet(current_street) : copy.vehicle.onStreet(current_street)}
					</Txt>
				)}
			</View>

			<View className="w-[84px] items-end gap-1">
				<FreshnessPill stale={stale} minutesAgo={minutesAgo} />
				{away !== null && (
					<Txt variant="caption" className="text-right text-fg-secondary">{copy.vehicle.away(away)}</Txt>
				)}
			</View>
		</Pressable>
	)
}
