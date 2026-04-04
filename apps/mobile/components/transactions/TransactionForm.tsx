import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useCategories } from '@/hooks/useCategories'

export interface TransactionFormData {
  amount: string
  merchant: string
  categoryId: string | null
  date: string
  note: string
}

interface Props {
  onSave: (data: TransactionFormData) => Promise<void>
  saving: boolean
}

export function TransactionForm({ onSave, saving }: Props) {
  const { categories, loading: categoriesLoading } = useCategories()
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [note, setNote] = useState('')
  const [categoryModalVisible, setCategoryModalVisible] = useState(false)
  const [errors, setErrors] = useState<{ amount?: string; merchant?: string }>({})

  const selectedCategory = categories.find((c) => c.id === categoryId)

  function getISODate(d: Date): string {
    return d.toISOString().split('T')[0]
  }

  function validate(): boolean {
    const newErrors: typeof errors = {}
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) {
      newErrors.amount = 'Amount must be a positive number'
    }
    if (!merchant.trim()) {
      newErrors.merchant = 'Merchant is required'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    await onSave({
      amount,
      merchant: merchant.trim(),
      categoryId,
      date: getISODate(date),
      note: note.trim(),
    })
  }

  function handleDateChange(event: DateTimePickerEvent, selectedDate?: Date) {
    if (Platform.OS === 'android') {
      setShowDatePicker(false)
    }
    if (selectedDate) {
      setDate(selectedDate)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.flex} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Amount */}
        <Text style={styles.label}>Amount *</Text>
        <TextInput
          style={[styles.input, errors.amount ? styles.inputError : null]}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
          returnKeyType="done"
        />
        {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}

        {/* Merchant */}
        <Text style={styles.label}>Merchant *</Text>
        <TextInput
          style={[styles.input, errors.merchant ? styles.inputError : null]}
          value={merchant}
          onChangeText={setMerchant}
          placeholder="e.g. Tesco"
          autoCapitalize="words"
          returnKeyType="done"
        />
        {errors.merchant ? <Text style={styles.errorText}>{errors.merchant}</Text> : null}

        {/* Category */}
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setCategoryModalVisible(true)}
          activeOpacity={0.7}
        >
          {categoriesLoading ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text style={selectedCategory ? styles.pickerText : styles.pickerPlaceholder}>
              {selectedCategory ? selectedCategory.name : 'Select a category'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Date */}
        <Text style={styles.label}>Date *</Text>
        <TouchableOpacity
          style={styles.input}
          onPress={() => setShowDatePicker(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerText}>{date.toLocaleDateString('pl-PL')}</Text>
        </TouchableOpacity>

        {/* Android: inline picker shown as modal automatically */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* iOS: wrap in a Modal with spinner display */}
        {Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.datePickerModal}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <Text style={styles.modalClose}>Done</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Note */}
        <Text style={styles.label}>Note (optional)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note..."
          multiline
          numberOfLines={3}
          returnKeyType="done"
          blurOnSubmit
        />

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving ? styles.saveButtonDisabled : null]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Transaction</Text>
          )}
        </TouchableOpacity>

        {/* Category Modal */}
        <Modal
          visible={categoryModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCategoryModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setCategoryModalVisible(false)}>
                  <Text style={styles.modalClose}>Done</Text>
                </TouchableOpacity>
              </View>

              {/* None option */}
              <TouchableOpacity
                style={[styles.categoryItem, categoryId === null ? styles.categoryItemSelected : null]}
                onPress={() => {
                  setCategoryId(null)
                  setCategoryModalVisible(false)
                }}
              >
                <Text style={[styles.categoryItemText, categoryId === null ? styles.categoryItemTextSelected : null]}>
                  None
                </Text>
              </TouchableOpacity>

              <FlatList
                data={categories}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.categoryItem, categoryId === item.id ? styles.categoryItemSelected : null]}
                    onPress={() => {
                      setCategoryId(item.id)
                      setCategoryModalVisible(false)
                    }}
                  >
                    <Text style={[styles.categoryItemText, categoryId === item.id ? styles.categoryItemTextSelected : null]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No categories found</Text>
                }
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#fff',
    justifyContent: 'center',
    minHeight: 44,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  noteInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  pickerText: {
    fontSize: 16,
    color: '#111827',
  },
  pickerPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 4,
  },
  saveButton: {
    marginTop: 32,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    paddingBottom: 34,
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: '600',
  },
  categoryItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  categoryItemSelected: {
    backgroundColor: '#eff6ff',
  },
  categoryItemText: {
    fontSize: 16,
    color: '#111827',
  },
  categoryItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  emptyText: {
    padding: 20,
    textAlign: 'center',
    color: '#6b7280',
  },
})
