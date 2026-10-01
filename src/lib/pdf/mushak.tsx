// Mushak 6.2 sales invoice PDF (NBR layout) via @react-pdf/renderer.
// Renders the invoice head (BIN/TIN, date, FY), line table with VAT/SD
// split, totals, and a footer. Returns a PDF Buffer.
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
  Font,
} from '@react-pdf/renderer'
import type { InvoiceRow } from '@/db/repo/invoices'

// Register a TTF with Bengali glyphs for the invoice text.
Font.register({
  family: 'Noto',
  fonts: [
    { src: '/fonts/NotoSansBengali-Regular.ttf', fontStyle: 'normal' },
  ],
})

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Noto',
    fontSize: 9,
    color: '#111',
  },
  head: {
    borderBottom: '1px solid #999',
    paddingBottom: 8,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
  },
  table: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    borderBottom: '0.5px solid #ddd',
    paddingVertical: 3,
  },
  rowHead: {
    flexDirection: 'row',
    borderBottom: '1px solid #333',
    paddingVertical: 3,
    fontWeight: 'bold',
  },
  c: { width: '16%' },
  cDesc: { width: '34%' },
  cNum: { width: '10%', textAlign: 'right' },
  cMoney: { width: '12%', textAlign: 'right' },
  totals: {
    marginTop: 8,
    marginLeft: '50%',
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  totalLabel: { width: '40%' },
  totalValue: { width: '60%', textAlign: 'right', fontWeight: 'bold' },
  foot: {
    marginTop: 24,
    fontSize: 7,
    color: '#555',
  },
})

function taka(minor: number): string {
  return `৳ ${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
}

export async function renderMushak62Pdf(
  invoice: InvoiceRow,
  company: { name: string; bin?: string | null; tin?: string | null; address?: string | null },
): Promise<Uint8Array> {
  const payload = invoice.payload as {
    lines: Array<{
      description: string
      quantity: number
      unitPrice: number
      vatRate: number
      sdRate: number
      lineTotalMinor: number
      vatMinor: number
      sdMinor: number
    }>
    totals: { vatMinor: number; sdMinor: number; grandTotalMinor: number; subtotalMinor: number }
  }

  const lines = payload.lines
  const t = payload.totals

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.head}>
          <Text style={styles.title}>MUSHAK 6.2 — TAX INVOICE</Text>
          <View style={styles.metaRow}>
            <Text>{company.name}</Text>
            <Text>{'BIN: ' + (company.bin ?? '—')}</Text>
            <Text>{'TIN: ' + (company.tin ?? '—')}</Text>
            <Text>{new Date(invoice.date.toISOString()).toLocaleDateString('en-GB')}</Text>
          </View>
          {company.address && <Text style={{ fontSize: 7 }}>{company.address}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={styles.c}>SL</Text>
            <Text style={styles.cDesc}>Description</Text>
            <Text style={styles.cNum}>Qty</Text>
            <Text style={styles.cMoney}>Rate</Text>
            <Text style={styles.cMoney}>Amount</Text>
            <Text style={styles.cMoney}>VAT</Text>
            <Text style={styles.cMoney}>SD</Text>
          </View>
          {lines.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.c}>{i + 1}</Text>
              <Text style={styles.cDesc}>{l.description}</Text>
              <Text style={styles.cNum}>{l.quantity}</Text>
              <Text style={styles.cMoney}>{taka(l.unitPrice * 100)}</Text>
              <Text style={styles.cMoney}>{taka(l.lineTotalMinor)}</Text>
              <Text style={styles.cMoney}>{taka(l.vatMinor)}</Text>
              <Text style={styles.cMoney}>{taka(l.sdMinor)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{taka(t.subtotalMinor)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>VAT</Text>
            <Text style={styles.totalValue}>{taka(t.vatMinor)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Supplementary Duty</Text>
            <Text style={styles.totalValue}>{taka(t.sdMinor)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>{taka(t.grandTotalMinor)}</Text>
          </View>
        </View>

        <Text style={styles.foot}>
          This is a computer generated document. NBR Mushak 6.2 format.
        </Text>
      </Page>
    </Document>
  )

  const buf = await renderToBuffer(doc)
  return new Uint8Array(buf)
}
