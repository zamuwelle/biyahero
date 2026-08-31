import Jeepney from '@/assets/glyphs/jeepney.svg'
import EJeep from '@/assets/glyphs/ejeep.svg'
import Bus from '@/assets/glyphs/bus.svg'
import UvExpress from '@/assets/glyphs/uv_express.svg'
import { useTheme } from '@/theme/useTheme'

const GLYPHS = { jeepney: Jeepney, ejeep: EJeep, bus: Bus, uv_express: UvExpress }

/**
 * The four PH vehicle classes, exported from Figma. Distinguished by SILHOUETTE
 * rather than interior detail so they survive at 44 px on a busy map:
 * jeepney long-low-stepped, E-Jeep short with a roof pod, bus long-tall-flat,
 * UV Express rounded dome van.
 */
export const VehicleGlyph = ({ type = 'jeepney', width = 26, color }) => {
	const { theme } = useTheme()
	const Glyph = GLYPHS[type] ?? GLYPHS.jeepney
	// Source art is 26 × 18 — hold that ratio at any width.
	return <Glyph width={width} height={(width / 26) * 18} color={color ?? theme.icon.primary} />
}
