import { formatSignedTaka } from "@neurobook/shared";

/**
 * The dashboard's summary cards. Numbers are placeholder until the report
 * queries land; the point of this page is that the shell renders and the
 * formatter is wired, so a real query drops in behind the same component.
 */
const SUMMARY = [
  { label: "Receivable", minor: 1_20_000_00 },
  { label: "Payable", minor: -80_000_00 },
  { label: "Cash & Bank", minor: 5_50_000_00 },
  { label: "Profit (FY)", minor: 2_30_000_00 },
] as const;

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          gap: "1rem",
          marginTop: "1rem",
        }}
      >
        {SUMMARY.map((card) => (
          <div key={card.label} style={{ border: "1px solid CanvasText", padding: "1rem" }}>
            <div style={{ fontSize: "0.8rem", opacity: 0.7 }}>{card.label}</div>
            <div style={{ fontSize: "1.4rem", fontVariantNumeric: "tabular-nums" }}>
              {formatSignedTaka(card.minor)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
