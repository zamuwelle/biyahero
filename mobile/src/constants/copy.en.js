/**
 * English copy — key-for-key mirror of copy.tl.js. If a key exists there it
 * must exist here, or a screen renders `undefined` the moment the user switches.
 */

export const app = {
	name: 'Biyahero',
	tagline: 'Know which ride is coming your way — without signing up.'
}

export const roleSelect = {
	eyebrow: 'Hello!',
	title: 'What are you doing today?',
	subtitle: 'You can change this any time in Settings.',
	commuter: {
		title: "I'm riding",
		badge: 'NO ACCOUNT',
		body: 'See active vehicles right away. No sign-up, no password, and your location is never requested.'
	},
	driver: {
		title: "I'm driving",
		badge: 'REGISTRATION REQUIRED',
		body: 'Let passengers know you are on the road. One-time vehicle and licence registration is required.'
	},
	footnote: 'Biyahero is one app. Drivers are commuters too — you can switch any time.'
}

export const settings = {
	title: 'Settings',
	modeLabel: 'CURRENT MODE',
	commuter: "I'm riding",
	driver: "I'm driving",
	language: 'Language',
	languageNames: { tl: 'Filipino', en: 'English' },
	tapToChange: 'Tap to change',
	theme: 'Theme',
	themeNames: { system: 'Follows your device', light: 'Always light', dark: 'Always dark' },
	location: 'Location',
	locationOn: 'Allowed while in use',
	locationOff: 'Not allowed — open system settings',
	locationNotAsked: 'Never requested — only drivers need it',
	clearSearches: 'Clear recent searches',
	clearSearchesHint: 'Saved on this device only',
	searchesCleared: 'Searches cleared',
	privacy: 'Biyahero has no accounts for passengers. No personal information is stored on the server.'
}

export const mapHome = {
	searchPlaceholder: 'Where are you going?',
	activeCount: n => `${n} vehicle${n === 1 ? '' : 's'} active now`,
	updateNote: 'Updates every 8 seconds · no location permission',
	filters: [
		{ key: 'all', label: 'All' },
		{ key: 'jeepney', label: 'Jeepney' },
		{ key: 'ejeep', label: 'E-Jeep' },
		{ key: 'bus', label: 'Bus' },
		{ key: 'uv_express', label: 'UV Express' }
	]
}

export const search = {
	placeholder: 'Where are you going?',
	recent: 'RECENT SEARCHES',
	popular: 'POPULAR DESTINATIONS',
	privacy: 'Saved on your device only. No account, and your location is never requested.',
	activeCount: n => `${n} vehicle${n === 1 ? '' : 's'} active now`,
	resultsTitle: (n, dest) => `${n} vehicle${n === 1 ? '' : 's'} bound for ${dest}`,
	resultsSubtitle: dest => `Routes passing within 400 m of ${dest}`,
	emptyTitle: dest => `No vehicles bound for ${dest}`,
	emptyBody: 'No driver is active on this route right now. This is common after 9 PM.',
	noneActiveTitle: 'No vehicles active right now',
	noneActiveBody: 'No driver is broadcasting at the moment. Try again shortly.',
	clear: 'Clear'
}

export const vehicle = {
	status: 'STATUS',
	type: 'TYPE',
	capacity: 'CAPACITY',
	live: 'Live',
	currentlyAt: street => `Currently on ${street}`,
	routeLength: km => `${km} km full route`,
	onStreet: street => `On ${street} now`,
	lastOnStreet: street => `Last seen on ${street}`,
	verifiedDriver: years => `Verified driver · ${years} year${years === 1 ? '' : 's'} on the route`,
	staleTitle: 'Last known position',
	staleBody: 'No live GPS. Showing when this vehicle was last seen.'
}

export const capacity = {
	open: 'Seats open',
	filling: 'Filling up',
	full: 'Full',
	unknown: 'Unknown'
}

export const freshness = {
	live: 'LIVE',
	minutes: n => `${n} MIN`,
	unknown: '—'
}

export const signUp = {
	eyebrow: 'DRIVER REGISTRATION',
	step: (n, of) => `Step ${n} of ${of}`,
	haveAccount: 'Already registered? Log in',
	alreadyRegistered: 'This licence is already registered. Just log in.',
	terms: 'By continuing you agree to the Biyahero Terms and Privacy Policy.'
}

export const login = {
	eyebrow: 'LOG IN',
	title: 'Log in as a driver',
	body: "Enter your licence number and your vehicle's plate.",
	licenceLabel: 'LICENCE NUMBER',
	licencePlaceholder: 'N01-19-123456',
	plateLabel: 'VEHICLE PLATE',
	platePlaceholder: 'NCR 8842',
	submit: 'Log in',
	noAccount: 'No account yet? Register',
	notFound: 'Licence and plate do not match.',
	hint: 'No password and no SMS code.'
}

export const vehicleDetails = {
	eyebrow: 'VEHICLE DETAILS',
	title: 'What vehicle do you drive?',
	body: 'Passengers see this so they can recognise you on the road.',
	typeLabel: 'VEHICLE TYPE',
	plateLabel: 'PLATE',
	platePlaceholder: 'NCR 8842',
	modelLabel: 'MODEL',
	modelPlaceholder: 'Sarao 2018',
	plateNote: 'The plate is public — it is painted on the vehicle.',
	continue: 'Continue',
	invalidPlate: 'The vehicle plate is required.',
	editTitle: 'Edit vehicle',
	save: 'Save changes',
	saved: 'Changes saved',
	editPlateNote: 'The plate is half of your login — if you change it, use the new one to log in.'
}

