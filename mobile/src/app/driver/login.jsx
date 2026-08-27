import { useState } from 'react'
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useStore } from '@/services/store'
import { useCopy } from '@/constants/copy'

/**
 * Returning driver. Identity is LICENCE + PLATE — no password, no SMS code.
 *
 * Neither value is secret on its own: the plate is painted on the vehicle and
 * the licence is printed on a card. Together they are hard to guess, which is
 * the trade made to avoid an OTP. Someone who photographs the licence still
 * cannot log in without also knowing the plate.
 */
export default function DriverLogin() {
	const copy = useCopy()
	const router = useRouter()
	const login = useStore(s => s.login)

	const [licence, setLicence] = useState('')
	const [plate, setPlate] = useState('')
	const [error, setError] = useState(null)
	const [busy, setBusy] = useState(false)

	const ready = licence.trim().length >= 9 && plate.trim().length >= 3

	const submit = async () => {
		setBusy(true)
		setError(null)

		try {
			await login({ license_no: licence.trim(), plate_number: plate.trim() })
			router.replace('/driver')
		} catch (e) {
			setError(e?.response?.status === 404 ? copy.login.notFound : copy.common.genericError)
		} finally {
			setBusy(false)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-6 flex-grow" keyboardShouldPersistTaps="handled">
					<Header eyebrow={copy.login.eyebrow} title={copy.login.title} />

					<Txt variant="bodyM" className="text-fg-secondary">{copy.login.body}</Txt>

					<Field
						label={copy.login.licenceLabel}
						placeholder={copy.login.licencePlaceholder}
						value={licence}
						onChangeText={value => setLicence(value.toUpperCase())}
						autoCapitalize="characters"
						autoCorrect={false}
						mono
					/>

					<Field
						label={copy.login.plateLabel}
						placeholder={copy.login.platePlaceholder}
						value={plate}
						onChangeText={value => setPlate(value.toUpperCase())}
						autoCapitalize="characters"
						autoCorrect={false}
						mono
						hint={copy.login.hint}
						error={error}
					/>

					<View className="flex-1" />

					<View className="gap-4">
						<Button label={copy.login.submit} onPress={submit} loading={busy} disabled={!ready} />
						<Pressable onPress={() => router.replace('/driver/vehicle')} className="items-center py-2 active:opacity-70">
							<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.login.noAccount}</Txt>
						</Pressable>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
