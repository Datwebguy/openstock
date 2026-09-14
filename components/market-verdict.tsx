import type { MarketVerdict } from "@/lib/market-verdict";

export function MarketVerdictCard({ verdict }: { verdict: MarketVerdict }) {
  return (
    <section className={`market-verdict market-verdict--${verdict.tone}`} aria-label="OpenStock market verdict">
      <div className="market-verdict__top">
        <span className="market-verdict__signal"><i aria-hidden="true" />{verdict.label}</span>
        <span className="market-verdict__action">{verdict.action}</span>
      </div>
      <h2>{verdict.headline}</h2>
      <p>{verdict.copy}</p>
      <div className="market-verdict__checks">
        {verdict.checks.map((check) => (
          <div className={`market-verdict__check market-verdict__check--${check.tone}`} key={check.label}>
            <span>{check.label}</span>
            <strong>{check.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
