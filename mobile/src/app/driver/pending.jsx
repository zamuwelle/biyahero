import { useEffect, useState } from 'react'
import { View, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/services/store'
import { theme } from '@/theme/tokens'
import * as copy from '@/constants/copy'

const Step = ({ title, body, state }) => {
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
				<View className="w-[1.5px] flex-1 bg-line-subtle" />
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
 * The hackathon backend approves a registration immediately, so this walks the
 * three states rather than polling a queue that would never change. The screen
 * stays in the flow because it is where a real review would surface, and the
 * driver can go use the app as a passenger meanwhile — it is one app.
 */
export default function VerificationPending() {
	const router = useRouter()
	const setRole = useStore(s => s.setRole)
	const [stage, setStage] = useState(0)

	useEffect(() => {
		const timers = [
			setTimeout(() => setStage(1), 900),
			setTimeout(() => setStage(2), 2000)
		]
		return () => timers.forEach(clearTimeout)
	}, [])

	const stateFor = index => (stage > index ? 'done' : stage === index ? 'active' : 'idle')
	const approved = stage >= 2

	const useAsCommuter = async () => {
		await setRole('commuter')
		router.replace('/commuter')
	}

	return (
		<Screen>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-10 gap-8 flex-grow">
				<View className="gap-3">
					<Txt variant="displayS">{approved ? copy.pending.steps[2].title : copy.pending.title}</Txt>
					<Txt variant="bodyM" className="text-fg-secondary">{copy.pending.body}</Txt>
				</View>

				<View>
					{copy.pending.steps.map((step, index) => (
						<Step key={step.title} title={step.title} body={step.body} state={stateFor(index)} />
					))}
				</View>

				<View className="flex-1" />

				<View className="gap-3">
					{approved && <Button label={copy.driverHome.startTrip} onPress={() => router.replace('/driver')} />}
					<Button label={copy.pending.useAsCommuter} tone="secondary" onPress={useAsCommuter} />
					<Txt variant="caption" className="text-center text-fg-secondary">{copy.pending.footnote}</Txt>
				</View>
			</ScrollView>
		</Screen>
	)
}
