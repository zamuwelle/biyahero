import { useRef } from 'react'
import { TouchableOpacity, Animated } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const CompassButton = () => {
	const spinValue = useRef(new Animated.Value(0)).current
	const recenter = useStore(s => s.recenter)

	const handlePress = () => {
		recenter(500)
		spinValue.setValue(0)
		Animated.timing(spinValue, { toValue: 1, duration: 500, useNativeDriver: true }).start()
	}

	const spin = spinValue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

	return (
		<TouchableOpacity onPress={handlePress} className="w-12 h-12 rounded-2xl bg-white shadow-lg items-center justify-center">
			<Animated.View style={{ transform: [{ rotate: spin }] }}>
				<MaterialIcons name="explore" size={32} color="#dc2626" />
			</Animated.View>
		</TouchableOpacity>
	)
}
