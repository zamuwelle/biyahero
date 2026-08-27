import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons } from '@expo/vector-icons'
import { Map } from '@/components/Map'
import { Sheet } from '@/components/ui/Sheet'
import { Txt } from '@/components/ui/Txt'
import { Badge } from '@/components/ui/Badge'
import { VehicleGlyph } from '@/components/VehicleGlyph'
import { CapacityBadge } from '@/components/CapacityBadge'
import { EmptyState } from '@/components/EmptyState'
import { fetchVehicle } from '@/services/api'
import { theme, elevation, VEHICLE_LABELS, PING_INTERVAL_MS } from '@/theme/tokens'
import * as copy from '@/constants/copy'

const Stat = ({ label, children }) => (
	<View className="flex-1 items-center gap-[6px]">
		<Txt variant="labelS" className="text-fg-secondary">{label}</Txt>
		{children}
	</View>
)

const DetailRow = ({ tint, children, title, subtitle }) => (
	<View className="flex-row items-center gap-[14px] border-t-[1.5px] border-line-subtle py-4">
		<View className="h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: tint }}>
			{children}
		</View>
		<View className="min-w-0 flex-1 gap-[2px]">
			<Txt variant="headingS">{title}</Txt>
			<Txt variant="caption" className="text-fg-secondary">{subtitle}</Txt>
		</View>
	</View>
)

/**
 * 08 · Vehicle Detail, and 09 · Weak Signal when the ping has gone stale.
 *
 * There is no ETA and no distance on this screen by design. It answers "where
 * is it now and can I get on", which is everything the data actually supports.
 */
export default function VehicleDetail() {
	const { id } = useLocalSearchParams()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const [vehicle, setVehicle] = useState(null)
	const [loading, setLoading] = useState(true)
	const [missing, setMissing] = useState(false)

	useEffect(() => {
		let cancelled = false

		const load = () =>
			fetchVehicle(id)
				.then(data => !cancelled && (setVehicle(data), setMissing(false)))
				// A 404 here means the driver ended the trip while this was open.
				.catch(() => !cancelled && setMissing(true))
				.finally(() => !cancelled && setLoading(false))

		load()
		const timer = setInterval(load, PING_INTERVAL_MS)

		return () => {
			cancelled = true
			clearInterval(timer)
		}
	}, [id])

	if (loading) {
		return (
			<View className="flex-1 items-center justify-center bg-surface-canvas">
				<ActivityIndicator color={theme.brand.hover} />
			</View>
		)
	}

	if (missing || !vehicle) {
		return (
			<View className="flex-1 justify-center bg-surface-canvas px-6">
				<EmptyState
					icon="directions-off"
					title={copy.search.emptyTitle('')}
					body={copy.search.emptyBody}
					action={
						<Pressable onPress={() => router.back()} className="mt-2 rounded-lg bg-brand px-6 py-3 active:opacity-80">
							<Txt variant="bodyMStrong" className="text-fg-on-brand">{copy.common.back}</Txt>
						</Pressable>
					}
				/>
			</View>
		)
	}

	return (
		<View className="flex-1 bg-surface-canvas">
			<StatusBar style="dark" />
			<Map
				vehicles={[vehicle]}
				selectedId={vehicle.id}
				routeWaypoints={vehicle.route?.waypoints}
				fitTo={vehicle.route?.waypoints}
			/>

			<Pressable
				onPress={() => router.back()}
				accessibilityRole="button"
				accessibilityLabel={copy.common.back}
				style={{ top: insets.top + 6, ...elevation.float }}
				className="absolute left-6 h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
			>
				<MaterialIcons name="arrow-back" size={22} color={theme.icon.primary} />
			</Pressable>

			<Sheet peekHeight={370}>
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
					<View className="flex-row items-center gap-3 pb-4 pt-1">
						<View
							className="h-12 w-12 items-center justify-center rounded-md border-2 bg-surface-sunken"
							style={{ borderColor: vehicle.stale ? theme.border.strong : theme.route[1] }}
						>
							<VehicleGlyph
								type={vehicle.vehicle_type}
								color={vehicle.stale ? theme.icon.muted : theme.icon.primary}
							/>
						</View>
						<View className="min-w-0 flex-1 gap-[2px]">
							<Txt variant="headingL" numberOfLines={1}>{vehicle.destination}</Txt>
							<View className="flex-row items-center gap-2">
								<Txt variant="monoData" className="text-fg-secondary">{vehicle.plate_number}</Txt>
								{!!vehicle.is_verified && (
									<Badge label="VERIFIED" tone="open" className="flex-row items-center" />
								)}
							</View>
						</View>
					</View>

					<View className="flex-row items-center rounded-lg bg-surface-sunken px-3 py-4">
						<Stat label={copy.vehicle.status}>
							<Txt variant="bodyMStrong" className={vehicle.stale ? 'text-capacity-stale-fg' : 'text-fg'}>
								{!vehicle.stale
									? copy.vehicle.live
									: vehicle.minutesAgo == null
										? copy.freshness.unknown
										: copy.freshness.minutes(Math.max(1, vehicle.minutesAgo))}
							</Txt>
						</Stat>
						<Stat label={copy.vehicle.type}>
							<Txt variant="bodyMStrong">{VEHICLE_LABELS[vehicle.vehicle_type] ?? vehicle.vehicle_type}</Txt>
						</Stat>
						<Stat label={copy.vehicle.capacity}>
							<CapacityBadge state={vehicle.capacity} />
						</Stat>
					</View>

					{vehicle.stale && (
						<View className="mt-4 flex-row items-start gap-3 rounded-lg bg-capacity-stale-bg p-4">
							<MaterialIcons name="signal-wifi-statusbar-null" size={18} color={theme.capacity.stale.fg} />
							<View className="min-w-0 flex-1">
								<Txt variant="bodyMStrong" className="text-capacity-stale-fg">{copy.vehicle.staleTitle}</Txt>
								<Txt variant="caption" className="text-fg-secondary">{copy.vehicle.staleBody}</Txt>
							</View>
						</View>
					)}

					<View className="mt-4">
						<DetailRow
							tint={theme.brand.subtle}
							title={vehicle.route?.label ?? vehicle.destination}
							subtitle={[
								vehicle.current_street
									? (vehicle.stale
										? copy.vehicle.lastOnStreet(vehicle.current_street)
										: copy.vehicle.currentlyAt(vehicle.current_street))
									: null,
								vehicle.route?.length_km ? copy.vehicle.routeLength(vehicle.route.length_km) : null
							].filter(Boolean).join(' · ')}
						>
							<MaterialIcons name="place" size={20} color={theme.brand.hover} />
						</DetailRow>

						{!!vehicle.driver_name && (
							<DetailRow
								tint={theme.surface.sunken}
								title={vehicle.driver_name}
								subtitle={copy.vehicle.verifiedDriver(vehicle.driver_years)}
							>
								<Txt variant="bodyMStrong" className="text-fg-secondary">
									{vehicle.driver_name.charAt(0)}
								</Txt>
							</DetailRow>
						)}
					</View>
				</ScrollView>
			</Sheet>
		</View>
	)
}
