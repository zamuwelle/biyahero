import { useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useRegistration } from '@/services/registration'
import * as copy from '@/constants/copy'

/**
 * 11 · Driver Sign Up. Phone only — the number is the login handle and is never
 * shown to passengers. Name comes from the licence in step 3, where it belongs.
 */
export default function DriverSignUp() {
	const router = useRouter()
	const phone = useRegistration(s => s.phone)
	const update = useRegistration(s => s.update)
	const [error, setError] = useState(null)

	const digits = phone.replace(/\D/g, '')

	const next = () => {
		if (digits.length < 10) return setError(copy.signUp.invalidPhone)
		setError(null)
		router.push('/driver/vehicle')
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-8 flex-grow" keyboardShouldPersistTaps="handled">
					<Header eyebrow={copy.signUp.eyebrow} title={copy.signUp.title} />

					<Txt variant="bodyM" className="text-fg-secondary">{copy.signUp.body}</Txt>

					<Field
						label={copy.signUp.phoneLabel}
						prefix={copy.signUp.phonePrefix}
						placeholder={copy.signUp.phonePlaceholder}
						value={phone}
						onChangeText={value => update({ phone: value })}
						keyboardType="phone-pad"
						autoComplete="tel"
						hint={copy.signUp.phoneHint}
						error={error}
					/>

					<View className="flex-1" />

					<View className="gap-4">
						<Button label={copy.signUp.continue} onPress={next} disabled={digits.length < 10} />
						<Txt variant="caption" className="text-center text-fg-secondary">{copy.signUp.terms}</Txt>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
