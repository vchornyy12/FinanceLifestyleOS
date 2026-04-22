import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActionSheetIOS,
  Alert,
  Platform,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { useMonthlyMetrics } from '@/hooks/useMonthlyMetrics'

const ACTION_OPTIONS = ['Take Photo', 'Upload from Gallery', 'Upload Receipt Screenshot', 'Cancel']
const CANCEL_INDEX = 3

function currentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPLN(value: number): string {
  return `${value.toFixed(2)} PLN`
}

export default function HomeScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const { metrics, loading } = useMonthlyMetrics(user?.id ?? '', currentYearMonth())

  const savingsRate =
    metrics.income > 0
      ? `${(((metrics.income - metrics.expense) / metrics.income) * 100).toFixed(0)}%`
      : '—'

  const handleAddAction = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ACTION_OPTIONS, cancelButtonIndex: CANCEL_INDEX },
        (buttonIndex) => {
          if (buttonIndex === 0) router.push('/(camera)/capture?mode=camera')
          else if (buttonIndex === 1) router.push('/(camera)/capture?mode=gallery')
          else if (buttonIndex === 2) router.push('/(camera)/capture?mode=screenshot')
        },
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Finance Lifestyle OS</Text>
        <Text style={styles.subtitle}>This month</Text>

        <View style={styles.cards}>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Income</Text>
            <Text style={[styles.cardValue, styles.incomeValue]}>
              {loading ? '—' : formatPLN(metrics.income)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Expenses</Text>
            <Text style={[styles.cardValue, styles.expenseValue]}>
              {loading ? '—' : formatPLN(metrics.expense)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Net</Text>
            <Text
              style={[
                styles.cardValue,
                metrics.net >= 0 ? styles.incomeValue : styles.expenseValue,
              ]}
            >
              {loading ? '—' : formatPLN(metrics.net)}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Savings rate</Text>
            <Text style={styles.cardValue}>{loading ? '—' : savingsRate}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.manualButton}
          onPress={() => router.push('/transactions/new')}
          activeOpacity={0.85}
        >
          <Text style={styles.manualButtonText}>+ Add manual transaction</Text>
        </TouchableOpacity>
      </ScrollView>

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
    backgroundColor: '#f9fafb',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 4,
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardLabel: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 6,
    color: '#111827',
  },
  incomeValue: {
    color: '#059669',
  },
  expenseValue: {
    color: '#dc2626',
  },
  manualButton: {
    marginTop: 24,
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
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
