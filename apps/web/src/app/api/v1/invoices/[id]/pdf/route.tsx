import { NextRequest } from 'next/server'
import { invoices, parties } from '@/db/schema'
import { requireScope } from '@/db/scope'
import { withTenant } from '@/db/tenant'
import { and, eq } from 'drizzle-orm'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 12 },
  title: { fontSize: 16, marginBottom: 12, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
})

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
    return { invoice, customer }
  })

  if (!data) return Response.json({ error: { code: 'NOT_FOUND', message: 'not found' } }, { status: 404 })
  const { invoice, customer } = data

  const doc = (
    <Document>
      <Page style={styles.page}>
        <Text style={styles.title}>MUSHAK 6.2 - TAX INVOICE</Text>
        <View style={styles.row}><Text>Invoice #:</Text><Text>{invoice.number ?? invoice.id}</Text></View>
        <View style={styles.row}><Text>Date:</Text><Text>{new Date(invoice.date).toLocaleDateString()}</Text></View>
        <View style={styles.row}><Text>Customer:</Text><Text>{customer?.name ?? '-'}</Text></View>
        <View style={styles.row}><Text>Total:</Text><Text>{invoice.total}</Text></View>
        <View style={styles.row}><Text>VAT:</Text><Text>{invoice.vat}</Text></View>
        <Text style={{ marginTop: 12 }}>This is a computer generated document.</Text>
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
