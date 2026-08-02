"use client";

import { useEffect, useState } from "react";
import type { PipelineResult, ScoredName } from "@/pipeline/types";
import styles from "./PipelineApp.module.css";

function brandAvg(row: ScoredName): number {
  return Math.round(
    (row.scores.memorability +
      row.scores.investorAppeal +
      row.scores.logoPotential +
      row.scores.scandinavianDna) /
      4,
  );
}

function Mark({
  ok,
  unchecked,
}: {
  ok: boolean;
  unchecked?: boolean;
}) {
  if (unchecked) return <span className={styles.markMuted}>—</span>;
  return (
    <span className={ok ? styles.markOk : styles.markWarn}>{ok ? "✓" : "!"}</span>
  );
}

export function PipelineApp() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState(5000);
  const [skipExternal, setSkipExternal] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/runs/latest")
      .then(async (r) => {
        if (!r.ok) return;
        setResult(await r.json());
      })
      .catch(() => undefined);
  }, []);

  async function run() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateCount: candidates,
          externalLimit: Math.min(candidates, skipExternal ? candidates : 200),
          skipExternal,
          topN: 50,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Pipeline failed";
        throw new Error(msg);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pipeline failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Project #3 · workflow automation</p>
        <h1 className={styles.brand}>AutoNameSearch</h1>
        <p className={styles.lede}>
          A venture-grade naming pipeline — designed phonetics, domain and trademark
          screens, company collision checks, brand scoring. Built the same way as
          Scope2Plan and PartnerForge.
        </p>
        <div className={styles.ctaRow}>
          <button className={styles.primary} onClick={run} disabled={pending}>
            {pending ? "Running pipeline…" : "Run pipeline"}
          </button>
          <label className={styles.control}>
            <span>Candidates</span>
            <select
              value={candidates}
              onChange={(e) => setCandidates(Number(e.target.value))}
              disabled={pending}
            >
              <option value={2000}>2,000</option>
              <option value={5000}>5,000</option>
              <option value={20000}>20,000</option>
              <option value={50000}>50,000</option>
            </select>
          </label>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={skipExternal}
              onChange={(e) => setSkipExternal(e.target.checked)}
              disabled={pending}
            />
            Demo mode (skip live APIs)
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </header>

      <section className={styles.funnel} aria-label="Pipeline stages">
        <h2>The funnel</h2>
        <ol className={styles.steps}>
          {[
            ["Generate", "50k weighted phonetic candidates"],
            ["Filter", "Length, sound, spelling"],
            ["Domains", ".com · .ai · .io"],
            ["Trademarks", "EUIPO · USPTO · WIPO"],
            ["Companies", "Crunchbase · GitHub · LinkedIn"],
            ["Score", "Enterprise · Scandi · Investor · Logo"],
          ].map(([title, body], i) => (
            <li key={title} style={{ animationDelay: `${0.05 * i}s` }}>
              <strong>{title}</strong>
              <span>{body}</span>
            </li>
          ))}
        </ol>
      </section>

      {result ? (
        <>
          <section className={styles.stats} aria-label="Run statistics">
            <h2>Last run</h2>
            <p className={styles.runMeta}>
              <span>{result.runId}</span>
              <span>{new Date(result.createdAt).toLocaleString()}</span>
            </p>
            <div className={styles.bars}>
              {result.stages.map((s) => {
                const max = result.stages[0]?.input || 1;
                const pct = Math.max(4, Math.round((s.output / max) * 100));
                return (
                  <div key={s.name} className={styles.barRow}>
                    <div className={styles.barLabel}>
                      <span>{s.name}</span>
                      <span>
                        {s.output.toLocaleString()}
                        <em> / {s.input.toLocaleString()}</em>
                      </span>
                    </div>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ ["--w" as string]: `${pct}%`, width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.results} aria-label="Ranked shortlist">
            <h2>Shortlist</h2>
            <div className={styles.tableWrap}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Name</th>
                    <th>Domain</th>
                    <th>TM</th>
                    <th>Ent</th>
                    <th>Brand</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.shortlist.map((row, i) => {
                    const domainUnchecked = row.domains.every(
                      (d) => d.status === "unchecked",
                    );
                    const tmUnchecked = row.trademarks.status === "unchecked";
                    return (
                      <tr key={row.name}>
                        <td>{i + 1}</td>
                        <td className={styles.nameCell}>{row.name}</td>
                        <td>
                          <Mark ok={row.domainOk} unchecked={domainUnchecked} />
                        </td>
                        <td>
                          <Mark ok={row.trademarkOk} unchecked={tmUnchecked} />
                        </td>
                        <td>{row.scores.enterpriseFeel}</td>
                        <td>{brandAvg(row)}</td>
                        <td className={styles.total}>{row.total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className={styles.empty}>
          <p>No run yet. Launch the pipeline to generate a ranked shortlist.</p>
        </section>
      )}

      <footer className={styles.footer}>
        <p>
          CLI: <code>npm run pipeline</code> · Demo:{" "}
          <code>npm run pipeline:demo</code>
        </p>
        <p className={styles.disclaimer}>
          Automated screens are first-pass signals — not legal clearance. Wire API keys
          in <code>.env</code> for EUIPO, WIPO, Crunchbase, and LinkedIn.
        </p>
      </footer>
    </div>
  );
}
