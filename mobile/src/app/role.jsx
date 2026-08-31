import { View, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LogoMark } from '@/components/LogoMark'
import { useStore } from '@/services/store'
import { useCopy } from '@/constants/copy'

/** 02 · Role Select. One app — the choice is remembered and reversible. */
export default function RoleSelect() {
	const copy = useCopy()
	const router = useRouter()
	const setRole = useStore(s => s.setRole)

	const choose = async role => {
		await setRole(role)
		router.replace(role === 'driver' ? '/driver' : '/commuter')
	}

	return (
		<Screen>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 pt-10 gap-8">
				<View className="gap-[10px]">
					<Txt variant="labelS" className="text-brand-hover">{copy.roleSelect.eyebrow}</Txt>
					<Txt variant="displayS">{copy.roleSelect.title}</Txt>
					<Txt variant="bodyM" className="text-fg-secondary">{copy.roleSelect.subtitle}</Txt>
				</View>

				<View className="gap-5">
					<Card selected onPress={() => choose('commuter')} className="gap-[14px]">
						<View className="flex-row items-center gap-[14px]">
							<LogoMark size={56} />
							<View className="min-w-0 flex-1 gap-[6px]">
								<Txt variant="headingL">{copy.roleSelect.commuter.title}</Txt>
								<Badge label={copy.roleSelect.commuter.badge} tone="open" />
							</View>
						</View>
						<Txt variant="bodyM" className="text-fg-secondary">{copy.roleSelect.commuter.body}</Txt>
					</Card>

					<Card onPress={() => choose('driver')} className="gap-[14px]">
						<View className="flex-row items-center gap-[14px]">
							<LogoMark size={56} />
							<View className="min-w-0 flex-1 gap-[6px]">
								<Txt variant="headingL">{copy.roleSelect.driver.title}</Txt>
								<Badge label={copy.roleSelect.driver.badge} tone="filling" />
							</View>
						</View>
						<Txt variant="bodyM" className="text-fg-secondary">{copy.roleSelect.driver.body}</Txt>
					</Card>
				</View>

				<Txt variant="caption" className="px-2 text-center text-fg-secondary">{copy.roleSelect.footnote}</Txt>
			</ScrollView>
		</Screen>
	)
}
