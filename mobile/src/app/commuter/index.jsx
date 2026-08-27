import { useCallback, useMemo, useState } from 'react'
import { View, ScrollView, Pressable } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons } from '@expo/vector-icons'
import { Map } from '@/components/Map'
import { SearchBar } from '@/components/SearchBar'
import { VehicleCard } from '@/components/VehicleCard'
import { EmptyState } from '@/components/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Txt } from '@/components/ui/Txt'
import { Chip } from '@/components/ui/Chip'
import { useStore } from '@/services/store'
import { elevation } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * 04/05 · Map Home, plus 07 (destination set), 09 (all stale) and 10 (no match).
 *
 * Opens with no questions asked: no account, no location permission. The user
 * drags the map to their area, and searching FILTERS this view rather than
 * navigating away from it.
 */
export default function MapHome() {
	const copy = useCopy()
	const { theme, statusBar } = useTheme()
	const router = useRouter()
	const insets = useSafeAreaInsets()

	const vehicles = useStore(s => s.vehicles)
	const destination = useStore(s => s.destination)
	const vehicleFilter = useStore(s => s.vehicleFilter)
	const selectedVehicleId = useStore(s => s.selectedVehicleId)
	const setVehicleFilter = useStore(s => s.setVehicleFilter)
	const clearDestination = useStore(s => s.clearDestination)
	const selectVehicle = useStore(s => s.selectVehicle)
	const startPolling = useStore(s => s.startPolling)
	const stopPolling = useStore(s => s.stopPolling)
	const myLocation = useStore(s => s.myLocation)
	const myLocationOn = useStore(s => s.myLocationOn)
	const toggleMyLocation = useStore(s => s.toggleMyLocation)
	const enableMyLocation = useStore(s => s.enableMyLocation)
	const [locateNonce, setLocateNonce] = useState(0)

	const onCrosshair = async () => {
		if (myLocationOn) {
			// Already on: first re-tap recentres; turning it off is done from the
			// same button via long-press semantics being overkill — recentre wins.
			setLocateNonce(n => n + 1)
			return
		}
		const ok = await enableMyLocation()
		if (ok) setLocateNonce(n => n + 1)
	}

	useFocusEffect(
		useCallback(() => {
			startPolling()
			return () => stopPolling()
		}, [])
	)

	const allStale = vehicles.length > 0 && vehicles.every(v => v.stale)
	const routeWaypoints = useMemo(
		() => vehicles.find(v => v.id === selectedVehicleId)?.route?.waypoints,
		[vehicles, selectedVehicleId]
	)
	const fitTo = useMemo(
		() => (destination ? vehicles.map(v => v.position).filter(Boolean) : null),
		[destination, vehicles]
	)

	const openVehicle = vehicle => {
		selectVehicle(vehicle.id)
		router.push(`/commuter/vehicle/${vehicle.id}`)
	}

	return (
		<View className="flex-1 bg-surface-canvas">
			<StatusBar style={statusBar} />
			<Map
				rememberRegion
				vehicles={vehicles}
				selectedId={selectedVehicleId}
				onSelect={openVehicle}
				routeWaypoints={routeWaypoints}
				fitTo={fitTo}
				myLocation={myLocation}
				locateNonce={locateNonce}
			/>

			<View style={{ top: insets.top + 6 }} className="absolute left-6 right-6 flex-row items-center gap-2">
				<View className="flex-1">
					<SearchBar
						value={destination?.name}
						onPress={() => router.push('/commuter/search')}
						onClear={clearDestination}
					/>
				</View>
				<Pressable
					onPress={() => router.push('/settings')}
					accessibilityRole="button"
					accessibilityLabel={copy.settings.title}
					style={elevation.float}
					className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
				>
					<MaterialIcons name="settings" size={22} color={theme.icon.secondary} />
				</Pressable>
			</View>

			{/* Crosshair: the ONLY way the app ever asks for a commuter location. */}
			<Pressable
				onPress={onCrosshair}
				onLongPress={toggleMyLocation}
				accessibilityRole="button"
				accessibilityLabel={copy.mapHome.myLocation}
				accessibilityState={{ selected: myLocationOn }}
				style={elevation.float}
				className="absolute bottom-[350px] right-6 h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
			>
				<MaterialIcons name={myLocationOn ? 'my-location' : 'location-searching'} size={24} color={myLocationOn ? '#1A73E8' : theme.icon.secondary} />
			</Pressable>

			<Sheet peekHeight={330}>
				<View className="gap-3 pb-3">
					<View className="gap-[3px]">
						<Txt variant="headingM">
							{destination
								? copy.search.resultsTitle(vehicles.length, destination.name)
								: copy.mapHome.activeCount(vehicles.length)}
						</Txt>
						<Txt variant="caption" className="text-fg-secondary">
							{destination ? copy.search.resultsSubtitle(destination.name) : myLocationOn ? copy.mapHome.updateNoteLocated : copy.mapHome.updateNote}
						</Txt>
					</View>

					<View className="flex-row flex-wrap gap-2">
						{copy.mapHome.filters.map(f => (
							<Chip
								key={f.key}
								label={f.label}
								active={vehicleFilter === f.key}
								onPress={() => setVehicleFilter(f.key)}
							/>
						))}
					</View>
				</View>

				{allStale && (
					<View className="mb-3 flex-row items-center gap-3 rounded-lg bg-capacity-stale-bg p-3">
						<MaterialIcons name="signal-wifi-statusbar-null" size={20} color={theme.capacity.stale.fg} />
						<View className="min-w-0 flex-1">
							<Txt variant="bodyMStrong" className="text-capacity-stale-fg">{copy.vehicle.staleTitle}</Txt>
							<Txt variant="caption" className="text-fg-secondary">{copy.vehicle.staleBody}</Txt>
						</View>
					</View>
				)}

				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-[10px] pb-8">
					{vehicles.length === 0 ? (
						<EmptyState
							icon={destination ? 'search-off' : 'directions-bus'}
							title={destination ? copy.search.emptyTitle(destination.name) : copy.search.noneActiveTitle}
							body={destination ? copy.search.emptyBody : copy.search.noneActiveBody}
						/>
					) : (
						vehicles.map(v => <VehicleCard key={v.id} vehicle={v} onPress={() => openVehicle(v)} />)
					)}
				</ScrollView>
			</Sheet>
		</View>
	)
}
