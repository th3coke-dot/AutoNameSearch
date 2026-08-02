"use client";

import { useEffect, useState } from "react";
import type { NamingTone, PipelineResult, ScoredName } from "@/pipeline/types";
import type { VetResult, VettedName } from "@/pipeline/vet";
import { TONES } from "@/pipeline/context";
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

function verdictClass(verdict: VettedName["verdict"]): string {
  if (verdict === "strong") return styles.verdictStrong;
  if (verdict === "reject") return styles.verdictReject;
  return styles.verdictCaution;
}

export function PipelineApp() {
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [vetResult, setVetResult] = useState<VetResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState(5000);
  const [skipExternal, setSkipExternal] = useState(true);
  const [pending, setPending] = useState(false);
  const [vetPending, setVetPending] = useState(false);
  const [vetQuery, setVetQuery] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [tone, setTone] = useState<NamingTone>("nordic");
  const [mustFeel, setMustFeel] = useState("");
  const [mustAvoid, setMustAvoid] = useState("");
  const [roots, setRoots] = useState("");

  useEffect(() => {
    fetch("/api/runs/latest")
      .then(async (r) => {
        if (!r.ok) return;
        setResult(await r.json());
      })
      .catch(() => undefined);
  }, []);

  const contextPayload = {
    oneLiner,
    tone,
    mustFeel,
    mustAvoid,
    roots,
  };

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
          context: contextPayload,
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

  async function vet() {
    setError(null);
    setVetPending(true);
    try {
      const res = await fetch("/api/vet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: vetQuery,
          skipExternal,
          context: contextPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "string" ? data.error : "Vet failed";
        throw new Error(msg);
      }
      setVetResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vet failed");
    } finally {
      setVetPending(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <p className={styles.kicker}>Project #3 · workflow automation</p>
        <h1 className={styles.brand}>AutoNameSearch</h1>
        <p className={styles.lede}>
          Generate thousands of designed names — or paste one you already like and
          run the full vetting stack.
        </p>
        <div className={styles.ctaRow}>
          <button className={styles.primary} onClick={run} disabled={pending || vetPending}>
            {pending ? "Running pipeline…" : "Run pipeline"}
          </button>
          <label className={styles.control}>
            <span>Candidates</span>
            <select
              value={candidates}
              onChange={(e) => setCandidates(Number(e.target.value))}
              disabled={pending || vetPending}
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
              disabled={pending || vetPending}
            />
            Demo mode (skip live APIs)
          </label>
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </header>

      <section className={styles.vet} aria-label="Vet a name">
        <h2>Vet a name</h2>
        <p className={styles.briefLede}>
          Free text — one name, or a list separated by commas / new lines. Uses the
          same domain, AI brand, company, and score checks.
        </p>
        <div className={styles.vetRow}>
          <label className={styles.fieldWide}>
            <span>Name</span>
            <input
              type="text"
              value={vetQuery}
              onChange={(e) => setVetQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && vetQuery.trim() && !vetPending) {
                  void vet();
                }
              }}
              placeholder="Norvia — or Norvia, Velion, Torix"
              disabled={pending || vetPending}
              maxLength={500}
            />
          </label>
          <button
            className={styles.secondary}
            onClick={vet}
            disabled={pending || vetPending || !vetQuery.trim()}
          >
            {vetPending ? "Vetting…" : "Vet name"}
          </button>
        </div>

        {vetResult ? (
          <div className={styles.vetResults}>
            {vetResult.results.map((row) => (
              <article key={row.name} className={styles.vetItem}>
                <header className={styles.vetItemHead}>
                  <h3>{row.name}</h3>
                  <span className={verdictClass(row.verdict)}>{row.verdict}</span>
                  <span className={styles.vetScore}>{row.total}</span>
                </header>
                <p className={styles.vetSummary}>{row.summary}</p>
                <dl className={styles.vetMeta}>
                  <div>
                    <dt>Domains</dt>
                    <dd>
                      {row.domains.map((d) => (
                        <span key={d.tld}>
                          .{d.tld}{" "}
                          <Mark
                            ok={d.status === "clear"}
                            unchecked={d.status === "unchecked"}
                          />
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Brand / TM</dt>
                    <dd>
                      <Mark
                        ok={row.trademarkOk}
                        unchecked={row.trademarks.status === "unchecked"}
                      />{" "}
                      {row.trademarks.detail ?? row.trademarks.status}
                    </dd>
                  </div>
                  <div>
                    <dt>Companies</dt>
                    <dd>
                      {row.companies.map((c) => (
                        <span key={c.source}>
                          {c.source}:{" "}
                          <Mark
                            ok={c.status === "clear"}
                            unchecked={c.status === "unchecked"}
                          />{" "}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt>Scores</dt>
                    <dd>
                      ent {row.scores.enterpriseFeel} · brand {brandAvg(row)} ·
                      scandi {row.scores.scandinavianDna} · investor{" "}
                      {row.scores.investorAppeal}
                    </dd>
                  </div>
                  {row.linguisticNotes.length ? (
                    <div>
                      <dt>Linguistic</dt>
                      <dd>{row.linguisticNotes.join("; ")}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.brief} aria-label="Naming brief">
        <h2>Brief</h2>
        <p className={styles.briefLede}>
          Optional context steers generation, scoring, and AI collision review —
          including free-text vetting.
        </p>
        <div className={styles.briefGrid}>
          <label className={styles.fieldWide}>
            <span>One-liner</span>
            <input
              type="text"
              value={oneLiner}
              onChange={(e) => setOneLiner(e.target.value)}
              placeholder="AI planning for engineering teams"
              disabled={pending || vetPending}
              maxLength={240}
            />
          </label>
          <label className={styles.field}>
            <span>Tone</span>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as NamingTone)}
              disabled={pending || vetPending}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span>Must feel</span>
            <input
              type="text"
              value={mustFeel}
              onChange={(e) => setMustFeel(e.target.value)}
              placeholder="precise, calm, northern"
              disabled={pending || vetPending}
            />
          </label>
          <label className={styles.field}>
            <span>Must avoid</span>
            <input
              type="text"
              value={mustAvoid}
              onChange={(e) => setMustAvoid(e.target.value)}
              placeholder="playful, crypto, cute"
              disabled={pending || vetPending}
            />
          </label>
          <label className={styles.field}>
            <span>Roots</span>
            <input
              type="text"
              value={roots}
              onChange={(e) => setRoots(e.target.value)}
              placeholder="plan, syn, nor"
              disabled={pending || vetPending}
            />
          </label>
        </div>
      </section>

      <section className={styles.funnel} aria-label="Pipeline stages">
        <h2>The funnel</h2>
        <ol className={styles.steps}>
          {[
            ["Generate", "Context-weighted phonetic candidates"],
            ["Filter", "Length, sound, spelling"],
            ["Pre-score", "Brief-aware brand ranking"],
            ["Domains", ".com · .ai · .io"],
            ["AI brand search", "Parallel web + gpt-4.1-mini"],
            ["Companies", "Crunchbase · GitHub · LinkedIn"],
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
            <h2>Last pipeline run</h2>
            <p className={styles.runMeta}>
              <span>{result.runId}</span>
              <span>{new Date(result.createdAt).toLocaleString()}</span>
              {result.config.context?.oneLiner ? (
                <span>{result.config.context.oneLiner}</span>
              ) : null}
              {result.config.context?.tone ? (
                <span>tone: {result.config.context.tone}</span>
              ) : null}
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
          <p>
            Vet a name above, or add a brief and run the full generation pipeline.
          </p>
        </section>
      )}

      <footer className={styles.footer}>
        <p>
          CLI vet: <code>npm run pipeline -- --vet &quot;Norvia&quot;</code>
        </p>
        <p className={styles.disclaimer}>
          Automated screens are first-pass signals — not legal clearance. Uncheck
          demo mode for live GitHub + AI brand search.
        </p>
      </footer>
    </div>
  );
}
