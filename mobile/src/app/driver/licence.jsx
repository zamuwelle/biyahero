import { useState } from 'react'
import { View, ScrollView, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useRegistration } from '@/services/registration'
import { useStore } from '@/services/store'
import { theme } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/**
 * 13 · Licence Capture.
 *
 * The capture is a placeholder: it marks the step complete but does not open a
 * camera or run OCR, so the driver confirms the two fields by hand. A real build
 * swaps this frame for expo-camera plus text recognition — the submitted licence
 * number is hashed server-side either way and is never displayed again.
 */
export default function LicenceCapture() {
	const router = useRouter()
	const draft = useRegistration()
	const update = useRegistration(s => s.update)
	const reset = useRegistration(s => s.reset)
	const register = useStore(s => s.register)
	const registering = useStore(s => s.registering)
	const showToast = useStore(s => s.showToast)

	const [error, setError] = useState(null)

	const submit = async () => {
		if (!draft.name.trim()) return setError(copy.licence.invalidName)
		setError(null)

		try {
			await register({
				name: draft.name.trim(),
				phone: `+63${draft.phone.replace(/\D/g, '').replace(/^0/, '')}`,
				vehicle_type: draft.vehicle_type,
				plate_number: draft.plate_number.trim(),
				model: draft.model.trim() || undefined,
				body_number: draft.body_number.trim() || undefined,
				license_no: draft.license_no.trim() || undefined
			})
			reset()
			router.replace('/driver/pending')
		} catch {
			showToast(copy.common.genericError)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-6 flex-grow" keyboardShouldPersistTaps="handled">
					<Header eyebrow={copy.licence.eyebrow} title={copy.licence.title} />

					<Txt variant="bodyM" className="text-fg-secondary">{copy.licence.body}</Txt>

					<View
						className={`items-center justify-center gap-4 rounded-xl border-2 border-dashed py-10 ${
							draft.licenceCaptured ? 'border-capacity-open-fg bg-capacity-open-bg' : 'border-line-strong bg-surface-sunken'
						}`}
					>
						<MaterialIcons
							name={draft.licenceCaptured ? 'check-circle' : 'credit-card'}
							size={40}
							color={draft.licenceCaptured ? theme.capacity.open.fg : theme.icon.muted}
						/>
						<Txt variant="bodyMStrong" className={draft.licenceCaptured ? 'text-capacity-open-fg' : 'text-fg-secondary'}>
							{draft.licenceCaptured ? copy.licence.captured : copy.licence.frameHint}
						</Txt>
						<Button
							label={draft.licenceCaptured ? copy.licence.retake : copy.licence.capture}
							tone="secondary"
							icon="photo-camera"
							onPress={() => update({ licenceCaptured: !draft.licenceCaptured })}
						/>
					</View>

					{draft.licenceCaptured && (
						<View className="gap-4">
							<Txt variant="labelS" className="text-fg-secondary">{copy.licence.confirmLabel}</Txt>
							<Field
								label={copy.licence.nameLabel}
								placeholder={copy.licence.namePlaceholder}
								value={draft.name}
								onChangeText={value => update({ name: value })}
								autoCapitalize="words"
								error={error}
							/>
							<Field
								label={copy.licence.numberLabel}
								placeholder={copy.licence.numberPlaceholder}
								value={draft.license_no}
								onChangeText={value => update({ license_no: value.toUpperCase() })}
								autoCapitalize="characters"
								mono
								hint={copy.licence.hashNote}
							/>
						</View>
					)}

					<View className="flex-1" />
					<Button
						label={copy.licence.submit}
						onPress={submit}
						loading={registering}
						disabled={!draft.licenceCaptured || !draft.name.trim()}
					/>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
