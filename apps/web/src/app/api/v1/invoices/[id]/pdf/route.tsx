import { NextRequest } from 'next/server'
import { invoiceLines, invoices, parties } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { and, eq } from 'drizzle-orm'
import { formatTaka } from '@neurobook/shared'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: '#111827' },
  title: { fontSize: 14, marginBottom: 4, textAlign: 'center', fontWeight: 'bold' },
  subtitle: { fontSize: 9, marginBottom: 16, textAlign: 'center', color: '#6b7280' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  metaLabel: { color: '#6b7280' },
  headRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', paddingBottom: 4, marginTop: 16, color: '#6b7280' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingVertical: 5 },
  colItem: { width: '44%' },
  colQty: { width: '12%', textAlign: 'right' },
  colPrice: { width: '16%', textAlign: 'right' },
  colVat: { width: '12%', textAlign: 'right' },
  colTotal: { width: '16%', textAlign: 'right' },
  totals: { marginTop: 12, alignSelf: 'flex-end', width: '45%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderTopWidth: 1, borderTopColor: '#d1d5db', fontWeight: 'bold' },
  footer: { marginTop: 24, fontSize: 8, color: '#9ca3af', textAlign: 'center' },
})

const money = (minor: number) => formatTaka(minor).replace('৳', 'BDT ')

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const scope = await requireScope()

  const data = await withTenant(scope.tenantId, async (tx) => {
    const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.tenantId, scope.tenantId)))
    if (!invoice) return null
    let customer: typeof parties.$inferSelect | null = null
    if (invoice.customerId) {
      const [c] = await tx.select().from(parties).where(eq(parties.id, invoice.customerId))
      customer = c ?? null
    }
    const lines = await tx.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id))
    return { invoice, customer, lines }
  })

  if (!data) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
  const { invoice, customer, lines } = data

  const taxable = invoice.total - invoice.vat

  const doc = (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>MUSHAK 6.2 — TAX INVOICE</Text>
        <Text style={styles.subtitle}>Issued under the Value Added Tax and Supplementary Duty Act, 2012</Text>

        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Invoice number</Text>
          <Text>{invoice.number ?? invoice.id.slice(0, 8)}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Date</Text>
          <Text>{new Date(invoice.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.metaLabel}>Buyer</Text>
          <Text>{customer?.name ?? '—'}</Text>
        </View>
        {customer?.address ? (
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Address</Text>
            <Text>{customer.address}</Text>
          </View>
        ) : null}

        <View style={styles.headRow}>
          <Text style={styles.colItem}>Description</Text>
          <Text style={styles.colQty}>Qty</Text>
          <Text style={styles.colPrice}>Unit price</Text>
          <Text style={styles.colVat}>VAT</Text>
          <Text style={styles.colTotal}>Amount</Text>
        </View>

        {lines.length === 0 ? (
          <View style={styles.row}>
            <Text style={styles.colItem}>Taxable supply</Text>
            <Text style={styles.colQty}>—</Text>
            <Text style={styles.colPrice}>—</Text>
            <Text style={styles.colVat}>—</Text>
            <Text style={styles.colTotal}>{money(invoice.total)}</Text>
          </View>
        ) : (
          lines.map((l) => (
            <View key={l.id} style={styles.row}>
              <Text style={styles.colItem}>{l.description}</Text>
              <Text style={styles.colQty}>{l.quantity}</Text>
              <Text style={styles.colPrice}>{money(l.unitPrice)}</Text>
              <Text style={styles.colVat}>{(l.vatRate / 100).toFixed(2)}%</Text>
              <Text style={styles.colTotal}>{money(l.total)}</Text>
            </View>
          ))
        )}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>Taxable value</Text>
            <Text>{money(taxable)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.metaLabel}>VAT</Text>
            <Text>{money(invoice.vat)}</Text>
          </View>
          <View style={styles.grand}>
            <Text>Total</Text>
            <Text>{money(invoice.total)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>This is a computer generated document.</Text>
      </Page>
    </Document>
  )

  const buffer = await renderToBuffer(doc)
  return new Response(buffer as any, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice-${invoice.number ?? invoice.id}.pdf"`,
    },
  })
}
