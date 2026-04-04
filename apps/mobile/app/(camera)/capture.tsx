import React, { useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import { useRouter } from 'expo-router'
import { useReceiptPipeline } from '@/hooks/useReceiptPipeline'

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const router = useRouter()
  const { run, processing } = useReceiptPipeline()

  // --- Permission states ---
  if (!permission) {
    return <View style={styles.container} />
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionText}>
          We need camera access to capture receipts.
        </Text>
        <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
          <Text style={styles.grantButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // --- Gallery pick → direct upload + parse flow ---
  async function handleGalleryPick() {
    if (processing) return
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    })
    if (result.canceled || !result.assets[0]) return

    await run(result.assets[0].uri)
  }

  // --- Shutter: capture then navigate to preview ---
  async function handleCapture() {
    if (processing) return
    if (!cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 })
      if (!photo?.uri) return
      router.push({
        pathname: '/(camera)/preview',
        params: { photoUri: photo.uri },
      })
    } catch (err) {
      Alert.alert('Capture Failed', 'Could not take photo. Please try again.')
    }
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
      <CameraView ref={cameraRef} style={styles.camera} facing="back">
        {/* Close button — top right */}
        <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>

        {/* Bottom controls */}
        <View style={styles.controls}>
          {/* Gallery picker — bottom left */}
          <TouchableOpacity style={styles.galleryButton} onPress={handleGalleryPick}>
            <Text style={styles.galleryButtonText}>Gallery</Text>
          </TouchableOpacity>

          {/* Shutter button — bottom center */}
          <TouchableOpacity style={styles.shutterButton} onPress={handleCapture}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          {/* Spacer for symmetry */}
          <View style={styles.galleryButton} />
        </View>
      </CameraView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
  },
  shutterButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
  galleryButton: {
    width: 64,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#111827',
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  grantButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 12,
  },
  grantButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#6b7280',
    fontSize: 15,
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