export const licence = {
	eyebrow: 'VERIFICATION',
	title: 'Take a photo of your licence',
	body: 'Just once. We use it to check that you are a legitimate driver.',
	frameHint: 'Fit the licence inside the frame',
	capture: 'Take photo',
	retake: 'Retake',
	submit: 'Submit registration',
	captured: 'Photo captured',
	confirmLabel: 'CONFIRM THE DETAILS',
	nameLabel: 'NAME ON LICENCE',
	namePlaceholder: 'Roberto Santos',
	numberLabel: 'LICENCE NUMBER',
	numberPlaceholder: 'N01-19-123456',
	invalidName: 'The name on the licence is required.',
	needPhoto: 'A photo of the licence is required.',
	permissionTitle: 'Camera access needed',
	permissionBody: 'It is only used to photograph your licence.',
	grant: 'Allow camera',
	expiryLabel: 'EXPIRY DATE',
	expiryPlaceholder: 'YYYY-MM-DD',
	invalidExpiry: 'Enter the expiry date (YYYY-MM-DD).',
	expiredLicence: 'Your licence has expired.',
	invalidNumber: 'Wrong number format. It should look like N01-19-123456.',
	reviewNote: 'We check the number format and expiry. The photo is kept in case of a dispute.',
	hashNote: 'Licence: hashed, never displayed.'
}

export const pending = {
	title: 'Reviewing your registration',
	body: 'This usually takes 1–2 hours on working days. We will notify you once approved.',
	steps: [
		{ title: 'Registration received', body: 'We received your vehicle and licence details.' },
		{ title: 'Under review', body: 'We are confirming the licence and plate.' },
		{ title: 'Ready to drive', body: 'Passengers will see you once you start a trip.' }
	],
	footnote: 'Biyahero is one app — you can keep using it as a passenger meanwhile.',
	useAsCommuter: 'Use as passenger',
	checking: 'Checking status…',
	refresh: 'Refresh status',
	notApproved: 'Your registration is not approved yet.',
	approvedTitle: 'You are approved!',
	approvedBody: 'Passengers will see you once you start a trip.',
	rejectedTitle: 'Registration not approved',
	rejectedBody: 'Check the reason below and submit a clear photo of your licence again.'
}

export const driverHome = {
	greetingMorning: 'Good morning,',
	greetingAfternoon: 'Good afternoon,',
	greetingEvening: 'Good evening,',
	offlineNote: 'You are offline — passengers cannot see you',
	todayLabel: 'TODAY',
	trips: 'TRIPS',
	hoursOnline: 'HOURS ONLINE',
	kmTravelled: 'KM TRAVELLED',
	startTrip: 'Start a trip',
	startNote: 'This starts broadcasting your location. It stops when you end the trip.'
}

export const startTrip = {
	title: 'Where are you headed?',
	body: 'Tell passengers where this trip is going. You can change it any time.',
	frequentLabel: 'YOUR FREQUENT ROUTES',
	previewLabel: 'ROUTE PREVIEW',
	preview: (km, mins) => `~${km} km · about ${mins} min in current traffic`,
	destinationPlaceholder: 'Enter a destination',
	start: 'Start the trip',
	needDestination: 'Pick a destination first.'
}

export const activeTrip = {
	liveBanner: 'LIVE — passengers can see you',
	heading: dest => `Bound for ${dest}`,
	elapsed: (mins, km) => `${mins} min in · ${km} km travelled`,
	change: 'Change',
	capacityPrompt: 'HOW FULL IS YOUR VEHICLE?',
	end: 'End the trip',
	endNote: 'This stops broadcasting your location. You disappear from passenger maps immediately.'
}

export const driverProfile = {
	totalTrips: 'TOTAL TRIPS',
	onRoute: 'ON THE ROUTE',
	totalKm: 'KM TRAVELLED',
	years: n => `${n} year${n === 1 ? '' : 's'}`,
	noRatings: 'Biyahero has no ratings — passengers are anonymous, so nobody could be held to a review.',
	myVehicle: 'MY VEHICLE',
	edit: 'Edit',
	tripHistory: 'Trip history',
	settingsRow: 'Settings',
	settingsRowHint: 'Language, theme, and mode switch (Ride/Drive)',
	help: 'Help and support',
	logout: 'Log out'
}

export const history = {
	title: 'Trip history',
	empty: 'No completed trips yet',
	emptyBody: 'Every trip you finish will show up here.',
	meta: (mins, km) => `${mins} min · ${km} km`,
	months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
}

export const help = {
	title: 'Help and support',
	items: [
		{
			q: 'How do passengers see me?',
			a: 'When you start a trip, your location is sent every 8 seconds. When you end it, you disappear from their map immediately.'
		},
		{
			q: 'What does VERIFIED mean?',
			a: 'Your licence number is correctly formatted, not expired, and a photo is on file. It is not a confirmation from the LTO.'
		},
		{
			q: 'How do I log in on another phone?',
			a: "Enter your licence number and your vehicle's plate. No password and no SMS code."
		},
		{
			q: 'Can drivers see passengers?',
			a: 'No. Biyahero never requests passenger locations, so there is no heatmap and no count of people waiting.'
		},
		{
			q: 'How do I change my plate or vehicle?',
			a: 'On your profile, tap "Edit". Remember: the plate is half of your login.'
		}
	]
}

export const common = {
	back: 'Back',
	cancel: 'Cancel',
	retry: 'Try again',
	loading: 'One moment…',
	offline: 'No connection',
	genericError: 'Something went wrong. Try again.'
}
