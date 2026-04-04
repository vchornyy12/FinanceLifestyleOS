import React from 'react'
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useReceiptPipeline } from '@/hooks/useReceiptPipeline'

export default function PreviewScreen() {
  const { photoUri } = useLocalSearchParams<{ photoUri: string }>()
  const router = useRouter()
  const { run, processing } = useReceiptPipeline()

  async function handleUsePhoto() {
    if (processing) return
    if (!photoUri) {
      Alert.alert('No photo', 'No photo URI found.')
      return
    }
    await run(photoUri)
  }

  function handleRetake() {
    router.back()
  }

  if (processing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Processing receipt…</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="contain" />
      ) : (
        <View style={styles.noPhotoContainer}>
          <Text style={styles.noPhotoText}>No photo to display</Text>
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
          <Text style={styles.retakeButtonText}>Retake</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.useButton} onPress={handleUsePhoto}>
          <Text style={styles.useButtonText}>Use Photo</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  photo: {
    flex: 1,
    width: '100%',
  },
  noPhotoContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {
    color: '#9ca3af',
    fontSize: 16,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
    backgroundColor: '#000',
  },
  retakeButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#fff',
    alignItems: 'center',
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  useButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  useButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#374151',
  },
})
