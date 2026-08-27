import { Image } from 'react-native'
import mark from '@/assets/logo-mark.png'

/**
 * Biya-HERO. The cape is the whole idea — a road running through a B, with a
 * hero cape lifting behind it.
 *
 * Do NOT reuse this for map pins: pins stay capeless so they read at 44 px on a
 * busy map. Use VehicleGlyph there instead.
 */
export const LogoMark = ({ size = 104 }) => (
	<Image source={mark} style={{ width: size, height: size }} resizeMode="contain" />
)
