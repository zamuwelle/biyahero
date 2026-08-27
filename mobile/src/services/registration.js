import { create } from 'zustand'

/**
 * Draft state for the three-step driver registration (11 → 12 → 13).
 * Kept out of the main store because it is scratch data: it exists only between
 * the first screen and a successful POST, and is discarded either way.
 */
export const useRegistration = create(set => ({
	name: '',
	phone: '',
	vehicle_type: 'jeepney',
	plate_number: '',
	model: '',
	body_number: '',
	license_no: '',
	licenceCaptured: false,

	update: patch => set(patch),

	reset: () =>
		set({
			name: '',
			phone: '',
			vehicle_type: 'jeepney',
			plate_number: '',
			model: '',
			body_number: '',
			license_no: '',
			licenceCaptured: false
		})
}))
