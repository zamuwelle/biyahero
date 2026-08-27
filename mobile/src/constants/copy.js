/**
 * Every user-facing string, lifted verbatim from the Figma screens.
 * Filipino is the shipping language — the Settings "Wika" row is a stated v2.
 * Keep strings here rather than inline so the eventual EN pass is one file.
 */

export const app = {
	name: 'Biyahero',
	tagline: 'Alamin kung anong sasakyan ang papunta sa iyo — nang hindi nagra-rehistro.'
}

export const roleSelect = {
	eyebrow: 'Kumusta!',
	title: 'Ano ang gagawin mo ngayon?',
	subtitle: 'Puwede mong palitan ito anumang oras sa Settings.',
	commuter: {
		title: 'Sakay ako',
		badge: 'WALANG ACCOUNT',
		body: 'Tingnan agad ang mga aktibong sasakyan. Walang sign-up, walang password, at hindi hinihingi ang lokasyon mo.'
	},
	driver: {
		title: 'Driver ako',
		badge: 'KAILANGAN NG REHISTRO',
		body: 'Ipaalam sa mga pasahero na aktibo ka. Kailangan ng one-time na rehistro ng sasakyan at lisensya para ma-verify.'
	},
	footnote: 'Isang app lang ang Biyahero. Karaniwang pasahero rin ang mga drayber — puwede kang lumipat kahit kailan.'
}

export const settings = {
	title: 'Settings',
	modeLabel: 'KASALUKUYANG MODE',
	commuter: 'Sakay ako',
	driver: 'Driver ako',
	language: 'Wika',
	languageValue: 'Tagalog · English',
	theme: 'Tema',
	themeValue: 'Sumusunod sa device — Liwanag sa araw, Dilim sa gabi',
	location: 'Lokasyon',
	locationOn: 'Pinapayagan habang ginagamit',
	locationOff: 'Hindi pinapayagan',
	clearSearches: 'Burahin ang mga hinanap',
	clearSearchesHint: 'Naka-save lang sa device na ito',
	searchesCleared: 'Nabura ang mga hinanap',
	privacy: 'Walang account ang Biyahero para sa mga pasahero. Walang personal na impormasyong iniimbak sa server.'
}

export const mapHome = {
	searchPlaceholder: 'Saan ka pupunta?',
	/** Count is injected: "12 sasakyan aktibo ngayon". */
	activeCount: n => `${n} sasakyan aktibo ngayon`,
	updateNote: 'Nag-a-update kada 8 segundo · walang location permission',
	filters: [
		{ key: 'all', label: 'Lahat' },
		{ key: 'jeepney', label: 'Jeepney' },
		{ key: 'ejeep', label: 'E-Jeep' },
		{ key: 'bus', label: 'Bus' },
		{ key: 'uv_express', label: 'UV Express' }
	]
}

export const search = {
	placeholder: 'Saan ka pupunta?',
	recent: 'MGA HULING HINANAP',
	popular: 'MGA SIKAT NA DESTINASYON',
	privacy: 'Naka-save sa device mo lang. Walang account at hindi hinihingi ang lokasyon mo.',
	activeCount: n => `${n} sasakyan aktibo ngayon`,
	/** Corridor match, not a route lookup — 400 m either side of the destination. */
	resultsTitle: (n, dest) => `${n} sasakyan papuntang ${dest}`,
	resultsSubtitle: dest => `Mga rutang dumadaan sa loob ng 400 m ng ${dest}`,
	emptyTitle: dest => `Walang sasakyan papuntang ${dest}`,
	emptyBody: 'Walang aktibong drayber sa rutang ito ngayon. Karaniwan itong nangyayari pagkatapos ng 9 PM.',
	/** No destination typed — nothing is being filtered, there is simply nobody out. */
	noneActiveTitle: 'Walang aktibong sasakyan ngayon',
	noneActiveBody: 'Walang drayber na nagbo-broadcast sa ngayon. Subukan ulit maya-maya.',
	clear: 'I-clear'
}

export const vehicle = {
	status: 'KALAGAYAN',
	type: 'URI',
	capacity: 'KAPASIDAD',
	live: 'Live',
	/** Street name, not a distance — the app never learns where the commuter is. */
	currentlyAt: street => `Kasalukuyang nasa ${street}`,
	routeLength: km => `${km} km ang buong ruta`,
	onStreet: street => `Nasa ${street} ngayon`,
	lastOnStreet: street => `Huling nasa ${street}`,
	verifiedDriver: years => `Beripikadong drayber · ${years} taon sa ruta`,
	staleTitle: 'Huling alam na posisyon',
	staleBody: 'Walang live na GPS. Ipinapakita ang oras kung kailan huling nakita.'
}

export const capacity = {
	open: 'May upuan',
	filling: 'Medyo puno',
	full: 'Puno',
	unknown: 'Di sigurado'
}

export const freshness = {
	live: 'LIVE',
	/** Minutes since the last ping, for anything past PING staleness. */
	minutes: n => `${n} MIN`,
	/**
	 * Never heard from at all. Showing "1 MIN" here would claim a ping we never
	 * received — the same invention the no-ETA rule exists to prevent.
	 */
	unknown: '—'
}

export const signUp = {
	eyebrow: 'REHISTRO NG DRAYBER',
	title: 'Magparehistro bilang drayber',
	body: 'Ang numero mo lang ang gagamitin para sa pag-log in at abiso. Hindi ito ipapakita sa mga pasahero.',
	phoneLabel: 'Numero ng telepono',
	phonePrefix: '+63',
	phonePlaceholder: '917 555 0142',
	phoneHint: 'Padadalhan ka namin ng 6-digit na code sa SMS.',
	terms: 'Sa pagpapatuloy, sumasang-ayon ka sa Mga Tuntunin at Patakaran sa Privacy ng Biyahero.',
	continue: 'Magpatuloy',
	invalidPhone: 'Kulang ang numero — 10 digit ang kailangan.'
}

