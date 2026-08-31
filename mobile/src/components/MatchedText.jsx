import { Txt } from '@/components/ui/Txt'

/** Everything a search box treats as a word break. */
const SPLIT = /[\s,\-]+/

/**
 * A place name with the typed part picked out in bold, the way a map's own
 * suggestion list does it. Seeing WHY a row is in the list is most of what
 * makes a suggestion list feel like it is listening.
 *
 * Token-wise, not a leading prefix: typing "coffee" should light up "The
 * Coffee Bean", where the match starts six characters in.
 */
export const MatchedText = ({ text, query, className = 'text-fg', ...rest }) => {
	const tokens = (query ?? '')
		.trim()
		.toLowerCase()
		.split(SPLIT)
		// One letter matches half the alphabet's worth of names; bolding on it
		// lights up the whole row and says nothing.
		.filter(token => token.length > 1)

	const spans = []

	if (tokens.length) {
		const lower = text.toLowerCase()
		const hits = []

		tokens.forEach(token => {
			for (let at = lower.indexOf(token); at !== -1; at = lower.indexOf(token, at + token.length)) {
				hits.push([at, at + token.length])
			}
		})

		// Overlapping tokens ("san" inside "santa") would otherwise render the
		// same characters twice.
		hits.sort((a, b) => a[0] - b[0])
		hits.forEach(([from, to]) => {
			const last = spans[spans.length - 1]

			if (last && from <= last[1]) last[1] = Math.max(last[1], to)
			else spans.push([from, to])
		})
	}

	if (!spans.length) {
		return <Txt variant="bodyMStrong" className={className} {...rest}>{text}</Txt>
	}

	const parts = []
	let cursor = 0

	spans.forEach(([from, to], i) => {
		if (from > cursor) parts.push(<Txt key={`p${i}`} variant="bodyM" className="text-fg-secondary">{text.slice(cursor, from)}</Txt>)
		parts.push(<Txt key={`m${i}`} variant="bodyMStrong" className={className}>{text.slice(from, to)}</Txt>)
		cursor = to
	})

	if (cursor < text.length) parts.push(<Txt key="tail" variant="bodyM" className="text-fg-secondary">{text.slice(cursor)}</Txt>)

	return <Txt variant="bodyM" className={className} {...rest}>{parts}</Txt>
}
