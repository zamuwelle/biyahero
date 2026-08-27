import { useRef, useState } from 'react'
import { View, ScrollView, Image, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { MaterialIcons } from '@expo/vector-icons'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useRegistration } from '@/services/registration'
import { useStore } from '@/services/store'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/** Mirrors the server rule: PH licences are a 3-2-6 pattern. */
const LICENCE_PATTERN = /^[A-Z]\d{2}-\d{2}-\d{6}$/
const EXPIRY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 13 · Licence Capture — step 2 of 2. A real photo through a framed viewfinder.
 *
 * The number's SHAPE and expiry are checked, and that is all that can be
 * checked: LTO publishes no verification API, so nothing confirms the licence
 * exists or belongs to whoever is holding the phone. Passing both approves the
 * driver immediately — no queue, no waiting.
 *
 * The photo uploads to a private disk and is retained so a person can revoke a
 * driver afterwards with `php artisan biyahero:review {licence} --revoke`.
 */
export default function LicenceCapture() {
	const copy = useCopy()
	const { theme } = useTheme()
	const router = useRouter()
	const draft = useRegistration()
	const update = useRegistration(s => s.update)
	const reset = useRegistration(s => s.reset)

	const register = useStore(s => s.register)
	const registering = useStore(s => s.registering)
	const showToast = useStore(s => s.showToast)

	const cameraRef = useRef(null)
	const [permission, requestPermission] = useCameraPermissions()
	const [capturing, setCapturing] = useState(false)
	const [error, setError] = useState(null)

	const capture = async () => {
		if (!cameraRef.current || capturing) return
		setCapturing(true)

		try {
			// Modest quality: a licence card is legible well below full sensor
			// resolution, and this has to upload over mobile data.
			const photo = await cameraRef.current.takePictureAsync({ quality: 0.6, skipProcessing: true })
			if (photo?.uri) update({ licencePhotoUri: photo.uri })
		} catch {
			showToast(copy.common.genericError)
		} finally {
			setCapturing(false)
		}
	}

	const submit = async () => {
		if (!draft.licencePhotoUri) return setError(copy.licence.needPhoto)
		if (!draft.name.trim()) return setError(copy.licence.invalidName)
		if (!LICENCE_PATTERN.test(draft.license_no.trim().toUpperCase())) return setError(copy.licence.invalidNumber)
		if (!EXPIRY_PATTERN.test(draft.license_expires_at.trim())) return setError(copy.licence.invalidExpiry)
		if (new Date(draft.license_expires_at.trim()) <= new Date()) return setError(copy.licence.expiredLicence)
		setError(null)

		try {
			await register({
				name: draft.name.trim(),
				vehicle_type: draft.vehicle_type,
				plate_number: draft.plate_number.trim(),
				model: draft.model.trim(),
				body_number: draft.body_number.trim(),
				license_no: draft.license_no.trim(),
				license_expires_at: draft.license_expires_at.trim(),
				licencePhotoUri: draft.licencePhotoUri
			})
			reset()
			// Format and expiry are all that can be checked, and they passed —
			// so the driver is already approved and can go straight to work.
			router.replace('/driver')
		} catch (e) {
			if (e?.response?.status === 409) {
				showToast(copy.signUp.alreadyRegistered)
				router.replace('/driver/login')
				return
			}
			showToast(e?.response?.data?.message ?? copy.common.genericError)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-6 flex-grow" keyboardShouldPersistTaps="handled">
					<Header
						eyebrow={copy.licence.eyebrow}
						title={copy.licence.title}
						right={<Txt variant="labelS" className="text-fg-secondary">{copy.signUp.step(2, 2)}</Txt>}
					/>

					<Txt variant="bodyM" className="text-fg-secondary">{copy.licence.body}</Txt>

					{/* Licence cards are landscape, so the frame is too. */}
					<View className="aspect-[1.6] overflow-hidden rounded-xl border-2 border-dashed border-line-strong bg-surface-sunken">
						{draft.licencePhotoUri ? (
							<Image source={{ uri: draft.licencePhotoUri }} className="h-full w-full" resizeMode="cover" />
						) : !permission ? (
							<View className="flex-1 items-center justify-center">
								<Txt variant="caption" className="text-fg-secondary">{copy.common.loading}</Txt>
							</View>
						) : !permission.granted ? (
							<View className="flex-1 items-center justify-center gap-3 p-6">
								<MaterialIcons name="photo-camera" size={32} color={theme.icon.muted} />
								<Txt variant="bodyMStrong" className="text-center text-fg">{copy.licence.permissionTitle}</Txt>
								<Txt variant="caption" className="text-center text-fg-secondary">{copy.licence.permissionBody}</Txt>
								<Button label={copy.licence.grant} tone="secondary" onPress={requestPermission} />
							</View>
						) : (
							<CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
								<View className="flex-1 items-center justify-end p-4">
									<View className="rounded-full bg-surface-inverse/70 px-3 py-1">
										<Txt variant="caption" className="text-fg-inverse">{copy.licence.frameHint}</Txt>
									</View>
								</View>
							</CameraView>
						)}
					</View>

					{permission?.granted && (
						<Button
							label={draft.licencePhotoUri ? copy.licence.retake : copy.licence.capture}
							tone="secondary"
							icon="photo-camera"
							loading={capturing}
							onPress={draft.licencePhotoUri ? () => update({ licencePhotoUri: null }) : capture}
						/>
					)}

					{!!draft.licencePhotoUri && (
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
							<Field
								label={copy.licence.expiryLabel}
								placeholder={copy.licence.expiryPlaceholder}
								value={draft.license_expires_at}
								onChangeText={value => update({ license_expires_at: value })}
								keyboardType="numbers-and-punctuation"
								autoCorrect={false}
								mono
							/>
						</View>
					)}

					<View className="flex-1" />

					<View className="gap-3">
						<Button
							label={copy.licence.submit}
							onPress={submit}
							loading={registering}
							disabled={!draft.licencePhotoUri || !draft.name.trim() || !draft.license_no.trim() || !draft.license_expires_at.trim()}
						/>
						<View className="flex-row items-start gap-2">
							<MaterialIcons name="info-outline" size={16} color={theme.icon.secondary} />
							<Txt variant="caption" className="min-w-0 flex-1 text-fg-secondary">{copy.licence.reviewNote}</Txt>
						</View>
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
