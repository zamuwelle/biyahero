import { useCallback, useState } from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import { Redirect, useRouter, useFocusEffect } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/services/store'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/** How often to re-check with the server while the driver waits. */
const POLL_MS = 15_000

const Step = ({ title, body, state, last = false }) => {
	const copy = useCopy()
	const { theme } = useTheme()
	const done = state === 'done'
	const active = state === 'active'

	return (
		<View className="flex-row gap-4">
			<View className="items-center">
				<View
					className={`h-8 w-8 items-center justify-center rounded-full ${
						done ? 'bg-capacity-open-bg' : active ? 'bg-brand-subtle' : 'bg-surface-sunken'
					}`}
				>
					{done ? (
						<MaterialIcons name="check" size={18} color={theme.capacity.open.fg} />
					) : (
						<View className={`h-2 w-2 rounded-full ${active ? 'bg-brand-hover' : 'bg-icon-muted'}`} />
					)}
				</View>
				{!last && <View className="w-[1.5px] flex-1 bg-line-subtle" />}
			</View>

			<View className="min-w-0 flex-1 gap-1 pb-6">
				<Txt variant="headingS" className={done || active ? 'text-fg' : 'text-fg-secondary'}>{title}</Txt>
				<Txt variant="bodyM" className="text-fg-secondary">{body}</Txt>
			</View>
		</View>
	)
}

/**
 * 14 · Verification Pending.
 *
 * This reflects the driver's REAL verification_status, polled from the server.
 * Approval happens when a person runs `php artisan biyahero:review --approve`
 * after looking at the licence photo — nothing here advances on a timer.
 */
export default function VerificationPending() {
	const copy = useCopy()
	const { theme } = useTheme()
	const router = useRouter()
	const driver = useStore(s => s.driver)
	const refreshMe = useStore(s => s.refreshMe)
	const setRole = useStore(s => s.setRole)
	const [checking, setChecking] = useState(false)

	useFocusEffect(
		useCallback(() => {
			let cancelled = false

			const check = async () => {
				if (cancelled) return
				setChecking(true)
				await refreshMe()
				if (!cancelled) setChecking(false)
			}

			check()
			const timer = setInterval(check, POLL_MS)

			return () => {
				cancelled = true
				clearInterval(timer)
			}
		}, [])
	)

	if (!driver) return <Redirect href="/driver/vehicle" />

	const status = driver.verification_status
	const approved = status === 'approved'
	const rejected = status === 'rejected'

	// Only the first two steps are things we can actually assert: the submission
	// arrived, and a reviewer has it. The third depends on the real decision.
	const stateFor = index => {
		if (rejected) return index === 0 ? 'done' : 'idle'
		if (approved) return 'done'
		return index === 0 ? 'done' : index === 1 ? 'active' : 'idle'
	}

	const useAsCommuter = async () => {
		await setRole('commuter')
		router.replace('/commuter')
	}

	return (
		<Screen>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-10 gap-8 flex-grow">
				<View className="gap-3">
					<Txt variant="displayS">
						{approved ? copy.pending.approvedTitle : rejected ? copy.pending.rejectedTitle : copy.pending.title}
					</Txt>
					<Txt variant="bodyM" className="text-fg-secondary">
						{approved ? copy.pending.approvedBody : rejected ? copy.pending.rejectedBody : copy.pending.body}
					</Txt>
				</View>

				{rejected && !!driver.rejection_reason && (
					<View className="flex-row items-start gap-3 rounded-lg bg-capacity-full-bg p-4">
						<MaterialIcons name="error-outline" size={18} color={theme.capacity.full.fg} />
						<Txt variant="bodyM" className="min-w-0 flex-1 text-capacity-full-fg">{driver.rejection_reason}</Txt>
					</View>
				)}

				<View>
					{copy.pending.steps.map((step, index) => (
						<Step
							key={step.title}
							title={step.title}
							body={step.body}
							state={stateFor(index)}
							last={index === copy.pending.steps.length - 1}
						/>
					))}
				</View>

				{!approved && !rejected && (
					<View className="flex-row items-center gap-2">
						{checking && <ActivityIndicator size="small" color={theme.icon.muted} />}
						<Txt variant="caption" className="text-fg-secondary">
							{checking ? copy.pending.checking : copy.pending.body}
						</Txt>
					</View>
				)}

				<View className="flex-1" />

				<View className="gap-3">
					{approved && <Button label={copy.driverHome.startTrip} onPress={() => router.replace('/driver')} />}
					{/* Re-registering cannot work — the licence is already on file and
					    always 409s — so the only honest action is to keep using the app
					    as a passenger while a human reviews the revocation. */}
					{rejected && <Button label={copy.pending.useAsCommuter} onPress={useAsCommuter} />}
					{!approved && !rejected && (
						<Button label={copy.pending.refresh} tone="secondary" icon="refresh" onPress={refreshMe} loading={checking} />
					)}
					<Button label={copy.pending.useAsCommuter} tone="ghost" onPress={useAsCommuter} />
					<Txt variant="caption" className="text-center text-fg-secondary">{copy.pending.footnote}</Txt>
				</View>
			</ScrollView>
		</Screen>
	)
}
