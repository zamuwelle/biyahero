import { useRef } from 'react'
import { Pressable, Animated } from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useStore } from '../services/store'

export const CompassButton = ({ bottom = 32 }) => {
	const rotateAnim = useRef(new Animated.Value(0)).current
	const recenter = useStore(s => s.recenter)

	const handlePress = () => {
		rotateAnim.setValue(0)
		Animated.timing(rotateAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
		recenter(500)
	}

	return (
		<Pressable
			onPress={handlePress}
			style={{ bottom }}
			className="absolute right-4 p-2 rounded-2xl bg-white shadow-lg items-center justify-center active:scale-95"
		>
			<Animated.View style={{ transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
				<MaterialIcons name="explore" size={32} color="#dc2626" />
			</Animated.View>
		</Pressable>
	)
}
