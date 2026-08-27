import { View, Pressable } from 'react-native'
import { Txt } from '@/components/ui/Txt'
import { Badge } from '@/components/ui/Badge'
import { VehicleGlyph } from './VehicleGlyph'
import { theme, VEHICLE_LABELS } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/** The driver's own vehicle, as it appears on their home and profile screens. */
export const DriverVehicleCard = ({ vehicle, verified = false, onEdit }) => {
	if (!vehicle) return null

	const meta = [vehicle.plate_number, vehicle.body_number && `Body No. ${vehicle.body_number}`]
		.filter(Boolean)
		.join(' · ')

	return (
		<View className="flex-row items-center gap-[14px] rounded-lg border-[1.5px] border-line-subtle bg-surface p-4">
			<View className="h-12 w-12 items-center justify-center rounded-md bg-brand-subtle">
				<VehicleGlyph type={vehicle.vehicle_type} color={theme.icon.primary} />
			</View>

			<View className="min-w-0 flex-1 gap-[4px]">
				<Txt variant="headingS" numberOfLines={1}>
					{[VEHICLE_LABELS[vehicle.vehicle_type] ?? vehicle.vehicle_type, vehicle.model].filter(Boolean).join(' · ')}
				</Txt>
				<View className="flex-row items-center gap-2">
					{/* The plate line gives up width first; the badge must never clip. */}
					<Txt variant="monoData" className="min-w-0 flex-1 text-fg-secondary" numberOfLines={1}>{meta}</Txt>
					{verified && (
						<View className="shrink-0">
							<Badge label="VERIFIED" tone="open" />
						</View>
					)}
				</View>
			</View>

			{!!onEdit && (
				<Pressable onPress={onEdit} hitSlop={8} accessibilityRole="button" className="active:opacity-70">
					<Txt variant="bodyMStrong" className="text-brand-hover">{copy.driverProfile.edit}</Txt>
				</Pressable>
			)}
		</View>
	)
}
