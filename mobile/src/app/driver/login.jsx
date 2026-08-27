import { useState } from 'react'
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/services/store'
import * as copy from '@/constants/copy'

/**
 * Returning driver. Registration is one-time, but a driver who logs out, gets a
 * new phone, or reinstalls needs a way back to the same account — otherwise the
 * only path is registering again, which would orphan their vehicle and history.
 *
 * There is no password: the phone number is the handle, matching the sign-up
 * screen. That is weak, and is the same gap flagged in AuthController — it needs
 * the SMS code the design promises before this is used for real.
 */
export default function DriverLogin() {
	const router = useRouter()
	const login = useStore(s => s.login)

	const [phone, setPhone] = useState('')
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	const digits = phone.replace(/\D/g, '')

	const submit = async () => {
		setBusy(true)
		setError(null)

		try {
			const driver = await login(`+63${digits.replace(/^0/, '')}`)
			// Approved drivers go straight to work; everyone else back to the
			// review screen, which reflects their real status.
			router.replace(driver?.verification_status === 'approved' ? '/driver' : '/driver/pending')
		} catch (e) {
			setError(e?.response?.status === 404 ? copy.login.notFound : copy.common.genericError)
		} finally {
			setBusy(false)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-8 flex-grow" keyboardShouldPersistTaps="handled">
					<Header eyebrow={copy.login.eyebrow} title={copy.login.title} />

					<Txt variant="bodyM" className="text-fg-secondary">{copy.login.body}</Txt>

					<Field
						label={copy.login.phoneLabel}
						prefix={copy.signUp.phonePrefix}
						placeholder={copy.signUp.phonePlaceholder}
						value={phone}
						onChangeText={setPhone}
						keyboardType="phone-pad"
						autoComplete="tel"
						error={error}
					/>

					<View className="flex-1" />

					<View className="gap-4">
						<Button label={copy.login.submit} onPress={submit} loading={busy} disabled={digits.length < 10} />
						<Pressable onPress={() => router.replace('/driver/signup')} className="items-center py-2 active:opacity-70">
							<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.login.noAccount}</Txt>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
