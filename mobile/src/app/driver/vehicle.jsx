import { useState } from 'react'
import { View, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { Txt } from '@/components/ui/Txt'
import { Header } from '@/components/ui/Header'
import { Field } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { VehicleGlyph } from '@/components/VehicleGlyph'
import { useRegistration } from '@/services/registration'
import { theme, VEHICLE_TYPES, VEHICLE_LABELS } from '@/theme/tokens'
import * as copy from '@/constants/copy'

/** 12 · Vehicle Details. Type is picked by silhouette, the way it is on the road. */
export default function VehicleDetails() {
	const router = useRouter()
	const { vehicle_type, plate_number, model, body_number } = useRegistration()
	const update = useRegistration(s => s.update)
	const [error, setError] = useState(null)

	const next = () => {
		if (!plate_number.trim()) return setError(copy.vehicleDetails.invalidPlate)
		setError(null)
		router.push('/driver/licence')
	}

	return (
		<Screen>
			<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
				<ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-6 pt-4 gap-8 flex-grow" keyboardShouldPersistTaps="handled">
					<Header eyebrow={copy.vehicleDetails.eyebrow} title={copy.vehicleDetails.title} />

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
						hint={copy.vehicleDetails.plateNote}
						error={error}
					/>

					<Field
						label={copy.vehicleDetails.modelLabel}
						placeholder={copy.vehicleDetails.modelPlaceholder}
						value={model}
						onChangeText={value => update({ model: value })}
					/>

					<Field
						label="BODY NO."
						placeholder="214"
						value={body_number}
						onChangeText={value => update({ body_number: value })}
						mono
					/>

					<View className="flex-1" />
					<Button label={copy.vehicleDetails.continue} onPress={next} disabled={!plate_number.trim()} />
				</ScrollView>
			</KeyboardAvoidingView>
		</Screen>
	)
}
