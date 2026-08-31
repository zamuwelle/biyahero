import { memo } from 'react'
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
export const VehicleCard = memo(({ vehicle, onPress, nearest = false, passesNote = null }) => {
	const copy = useCopy()
	const myLocation = useStore(s => s.myLocation)
	const away = vehicle.position ? distanceM(myLocation, vehicle.position) : null
	const { theme } = useTheme()
	const { destination, plate_number, vehicle_type, capacity, current_street, is_verified, stale, minutesAgo } = vehicle
	const routeColor = stale ? theme.border.strong : theme.route[1]

	return (
		<Pressable
			onPress={() => onPress?.(vehicle)}
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

				{nearest && (
					<Txt variant="caption" className="text-capacity-open-fg">{copy.vehicle.nearest}</Txt>
				)}

				{/* On a destination search: how close this ride actually runs to
				    the place asked for — the corridor is wide, so say the number. */}
				{!!passesNote && (
					<Txt variant="caption" className="text-fg-secondary" numberOfLines={1}>{passesNote}</Txt>
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
}, (prev, next) =>
	// A poll rebuilds every vehicle object; only these fields reach pixels.
	// myLocation comes from the store subscription, untouched by this memo.
	prev.nearest === next.nearest &&
	prev.passesNote === next.passesNote &&
	prev.onPress === next.onPress &&
	prev.vehicle.destination === next.vehicle.destination &&
	prev.vehicle.plate_number === next.vehicle.plate_number &&
	prev.vehicle.vehicle_type === next.vehicle.vehicle_type &&
	prev.vehicle.capacity === next.vehicle.capacity &&
	prev.vehicle.current_street === next.vehicle.current_street &&
	prev.vehicle.is_verified === next.vehicle.is_verified &&
	prev.vehicle.stale === next.vehicle.stale &&
	prev.vehicle.minutesAgo === next.vehicle.minutesAgo &&
	prev.vehicle.position?.latitude === next.vehicle.position?.latitude &&
	prev.vehicle.position?.longitude === next.vehicle.position?.longitude
)
