import { View, ScrollView } from 'react-native'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { useCopy } from '@/constants/copy'

/**
 * Tulong at suporta. Deliberately just honest answers about how the app
 * behaves — no invented hotline or support inbox, because none exists yet.
 */
export default function Help() {
	const copy = useCopy()

	return (
		<Screen>
			<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 pt-4 gap-6">
				<Header title={copy.help.title} />

				<View className="gap-3">
					{copy.help.items.map(item => (
						<View key={item.q} className="gap-2 rounded-lg border-[1.5px] border-line-subtle bg-surface p-4">
							<Txt variant="headingS">{item.q}</Txt>
							<Txt variant="bodyM" className="text-fg-secondary">{item.a}</Txt>
						</View>
					))}
				</View>
			</ScrollView>
		</Screen>
	)
}
