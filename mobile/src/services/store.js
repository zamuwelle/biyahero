import { create } from 'zustand'
import * as Location from 'expo-location'

export const useStore = create((set, get) => ({
	coords: null,
	mapRef: null,
	setMapRef: mapRef => set({ mapRef }),
	recenter: (duration = 500) => {
		const { mapRef, coords } = get()
		coords && mapRef?.animateCamera({ center: coords, zoom: 16 }, { duration })
	},
	initLocation: () =>
		Location.requestForegroundPermissionsAsync().then(({ status }) => {
			if (status !== 'granted') return
			Location.getCurrentPositionAsync({}).then(loc => {
				set({ coords: loc.coords })
				get().recenter(600)
			})
			Location.watchPositionAsync({ timeInterval: 2000, distanceInterval: 1 }, loc => set({ coords: loc.coords }))
		})
}))

useStore.getState().initLocation()
