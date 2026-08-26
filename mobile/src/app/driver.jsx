import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '@/services/store'
import { Map } from '@/components/Map'
import { IconButton } from '@/components/IconButton'
import { BottomCard } from '@/components/BottomCard'

const VEHICLE_TYPES = ['Jeepney', 'E-Jeep', 'Bus', 'UV Express']

export default () => {
	const router = useRouter()
	const driver = useStore(s => s.driver)
	const isBroadcasting = useStore(s => s.isBroadcasting)
	const toggleBroadcast = useStore(s => s.toggleBroadcast)
	const stopBroadcast = useStore(s => s.stopBroadcast)
	const register = useStore(s => s.register)

	const [step, setStep] = useState(1)
	const [name, setName] = useState('Roberto Santos')
	const [phone, setPhone] = useState('+63 917 555 0142')
	const [vehicleType, setVehicleType] = useState('Jeepney')
	const [plateNumber, setPlateNumber] = useState('NCR 8842')
	const [model, setModel] = useState('Sarao 2018')
	const [licenseNo, setLicenseNo] = useState('N01-19-123456')
	const [isScanning, setIsScanning] = useState(false)
	const [licenseVerified, setLicenseVerified] = useState(false)

	useEffect(() => () => stopBroadcast(), [])

	const handleScanLicense = () => {
		setIsScanning(true)
		setTimeout(() => {
			setIsScanning(false)
			setLicenseVerified(true)
			setLicenseNo('N01-19-123456')
		}, 600)
	}

	const handleRegister = () => {
		register({
			name,
			phone: phone.replace(/\s+/g, ''),
			vehicle_type: vehicleType.toLowerCase(),
			plate_number: plateNumber,
			model,
			license_no: licenseNo,
			is_verified: true
		})
	}

	if (!driver) {
		return (
			<SafeAreaView className="flex-1 bg-slate-100 p-8">
				<ScrollView contentContainerClassName="gap-8" showsVerticalScrollIndicator={false}>
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-3">
							<TouchableOpacity
								onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
								activeOpacity={0.75}
								className="w-10 h-10 rounded-2xl bg-white items-center justify-center border border-slate-200 shadow-sm"
							>
								<MaterialIcons name="arrow-back" size={20} color="#0f172a" />
							</TouchableOpacity>
							<Text className="text-3xl font-black text-slate-900">Registration</Text>
						</View>
						<Text className="text-xs font-black text-amber-500 uppercase tracking-widest">Step {step} of 3</Text>
					</View>

					{step === 1 && (
						<View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-6">
							<View className="gap-2">
								<Text className="text-xl font-black text-slate-900">Driver Information</Text>
								<Text className="text-slate-500 text-sm">Enter your full name and mobile number.</Text>
							</View>
							<View className="gap-4">
								<View className="gap-2">
									<Text className="text-xs font-bold text-slate-400 uppercase">Full Name</Text>
									<TextInput value={name} onChangeText={setName} placeholder="e.g. Roberto Santos" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold" />
								</View>
								<View className="gap-2">
									<Text className="text-xs font-bold text-slate-400 uppercase">Mobile Number</Text>
									<TextInput value={phone} onChangeText={setPhone} placeholder="+63 9..." keyboardType="phone-pad" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold" />
								</View>
							</View>
							<TouchableOpacity onPress={() => setStep(2)} activeOpacity={0.75} className="bg-amber-500 rounded-2xl p-4 items-center">
								<Text className="text-white font-black text-base">Continue</Text>
							</TouchableOpacity>
						</View>
					)}

					{step === 2 && (
						<View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-6">
							<View className="gap-2">
								<Text className="text-xl font-black text-slate-900">Vehicle Details</Text>
								<Text className="text-slate-500 text-sm">Select vehicle type and enter registration plate.</Text>
							</View>
							<View className="gap-4">
								<View className="gap-2">
									<Text className="text-xs font-bold text-slate-400 uppercase">Vehicle Type</Text>
									<View className="flex-row flex-wrap gap-2">
										{VEHICLE_TYPES.map(type => (
											<TouchableOpacity key={type} onPress={() => setVehicleType(type)} activeOpacity={0.75} className={`px-4 py-3 rounded-2xl border ${vehicleType === type ? 'bg-slate-900 border-slate-900' : 'bg-slate-50 border-slate-200'}`}>
												<Text className={`text-xs font-black ${vehicleType === type ? 'text-white' : 'text-slate-600'}`}>{type}</Text>
											</TouchableOpacity>
										))}
									</View>
								</View>
								<View className="gap-2">
									<Text className="text-xs font-bold text-slate-400 uppercase">Plate Number</Text>
									<TextInput value={plateNumber} onChangeText={setPlateNumber} placeholder="e.g. NCR 8842" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold uppercase" />
								</View>
								<View className="gap-2">
									<Text className="text-xs font-bold text-slate-400 uppercase">Vehicle Model</Text>
									<TextInput value={model} onChangeText={setModel} placeholder="e.g. Sarao 2018" className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-bold" />
								</View>
							</View>
							<TouchableOpacity onPress={() => setStep(3)} activeOpacity={0.75} className="bg-amber-500 rounded-2xl p-4 items-center">
								<Text className="text-white font-black text-base">Continue</Text>
							</TouchableOpacity>
						</View>
					)}

					{step === 3 && (
						<View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-6">
							<View className="gap-2">
								<Text className="text-xl font-black text-slate-900">LTO License Verification</Text>
								<Text className="text-slate-500 text-sm">Scan your Philippine Driver's License for instant automated verification.</Text>
							</View>

							<View className="border-2 border-dashed border-slate-300 rounded-3xl p-8 items-center justify-center gap-4 bg-slate-50">
								<View className="w-16 h-16 rounded-2xl bg-amber-500/10 items-center justify-center">
									<MaterialIcons name={licenseVerified ? 'verified' : 'credit-card'} size={36} color={licenseVerified ? '#059669' : '#d97706'} />
								</View>
								{licenseVerified ? (
									<View className="items-center gap-1">
										<Text className="text-emerald-600 font-black text-base">LTO License Verified</Text>
										<Text className="text-slate-500 text-xs font-bold">{licenseNo}</Text>
									</View>
								) : (
									<TouchableOpacity onPress={handleScanLicense} activeOpacity={0.75} disabled={isScanning} className="bg-slate-900 rounded-2xl px-6 py-3 items-center">
										<Text className="text-white font-black text-sm">{isScanning ? 'Scanning Card...' : 'Scan LTO License'}</Text>
									</TouchableOpacity>
								)}
							</View>

							<TouchableOpacity onPress={handleRegister} activeOpacity={0.75} className="bg-amber-500 rounded-2xl p-4 items-center">
								<Text className="text-white font-black text-base">Complete Registration</Text>
							</TouchableOpacity>
						</View>
					)}
				</ScrollView>
			</SafeAreaView>
		)
	}

	if (!isBroadcasting) {
		return (
			<SafeAreaView className="flex-1 bg-slate-100 p-8 justify-between">
				<View className="gap-8">
					<View className="flex-row items-center justify-between">
						<View className="flex-row items-center gap-3">
							<TouchableOpacity
								onPress={() => router.back()}
								activeOpacity={0.75}
								className="w-10 h-10 rounded-2xl bg-white items-center justify-center border border-slate-200 shadow-sm"
							>
								<MaterialIcons name="arrow-back" size={20} color="#0f172a" />
							</TouchableOpacity>
							<Text className="text-3xl font-black text-slate-900">{driver.name}</Text>
						</View>
						<View className="w-12 h-12 rounded-2xl bg-emerald-500/10 items-center justify-center">
							<MaterialIcons name="verified" size={24} color="#059669" />
						</View>
					</View>

					<View className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm gap-4">
						<View className="flex-row items-center justify-between">
							<View className="flex-row items-center gap-4">
								<View className="w-12 h-12 rounded-2xl bg-slate-900/10 items-center justify-center">
									<MaterialIcons name="drive-eta" size={24} color="#0f172a" />
								</View>
								<View>
									<Text className="text-xs font-bold text-slate-400 uppercase">{driver.vehicle?.vehicle_type}</Text>
									<Text className="text-xl font-black text-slate-900">{driver.vehicle?.plate_number}</Text>
								</View>
							</View>
							<View className="px-3 py-1 bg-emerald-50 rounded-xl">
								<Text className="text-emerald-700 font-black text-xs">VERIFIED</Text>
							</View>
						</View>
						<Text className="text-slate-500 text-sm">{driver.vehicle?.model}</Text>
					</View>
				</View>

				<TouchableOpacity onPress={toggleBroadcast} activeOpacity={0.75} className="bg-amber-500 rounded-3xl p-6 items-center shadow-sm">
					<Text className="text-white font-black text-lg">Start Broadcasting</Text>
				</TouchableOpacity>
			</SafeAreaView>
		)
	}

	return (
		<View className="flex-1">
			<Map action={<IconButton name="cell-tower" size={32} color="#059669" onPress={toggleBroadcast} />} />
			<BottomCard
				icon="drive-eta"
				iconBg="bg-emerald-50"
				iconColor="#059669"
				label={driver.vehicle?.vehicle_type}
				title={driver.vehicle?.plate_number}
				status="Live"
				statusColor="text-emerald-600"
			/>
		</View>
	)
}