export const vehicleDetails = {
	eyebrow: 'DETALYE NG SASAKYAN',
	title: 'Anong sasakyan ang minamaneho mo?',
	body: 'Ipapakita ito sa mga pasahero para makilala ka nila sa kalsada.',
	typeLabel: 'URI NG SASAKYAN',
	plateLabel: 'PLAKA',
	platePlaceholder: 'NCR 8842',
	modelLabel: 'MODELO',
	modelPlaceholder: 'Sarao 2018',
	plateNote: 'Pampubliko ang plaka — nakapinta na ito sa sasakyan.',
	continue: 'Magpatuloy',
	invalidPlate: 'Kailangan ang plaka ng sasakyan.'
}

export const licence = {
	eyebrow: 'BERIPIKASYON',
	title: 'Kunan ng larawan ang lisensya mo',
	body: 'Isang beses lang ito. Ginagamit namin ito para patunayan na lehitimong drayber ka.',
	frameHint: 'Ipasok ang lisensya sa loob ng frame',
	capture: 'Kunan ng larawan',
	retake: 'Ulitin',
	submit: 'Ipadala ang rehistro',
	captured: 'Nakuha ang larawan',
	confirmLabel: 'KUMPIRMAHIN ANG DETALYE',
	nameLabel: 'PANGALAN SA LISENSYA',
	namePlaceholder: 'Roberto Santos',
	numberLabel: 'NUMERO NG LISENSYA',
	numberPlaceholder: 'N01-19-123456',
	invalidName: 'Kailangan ang pangalan sa lisensya.',
	/** Never displayed back to anyone — the design stores a hash, not the number. */
	hashNote: 'Lisensya: naka-hash, hindi kailanman ipinapakita.'
}

export const pending = {
	title: 'Sinusuri ang rehistro mo',
	body: 'Karaniwang tumatagal ito ng 1–2 oras sa mga araw ng trabaho. Aabisuhan ka namin sa SMS kapag aprubado na.',
	steps: [
		{ title: 'Naipadala ang rehistro', body: 'Natanggap namin ang detalye ng sasakyan at lisensya mo.' },
		{ title: 'Sinusuri ngayon', body: 'Kinukumpirma namin ang lisensya at plaka.' },
		{ title: 'Handa ka nang magbiyahe', body: 'Makikita ka na ng mga pasahero kapag aprubado.' }
	],
	footnote: 'Habang naghihintay, puwede mo pa ring gamitin ang Biyahero bilang pasahero — isang app lang ito.',
	useAsCommuter: 'Gamitin bilang pasahero'
}

export const driverHome = {
	greetingMorning: 'Magandang umaga,',
	greetingAfternoon: 'Magandang hapon,',
	greetingEvening: 'Magandang gabi,',
	offlineNote: 'Offline ka ngayon — hindi ka nakikita ng mga pasahero',
	todayLabel: 'NGAYONG ARAW',
	trips: 'BIYAHE',
	hoursOnline: 'ORAS ONLINE',
	kmTravelled: 'KM NABIYAHE',
	startTrip: 'Simulan ang biyahe',
	startNote: 'Sisimulan nito ang pagbo-broadcast ng lokasyon mo. Titigil ito kapag tinapos mo ang biyahe.'
}

export const startTrip = {
	title: 'Saan ka papunta?',
	body: 'Sabihin sa mga pasahero kung saan ka patungo ngayong biyahe. Puwede mo itong palitan anumang oras.',
	frequentLabel: 'MADALAS MONG RUTA',
	previewLabel: 'PREVIEW NG RUTA',
	preview: (km, mins) => `~${km} km · tinatayang ${mins} min sa trapiko ngayon`,
	destinationPlaceholder: 'Ilagay ang destinasyon',
	start: 'Simulan ang biyahe',
	needDestination: 'Pumili muna ng destinasyon.'
}

export const activeTrip = {
	liveBanner: 'LIVE — nakikita ka ng mga pasahero',
	heading: dest => `Papuntang ${dest}`,
	elapsed: (mins, km) => `${mins} min na · ${km} km ang nabiyahe`,
	change: 'Palitan',
	capacityPrompt: 'GAANO KAPUNO ANG SASAKYAN MO?',
	end: 'Tapusin ang biyahe',
	endNote: 'Ititigil nito ang pag-broadcast ng lokasyon mo. Mawawala ka agad sa mapa ng mga pasahero.'
}

export const driverProfile = {
	totalTrips: 'KABUUANG BIYAHE',
	onRoute: 'SA RUTA',
	onTime: 'ON-TIME',
	years: n => `${n} taon`,
	/** Deliberate product decision, surfaced in the UI rather than hidden. */
	noRatings: 'Walang rating ang Biyahero — anonymous ang mga pasahero, kaya walang mananagot sa mga review.',
	myVehicle: 'SASAKYAN KO',
	edit: 'Baguhin',
	tripHistory: 'Kasaysayan ng biyahe',
	languageTheme: 'Wika at tema',
	help: 'Tulong at suporta',
	logout: 'Mag-log out'
}

export const common = {
	back: 'Bumalik',
	cancel: 'Kanselahin',
	retry: 'Subukan ulit',
	loading: 'Sandali lang…',
	offline: 'Walang koneksyon',
	genericError: 'May naganap na problema. Subukan ulit.'
}
