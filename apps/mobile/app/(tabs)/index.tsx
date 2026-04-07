import { View, Text, TouchableOpacity, StyleSheet, ActionSheetIOS, Alert, Platform } from 'react-native'
import { useRouter } from 'expo-router'

const ACTION_OPTIONS = ['Take Photo', 'Upload from Gallery', 'Upload Receipt Screenshot', 'Cancel']
const CANCEL_INDEX = 3

export default function HomeScreen() {
  const router = useRouter()

  const handleAddAction = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ACTION_OPTIONS, cancelButtonIndex: CANCEL_INDEX },
        (buttonIndex) => {
          if (buttonIndex === 0) router.push('/(camera)/capture?mode=camera')
          else if (buttonIndex === 1) router.push('/(camera)/capture?mode=gallery')
          else if (buttonIndex === 2) router.push('/(camera)/capture?mode=screenshot')
        }
      )
    } else {
      Alert.alert('Add Receipt', 'Choose an option', [
        { text: ACTION_OPTIONS[0], onPress: () => router.push('/(camera)/capture?mode=camera') },
        { text: ACTION_OPTIONS[1], onPress: () => router.push('/(camera)/capture?mode=gallery') },
        { text: ACTION_OPTIONS[2], onPress: () => router.push('/(camera)/capture?mode=screenshot') },
        { text: ACTION_OPTIONS[3], style: 'cancel' },
      ])
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Finance Lifestyle OS</Text>
      <Text style={styles.subtitle}>Home</Text>

      {/* Receipt FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleAddAction}
        accessibilityLabel="Add receipt"
        accessibilityRole="button"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '400',
    lineHeight: 32,
  },
})
