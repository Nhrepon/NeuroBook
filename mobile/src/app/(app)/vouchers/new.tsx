import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { api } from '@/api/client'
import { queueOperation } from '@/sync/queue'
import { db, initSchema } from '@/sync/db'
import NetInfo from '@react-native-community/netinfo'
import { VoucherDraftSchema, ulidLike } from '@neurobook/shared'
import {
  VOUCHER_TYPE_ORDER,
  voucherTypeSpec,
  validateVoucherShape,
} from '@neurobook/shared/ledger'
import type { VoucherType } from '@neurobook/shared'

interface Entry { accountId: string; accountType: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE'; debit: number; credit: number }

export default function NewVoucherScreen() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [narration, setNarration] = useState('')
  // §5.3: every registered type, not the three this screen used to hardcode.
  // The list comes from the shared registry so the phone cannot drift from the
  // server - a type added there and not here would simply be unreachable.
  const [voucherType, setVoucherType] = useState<VoucherType>('JOURNAL')
  const [entries, setEntries] = useState<Entry[]>([
    { accountId: '', accountType: 'ASSET', debit: 0, credit: 0 },
    { accountId: '', accountType: 'ASSET', debit: 0, credit: 0 },
  ])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setError(null)
    const parsed = VoucherDraftSchema.safeParse({ date, narration, voucherType, entries })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input')
      return
    }

    // §5.3 structural rules run offline too. The point of the offline queue is
    // that the accountant finds out now, on the phone, rather than after the
    // draft has synced and failed - by which point they have moved on.
    const shapeProblems = validateVoucherShape({
      type: parsed.data.voucherType,
      entries: parsed.data.entries,
    })
    if (shapeProblems.length > 0) {
      setError(shapeProblems.join(' '))
      return
    }

    setPending(true)
    const net = await NetInfo.fetch()
    const clientId = ulidLike()

    // Optimistic write — UI shows the draft immediately; server row lands
    // only after sync. The queue item id is the same clientId.
    await initSchema()
    await db.runAsync(
      `INSERT INTO vouchers_drafts (id, voucher_type, date, narration, total_debit, total_credit, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [
        clientId,
        parsed.data.voucherType,
        parsed.data.date,
        parsed.data.narration,
        parsed.data.entries.reduce((s, e) => s + e.debit, 0),
        parsed.data.entries.reduce((s, e) => s + e.credit, 0),
        Date.now(),
      ],
    )

    if (!net.isConnected) {
      // Offline → queue as draft (R6 idempotency key = clientId).
      await queueOperation({
        id: clientId,
        operation: 'CREATE',
        resource: 'voucher',
        payload: parsed.data,
      })
      setPending(false)
      router.back()
      return
    }

    try {
      await api.post('/api/v1/vouchers', parsed.data, {
        headers: { 'Idempotency-Key': clientId },
      })
      // Online success — mark the draft row synced now.
      await db.runAsync(
        `UPDATE vouchers_drafts SET status = 'synced' WHERE id = ?`,
        [clientId],
      )
      router.back()
    } catch (e: any) {
      // Online failure — keep it queued so the next sync can finish it.
      await queueOperation({
        id: clientId,
        operation: 'CREATE',
        resource: 'voucher',
        payload: parsed.data,
      })
      setError(e?.response?.data?.error?.message ?? 'Failed to save. Queued for sync.')
      setPending(false)
      router.back()
    } finally {
      setPending(false)
    }
  }

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-lg font-semibold">New voucher</Text>

      <Text className="mt-4 text-sm text-gray-500">Date</Text>
      <TextInput value={date} onChangeText={setDate} className="rounded border border-gray-300 px-3 py-2" />

      <Text className="mt-3 text-sm text-gray-500">Type</Text>
      {/* Wraps rather than one long row: twelve types will not fit the width of
          a phone, and a horizontal scroll here hides types from the accountant
          who has not scrolled far enough to know they exist. */}
      <View className="mt-1 flex-row flex-wrap gap-2">
        {VOUCHER_TYPE_ORDER.map((t) => (
          <Pressable
            key={t}
            onPress={() => setVoucherType(t)}
            className={`rounded border px-3 py-1.5 ${voucherType === t ? 'border-black bg-black' : 'border-gray-300'}`}
          >
            <Text className={voucherType === t ? 'text-white' : 'text-gray-800'}>
              {voucherTypeSpec(t).label}
            </Text>
          </Pressable>
        ))}
      </View>
      {/* Same rule string the web form shows, so a voucher typed on the phone
          means the same thing as the same voucher typed on the desktop. */}
      <Text className="mt-2 text-xs text-gray-500">{voucherTypeSpec(voucherType).rule}</Text>

      <Text className="mt-3 text-sm text-gray-500">Narration</Text>
      <TextInput value={narration} onChangeText={setNarration} className="rounded border border-gray-300 px-3 py-2" />

      <Text className="mt-4 text-sm font-semibold">Journal lines</Text>
      {entries.map((e, i) => (
        <View key={i} className="mt-2 flex-row gap-2">
          <TextInput
            placeholder="Account ID"
            value={e.accountId}
            onChangeText={(v) => setEntries((p) => p.map((x, j) => j === i ? { ...x, accountId: v } : x))}
            className="flex-1 rounded border border-gray-300 px-2 py-1"
          />
          <TextInput
            placeholder="Debit"
            keyboardType="numeric"
            value={e.debit ? String(e.debit / 100) : ''}
            onChangeText={(v) => setEntries((p) => p.map((x, j) => j === i ? { ...x, debit: Math.round(Number(v || 0) * 100) } : x))}
            className="w-20 rounded border border-gray-300 px-2 py-1"
          />
          <TextInput
            placeholder="Credit"
            keyboardType="numeric"
            value={e.credit ? String(e.credit / 100) : ''}
            onChangeText={(v) => setEntries((p) => p.map((x, j) => j === i ? { ...x, credit: Math.round(Number(v || 0) * 100) } : x))}
            className="w-20 rounded border border-gray-300 px-2 py-1"
          />
        </View>
      ))}

      {error && <Text className="mt-3 text-sm text-red-600">{error}</Text>}

      <Pressable
        onPress={save}
        disabled={pending}
        className="mt-6 rounded bg-black py-3 active:opacity-80"
      >
        {pending ? <ActivityIndicator color="#fff" /> : <Text className="text-center text-white">Save draft</Text>}
      </Pressable>
    </ScrollView>
  )
}
