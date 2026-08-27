import { create } from 'zustand'

/**
 * Draft state for the three-step driver registration (11 → 12 → 13).
 * Kept out of the main store because it is scratch data: it exists only between
 * the first screen and a successful POST, and is discarded either way.
 */
export const useRegistration = create(set => ({
	/**
	 * True while the vehicle screen is editing the REGISTERED vehicle rather
	 * than drafting a new registration. Set by the profile's Edit action —
	 * carried here instead of a route param, which proved unreliable.
	 */
	editing: false,
	name: '',
	vehicle_type: 'jeepney',
	plate_number: '',
	model: '',
	body_number: '',
	license_no: '',
	license_expires_at: '',
	/** Local file URI of the captured licence photo, uploaded on submit. */
	licencePhotoUri: null,

	update: patch => set(patch),

	/** Prefill from the registered vehicle and enter edit mode. */
	beginEdit: vehicle =>
		set({
			editing: true,
			vehicle_type: vehicle.vehicle_type ?? 'jeepney',
			plate_number: vehicle.plate_number ?? '',
			model: vehicle.model ?? '',
			body_number: vehicle.body_number ?? ''
		}),

	endEdit: () => set({ editing: false }),

	reset: () =>
		set({
			editing: false,
			name: '',
			vehicle_type: 'jeepney',
			plate_number: '',
			model: '',
			body_number: '',
			license_no: '',
			license_expires_at: '',
			licencePhotoUri: null
		})
}))
