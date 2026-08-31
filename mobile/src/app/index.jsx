import { Redirect } from 'expo-router'
import { useStore } from '@/services/store'

/**
 * Entry. Role is picked once and remembered, so a returning user lands straight
 * in the mode they last used — the switch lives in Settings.
 */
export default function Index() {
	const role = useStore(s => s.role)

	if (role === 'driver') return <Redirect href="/driver" />
	if (role === 'commuter') return <Redirect href="/commuter" />

	return <Redirect href="/role" />
}
