type AudiencePulse = {
  follows: number;
  wouldWatch: number;
  wouldPay: number;
  bringToCity: number;
  backNextChapter: number;
};

type Props = {
  counts: AudiencePulse;
};

const compactNumber = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const signals: Array<{ key: keyof AudiencePulse; label: string }> = [
  { key: "follows", label: "Follow" },
  { key: "wouldWatch", label: "Watch" },
  { key: "wouldPay", label: "Pay" },
  { key: "bringToCity", label: "My city" },
  { key: "backNextChapter", label: "Back" },
];

export function AudiencePulseStrip({ counts }: Props) {
  return (
    <section className="wall-audience-pulse" aria-label="Audience Pulse organic participation signals">
      <header>
        <span>Audience Pulse</span>
        <small>Organic signals</small>
      </header>
      <dl>
        {signals.map(({ key, label }) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd aria-label={`${label}: ${counts[key].toLocaleString("en-US")}`}>
              {compactNumber.format(counts[key])}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
