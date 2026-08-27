import { View, ScrollView, Pressable } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { MaterialIcons } from '@expo/vector-icons'
import { Txt } from '@/components/ui/Txt'
import { Row } from '@/components/ui/Row'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { StatCard } from '@/components/StatCard'
import { DriverVehicleCard } from '@/components/DriverVehicleCard'
import { useStore } from '@/services/store'
import { theme } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/**
 * 18 · Driver Profile. No rating anywhere by design — passengers are anonymous,
 * so nobody could be held accountable for a review. The screen says so out loud.
 */
export default function DriverProfile() {
	const router = useRouter()
	const driver = useStore(s => s.driver)
	const logout = useStore(s => s.logout)

	if (!driver) return <Redirect href="/driver/vehicle" />

	const signOut = async () => {
		await logout()
		router.replace('/role')
	}

	return (
		<SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-canvas">
			<StatusBar style="dark" />
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8">
				<View className="items-center gap-3 bg-brand-subtle px-6 pb-8 pt-4">
					<View className="w-full flex-row justify-start">
						<Pressable
							onPress={() => router.back()}
							hitSlop={10}
							accessibilityRole="button"
							accessibilityLabel={copy.common.back}
							className="active:opacity-70"
						>
							<MaterialIcons name="arrow-back" size={22} color={theme.icon.primary} />
						</Pressable>
					</View>
					<Avatar name={driver.name} size={88} tone="brand" />
					<Txt variant="headingL">{driver.name}</Txt>
					{!!driver.is_verified && <Badge label="VERIFIED" tone="open" />}
				</View>

				<View className="gap-6 px-6 pt-6">
					{/* Counted from the trips table, never stored. There is no
					    on-time figure because nothing records a schedule to
					    measure against — total distance is real, so it is shown
					    instead. */}
					<View className="flex-row gap-3">
						<StatCard value={(driver.stats?.completed_trips ?? 0).toLocaleString()} label={copy.driverProfile.totalTrips} />
						<StatCard value={copy.driverProfile.years(driver.stats?.years_on_route ?? 0)} label={copy.driverProfile.onRoute} />
						<StatCard value={`${driver.stats?.total_km ?? 0}`} label={copy.driverProfile.totalKm} />
					</View>

					<Txt variant="caption" className="text-fg-secondary">{copy.driverProfile.noRatings}</Txt>

					<View className="gap-3">
						<Txt variant="labelS" className="text-fg-secondary">{copy.driverProfile.myVehicle}</Txt>
						<DriverVehicleCard
							vehicle={driver.vehicle}
							onEdit={() => router.push('/driver/vehicle')}
						/>
					</View>

					<View className="gap-3">
						<Row title={copy.driverProfile.tripHistory} onPress={() => {}} />
						<Row title={copy.driverProfile.languageTheme} onPress={() => router.push('/settings')} />
						<Row title={copy.driverProfile.help} onPress={() => {}} />
					</View>

					<Pressable onPress={signOut} accessibilityRole="button" className="items-center py-2 active:opacity-70">
						<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.driverProfile.logout}</Txt>
					</Pressable>
				</View>
			</ScrollView>
		</SafeAreaView>
	)
}
