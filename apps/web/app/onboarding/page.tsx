'use client';

import { useState } from 'react';
import { completeOnboarding, skipOnboarding } from '@/lib/actions/onboarding';

const WALLET_TYPES = [
  'cash',
  'debit',
  'credit_card',
  'savings',
  'investment',
  'crypto',
] as const;

const WALLET_TYPE_LABELS: Record<string, string> = {
  cash: '💵 Cash',
  debit: '🏦 Debit',
  credit_card: '💳 Credit Card',
  savings: '🏧 Savings',
  investment: '📈 Investment',
  crypto: '₿ Crypto',
};

type WalletType = (typeof WALLET_TYPES)[number];

interface WalletEntry {
  name: string;
  type: WalletType;
  currency: string;
  opening_balance: number;
  credit_limit?: number | null;
}

const defaultForm = (): {
  name: string;
  type: WalletType;
  currency: string;
  opening_balance: string;
  credit_limit: string;
} => ({
  name: '',
  type: 'cash',
  currency: 'PLN',
  opening_balance: '0',
  credit_limit: '',
});

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [wallets, setWallets] = useState<WalletEntry[]>([]);
  const [form, setForm] = useState(defaultForm());

  function handleAddWallet() {
    const entry: WalletEntry = {
      name: form.name.trim(),
      type: form.type,
      currency: form.currency.trim() || 'PLN',
      opening_balance: parseFloat(form.opening_balance) || 0,
    };
    if (form.type === 'credit_card') {
      entry.credit_limit = parseFloat(form.credit_limit) || null;
    }
    setWallets((prev) => [...prev, entry]);
    setForm(defaultForm());
  }

  function handleRemoveWallet(index: number) {
    setWallets((prev) => prev.filter((_, i) => i !== index));
  }

  if (step === 1) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md mx-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-3">Let&apos;s set up your accounts</h1>
        <p className="text-gray-500 mb-6">
          Add your bank accounts, wallets, and cards so we can track your finances in one place.
          You can always add more later.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setStep(2)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
          >
            Get started
          </button>
          <form action={skipOnboarding}>
            <button
              type="submit"
              className="w-full text-gray-500 hover:text-gray-700 py-2.5 text-sm transition-colors"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-lg mx-4">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Add your accounts</h1>
        <p className="text-gray-500 mb-6 text-sm">Fill in the details and click &quot;Add wallet&quot; for each account.</p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as WalletType, credit_limit: '' }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {WALLET_TYPES.map((t) => (
                <option key={t} value={t}>{WALLET_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Main Checking"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input
                type="text"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                maxLength={3}
                placeholder="PLN"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Opening balance</label>
              <input
                type="number"
                value={form.opening_balance}
                onChange={(e) => setForm((f) => ({ ...f, opening_balance: e.target.value }))}
                step="0.01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {form.type === 'credit_card' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit limit</label>
              <input
                type="number"
                value={form.credit_limit}
                onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                step="0.01"
                min="0"
                placeholder="e.g. 5000"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleAddWallet}
          disabled={!form.name.trim()}
          className="w-full border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          + Add wallet
        </button>

        {wallets.length > 0 && (
          <ul className="mb-4 space-y-2">
            {wallets.map((w, i) => (
              <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <span>
                  <span className="mr-1">{WALLET_TYPE_LABELS[w.type]?.split(' ')[0]}</span>
                  <span className="font-medium">{w.name}</span>
                  <span className="text-gray-400 ml-1">({w.currency})</span>
                </span>
                <button
                  onClick={() => handleRemoveWallet(i)}
                  className="text-red-400 hover:text-red-600 ml-2 text-xs"
                  aria-label="Remove wallet"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2">
          <button
            onClick={() => setStep(3)}
            disabled={wallets.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
          <form action={skipOnboarding}>
            <button
              type="submit"
              className="w-full text-gray-500 hover:text-gray-700 py-2 text-sm transition-colors"
            >
              Skip for now
            </button>
          </form>
        </div>
      </div>
    );
  }

  // step === 3
  return (
    <div className="bg-white rounded-2xl shadow-sm p-8 w-full max-w-md mx-4">
      <h1 className="text-2xl font-semibold text-gray-900 mb-3">You&apos;re all set!</h1>
      <p className="text-gray-500 mb-5 text-sm">Here&apos;s a summary of the accounts you added:</p>

      <ul className="mb-6 space-y-2">
        {wallets.map((w, i) => (
          <li key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <span>
              <span className="mr-1">{WALLET_TYPE_LABELS[w.type]?.split(' ')[0]}</span>
              <span className="font-medium">{w.name}</span>
            </span>
            <span className="text-gray-400">{w.opening_balance.toFixed(2)} {w.currency}</span>
          </li>
        ))}
      </ul>

      <form action={() => completeOnboarding(JSON.stringify(wallets))}>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
        >
          Go to dashboard
        </button>
      </form>
    </div>
  );
}
