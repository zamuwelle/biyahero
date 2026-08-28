import { useCallback, useMemo, useState } from 'react'
import { distanceM, remainingRoute } from '@/services/geo'
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
	const corridorRadiusM = useStore(s => s.corridorRadiusM)
	const searchedPosition = useStore(s => s.destinationPosition)
	const vehiclesFor = useStore(s => s.vehiclesFor)
	const error = useStore(s => s.error)
	const destinationResolved = useStore(s => s.destinationResolved)
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
	const selected = useMemo(
		() => vehicles.find(v => v.id === selectedVehicleId),
		[vehicles, selectedVehicleId]
	)
	// Navigation-style: only the part of the route still ahead of the vehicle,
	// oriented toward where the trip is actually going.
	const routeWaypoints = useMemo(
		() => (selected ? remainingRoute(selected.position, selected.route?.waypoints, selected.destinationPosition) : undefined),
		[selected]
	)

	// The place the map should name: the selected vehicle's destination first,
	// otherwise the destination being searched for. Both are public places.
	// Route-end fallback matches the detail screen — a route line without a
	// head is exactly the floating squiggle the pin exists to prevent.
	const destinationPin = useMemo(() => {
		if (selected) {
			const at = selected.destinationPosition ?? selected.route?.waypoints?.[selected.route.waypoints.length - 1]
			if (at) return { ...at, label: selected.destination }
		}
		if (destination?.lat != null) {
			return { latitude: Number(destination.lat), longitude: Number(destination.lng), label: destination.name }
		}
		// A typed place we do not list: the server located it for us.
		if (destination && searchedPosition) {
			return { ...searchedPosition, label: destination.name }
		}
		return null
	}, [selected, destination, searchedPosition])

	const fitTo = useMemo(
		() =>
			destination
				? [...vehicles.map(v => v.position), destinationPin].filter(Boolean)
				: null,
		[destination, vehicles, destinationPin]
	)

	// Straight from the server, so the promise on screen matches the filter
	// that actually produced the list.
	const corridorRadiusText = corridorRadiusM
		? corridorRadiusM < 1000
			? `${corridorRadiusM} m`
			: `${(corridorRadiusM / 1000).toFixed(1)} km`
		: '1.5 km'

	// Frame once per SET of matches — not per poll, and not just per search.
	// The filtered list arrives a beat after the destination does (the old
	// citywide fleet is still in state), and the filter chips narrow it again;
	// keying on the ids re-frames for those and stays put while they only move.
	const fitKey = useMemo(
		() => (destination ? `${destination.name}|${vehicleFilter}|${vehicles.map(v => v.id).join(',')}` : 'none'),
		[destination, vehicleFilter, vehicles]
	)

	// Stable identity: memoised pins and cards compare onSelect/onPress by
	// reference, so an inline arrow here would defeat them every poll.
	const openVehicle = useCallback(vehicle => {
		selectVehicle(vehicle.id)
		router.push(`/commuter/vehicle/${vehicle.id}`)
	}, [selectVehicle, router])

	// With the blue dot on, the list answers "which ride reaches me first" —
	// live vehicles nearest-first, stale ones after (their "position" is only
	// where they were last seen). Distances are ranked in 100 m buckets with an
	// id tie-break so GPS jitter and 8 s hops don't shuffle cards under the
	// user's finger. Off (or failed — the watcher can die after a seed fix, so
	// myLocation alone is not proof), the server's freshest-ping order stands.
	// A destination search arrives already ordered by how close each route
	// runs to it — that ordering answers the question being asked, so it wins
	// over "nearest to me".
	const located = myLocationOn && !!myLocation && !destination
	const listVehicles = useMemo(() => {
		if (!located) return vehicles
		const rank = v => Math.round((distanceM(myLocation, v.position) ?? Infinity) / 100)
		return [...vehicles].sort((a, b) => (a.stale - b.stale) || (rank(a) - rank(b)) || (a.id - b.id))
	}, [vehicles, located, myLocation])

	// Crosshair: the ONLY way the app ever asks for a commuter location. It
	// rides in the map's own control column so it and the layer button share a
	// right edge and an even gap, the way a map app stacks its buttons.
	const crosshair = (
		<Pressable
			onPress={onCrosshair}
			onLongPress={toggleMyLocation}
			accessibilityRole="button"
			accessibilityLabel={copy.mapHome.myLocation}
			accessibilityState={{ selected: myLocationOn }}
			style={elevation.float}
			className="h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-line-subtle bg-surface active:opacity-80"
		>
			<MaterialIcons name={myLocationOn ? 'my-location' : 'location-searching'} size={24} color={myLocationOn ? '#1A73E8' : theme.icon.secondary} />
		</Pressable>
	)

	return (
		<View className="flex-1 bg-surface-canvas">
			<StatusBar style={statusBar} />
			<Map
				rememberRegion
				vehicles={vehicles}
				selectedId={selectedVehicleId}
				onSelect={openVehicle}
				onMapPress={() => selectVehicle(null)}
				fitKey={fitKey}
				routeWaypoints={routeWaypoints}
				destinationPin={destinationPin}
				fitTo={fitTo}
				myLocation={myLocation}
				locateNonce={locateNonce}
				controls={crosshair}
				controlsBottom={350}
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

			<Sheet
				peekHeight={330}
				head={
					<View className="gap-3 pb-3">
						<View className="gap-[3px]">
							<Txt variant="headingM">
								{destination
									? copy.search.resultsTitle(vehicles.length, destination.name)
									: copy.mapHome.activeCount(vehicles.length)}
							</Txt>
							<Txt variant="caption" className="text-fg-secondary">
								{destination
								? copy.search.resultsSubtitle(destination.name, corridorRadiusText)
								: myLocationOn
									? copy.mapHome.updateNoteLocated
									: copy.mapHome.updateNote}
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
				}
			>
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
							// Three different silences, and only one of them is "nobody is
							// driving": the request may have failed, or the place may not
							// exist. Saying the wrong one sends the user hunting for a
							// jeepney that was never the problem.
							icon={error ? 'wifi-off' : destination ? 'search-off' : 'directions-bus'}
							title={
								error
									? copy.search.offlineTitle
									: destination && !destinationResolved
										? copy.search.unknownPlaceTitle(destination.name)
										: destination
											? copy.search.emptyTitle(destination.name)
											: copy.search.noneActiveTitle
							}
							body={
								error
									? copy.search.offlineBody
									: destination && !destinationResolved
										? copy.search.unknownPlaceBody
										: destination
											? copy.search.emptyBody
											: copy.search.noneActiveBody
							}
						/>
					) : (
						listVehicles.map((v, i) => (
							<VehicleCard
								key={v.id}
								vehicle={v}
								onPress={openVehicle}
								// Never on a stale card — "closest" must not assert live
								// proximity from a minutes-old last-seen position.
								nearest={i === 0 && located && !!v.position && !v.stale}
								passesNote={
									// Only once the list itself has caught up with the
									// destination — otherwise the previous search's
									// distances would be printed under the new name.
									destination && vehiclesFor === destination.name && v.passesWithinM != null
										? copy.vehicle.passesWithin(v.passesWithinM, destination.name)
										: null
								}
							/>
						))
					)}
				</ScrollView>
			</Sheet>
		</View>
	)
}
