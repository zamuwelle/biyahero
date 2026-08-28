import { useEffect, useState } from 'react'
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { VehicleGlyph } from '@/components/VehicleGlyph'
import { useRegistration } from '@/services/registration'
import { useStore } from '@/services/store'
import { updateVehicle } from '@/services/api'
import { VEHICLE_TYPES, VEHICLE_LABELS } from '@/theme/tokens'
import { useTheme } from '@/theme/useTheme'
import { useCopy } from '@/constants/copy'

/**
 * 12 · Vehicle Details. Type is picked by silhouette, the way it is on the road.
 *
 * Doubles as the EDIT screen (?edit=1 from the profile): fields prefill from
 * the registered vehicle and save via PATCH instead of continuing to the
 * licence step. The plate is half the login credential, so editing it changes
 * what the driver types to log in — the screen says so.
 */
export default function VehicleDetails() {
	const copy = useCopy()
	const { theme } = useTheme()
	const router = useRouter()
	const { vehicle_type, plate_number, model, body_number, editing } = useRegistration()
	const update = useRegistration(s => s.update)

	const driver = useStore(s => s.driver)
	const refreshMe = useStore(s => s.refreshMe)
	const showToast = useStore(s => s.showToast)

	const isEdit = editing && !!driver?.vehicle
	const [error, setError] = useState(null)
	const [saving, setSaving] = useState(false)

	// Leaving the screen ends edit mode, so a later registration starts clean.
	const endEdit = useRegistration(s => s.endEdit)
	useEffect(() => () => endEdit(), [])

	const next = () => {
		if (!plate_number.trim()) return setError(copy.vehicleDetails.invalidPlate)
		setError(null)
		router.push('/driver/licence')
	}

	const save = async () => {
		if (!plate_number.trim()) return setError(copy.vehicleDetails.invalidPlate)
		setError(null)
		setSaving(true)

		try {
			await updateVehicle({
				vehicle_type,
				plate_number: plate_number.trim(),
				model: model.trim() || undefined,
				body_number: body_number.trim() || undefined
			})
			await refreshMe()
			showToast(copy.vehicleDetails.saved)
			router.back()
		} catch {
			showToast(copy.common.genericError)
		} finally {
			setSaving(false)
		}
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-8 flex-grow" keyboardShouldPersistTaps="handled">
					<Header
						eyebrow={copy.vehicleDetails.eyebrow}
						title={isEdit ? copy.vehicleDetails.editTitle : copy.vehicleDetails.title}
						right={isEdit ? null : <Txt variant="labelS" className="text-fg-secondary">{copy.signUp.step(1, 2)}</Txt>}
					/>

					<Txt variant="bodyM" className="text-fg-secondary">{copy.vehicleDetails.body}</Txt>

					<View className="gap-3">
						<Txt variant="labelS" className="text-fg-secondary">{copy.vehicleDetails.typeLabel}</Txt>
						<View className="flex-row flex-wrap gap-3">
							{VEHICLE_TYPES.map(type => {
								const active = vehicle_type === type
								return (
									<Pressable
										key={type}
										onPress={() => update({ vehicle_type: type })}
										accessibilityRole="radio"
										accessibilityState={{ selected: active }}
										className={`min-w-[47%] flex-1 items-center gap-2 rounded-lg border-2 py-4 active:opacity-80 ${
											active ? 'border-brand bg-brand-subtle' : 'border-line-subtle bg-surface'
										}`}
									>
										<VehicleGlyph type={type} width={34} color={theme.icon.primary} />
										<Txt variant="labelL" className={active ? 'text-fg' : 'text-fg-secondary'}>
											{VEHICLE_LABELS[type]}
										</Txt>
									</Pressable>
								)
							})}
						</View>
					</View>

					<Field
						label={copy.vehicleDetails.plateLabel}
						placeholder={copy.vehicleDetails.platePlaceholder}
						value={plate_number}
						onChangeText={value => update({ plate_number: value.toUpperCase() })}
						autoCapitalize="characters"
						mono
						hint={isEdit ? copy.vehicleDetails.editPlateNote : copy.vehicleDetails.plateNote}
						error={error}
					/>

					<Field
						label={copy.vehicleDetails.modelLabel}
						placeholder={copy.vehicleDetails.modelPlaceholder}
						value={model}
						onChangeText={value => update({ model: value })}
					/>

					<Field
						label={copy.vehicleDetails.bodyLabel}
						placeholder={copy.vehicleDetails.bodyPlaceholder}
						value={body_number}
						onChangeText={value => update({ body_number: value })}
						mono
					/>

					<View className="flex-1" />

					<View className="gap-4">
						{isEdit ? (
							<Button label={copy.vehicleDetails.save} onPress={save} loading={saving} disabled={!plate_number.trim()} />
						) : (
							<>
								<Button label={copy.vehicleDetails.continue} onPress={next} disabled={!plate_number.trim()} />
								<Pressable onPress={() => router.push('/driver/login')} className="items-center py-1 active:opacity-70">
									<Txt variant="bodyMStrong" className="text-fg-secondary">{copy.signUp.haveAccount}</Txt>
								</Pressable>
								<Txt variant="caption" className="text-center text-fg-secondary">{copy.signUp.terms}</Txt>
							</>
						)}
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
