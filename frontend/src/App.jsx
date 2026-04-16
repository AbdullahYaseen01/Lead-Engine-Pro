import { useEffect, useState } from "react";
import { generateLeads, getExportUrl, getJobStatus } from "./lib/api";
import { NICHES_BY_GROUP, STATES } from "./lib/constants";

const STORAGE_KEY = "leadgen:last-state";

function loadPersisted() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export default function App() {
  const persisted = loadPersisted();
  const [selectedStates, setSelectedStates] = useState(persisted.selectedStates || []);
  const [selectedNiches, setSelectedNiches] = useState(persisted.selectedNiches || []);
  const [nicheSearch, setNicheSearch] = useState("");
  const [jobId, setJobId] = useState(persisted.jobId || "");
  const [status, setStatus] = useState(persisted.status || null);
  const [isLoading, setIsLoading] = useState(false);
  const [targetLeads, setTargetLeads] = useState(persisted.targetLeads || 300);
  const [didDownload, setDidDownload] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ selectedStates, selectedNiches, jobId, status, targetLeads })
    );
  }, [selectedStates, selectedNiches, jobId, status, targetLeads]);

  useEffect(() => {
    if (!jobId || !status || (status.status !== "running" && status.status !== "queued")) return;
    const timer = setInterval(async () => {
      try {
        const next = await getJobStatus(jobId);
        setStatus(next);
      } catch {
        // no-op
      }
    }, 2000);

    return () => clearInterval(timer);
  }, [jobId, status]);

  async function onGenerate() {
    if (selectedStates.length === 0 || selectedNiches.length === 0) return;
    setIsLoading(true);
    try {
      const created = await generateLeads({
        niches: selectedNiches,
        states: selectedStates,
        targetLeads
      });
      setJobId(created.jobId);
      setDidDownload(false);
      setStatus({ status: "queued", progress: 0, statusText: "Queued" });
    } finally {
      setIsLoading(false);
    }
  }

  const filteredGroups = Object.entries(NICHES_BY_GROUP).map(([group, niches]) => [
    group,
    niches.filter((n) => n.toLowerCase().includes(nicheSearch.toLowerCase()))
  ]);

  return (
    <div className="min-h-screen text-slate-100">
      <div className="flex">
        <aside className="glass-card sidebar-anim w-[360px] border-r p-5">
          <h1 className="title-gradient text-3xl font-extrabold tracking-tight">Lead Engine Pro</h1>
          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            Real local business intelligence
          </p>

          <div className="mt-5">
            <h2 className="section-label mb-2">States</h2>
            <div className="space-y-2">
              {STATES.map((state) => (
                <label key={state} className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={selectedStates.includes(state)}
                    onChange={(e) =>
                      setSelectedStates((prev) =>
                        e.target.checked ? [...prev, state] : prev.filter((s) => s !== state)
                      )
                    }
                  />
                  {state}
                </label>
              ))}
            </div>
          </div>

          <div className="mt-5">
            <input
              className="glass-input w-full rounded-xl px-3 py-2 text-sm"
              placeholder="Search niches..."
              value={nicheSearch}
              onChange={(e) => setNicheSearch(e.target.value)}
            />
            <div className="mt-3 max-h-[420px] space-y-4 overflow-auto pr-1">
              {filteredGroups.map(([group, niches]) => (
                <div key={group}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="section-label">{group}</span>
                    <button
                      className="text-[11px] text-cyan-300 transition hover:underline"
                      onClick={() => {
                        setSelectedNiches((prev) => [...new Set([...prev, ...niches])]);
                      }}
                      type="button"
                    >
                      Select all
                    </button>
                  </div>
                  <div className="space-y-1">
                    {niches.map((niche) => (
                      <label key={niche} className="flex items-center gap-2 text-sm text-slate-300">
                        <input
                          type="checkbox"
                          className="custom-checkbox"
                          checked={selectedNiches.includes(niche)}
                          onChange={(e) =>
                            setSelectedNiches((prev) =>
                              e.target.checked ? [...prev, niche] : prev.filter((n) => n !== niche)
                            )
                          }
                        />
                        {niche}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6">
          <div className="glass-card neon-top-border topbar-anim mb-4 rounded-2xl p-4">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs uppercase tracking-[0.18em] text-cyan-300">Target Leads</label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  className="glass-input w-[160px] rounded-xl px-3 py-2 text-lg font-bold"
                  value={targetLeads}
                  onChange={(e) => setTargetLeads(Math.max(10, Math.min(Number(e.target.value) || 10, 5000)))}
                />
              </div>
              <button
                type="button"
                className={`rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-5 py-2 text-sm font-bold tracking-wide text-slate-950 transition duration-150 hover:scale-[1.03] disabled:opacity-60 ${status?.status === "running" ? "generate-pulse" : ""}`}
                disabled={isLoading || selectedStates.length === 0 || selectedNiches.length === 0}
                onClick={onGenerate}
              >
                Generate Leads
              </button>
              <button
                type="button"
                className="rounded-xl border border-cyan-400/45 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition duration-150 hover:shadow-[0_0_18px_rgba(0,245,255,0.2)]"
                onClick={() => {
                  setJobId("");
                  setStatus(null);
                  setDidDownload(false);
                }}
              >
                Clear Results
              </button>
              {jobId && status?.status === "completed" && (
                <a
                  className="rounded-xl border border-violet-400/50 bg-slate-900/40 px-4 py-2 text-sm text-slate-100 transition duration-150 hover:shadow-[0_0_20px_rgba(139,92,246,0.35)]"
                  href={getExportUrl(jobId)}
                  onClick={() => setDidDownload(true)}
                >
                  Export CSV
                </a>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="lead-pill px-4 py-1.5 text-sm font-bold text-white">
                {(status?.leadCount || 0)} leads found
              </p>
              {status && (
                <div className="w-[460px]">
                  <div className="mb-1 text-xs text-slate-300">{status.statusText}</div>
                  <div className="h-2 rounded-full bg-slate-950/80">
                    <div
                      className={`h-2 rounded-full ${status.status === "completed" ? "completed-progress" : "neon-progress"}`}
                      style={{ width: `${status.progress || 0}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-cyan-300">
                      {status.leadCount || 0} / {targetLeads} leads found
                    </span>
                    <span className="text-violet-300">Live crawl</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card table-anim flex min-h-[440px] items-center justify-center rounded-2xl p-8 text-center">
            {!jobId && (
              <p className="max-w-[560px] text-lg text-slate-300">
                Select your states and niches, set your target, and click Generate Leads
              </p>
            )}

            {jobId && status?.status === "running" && (
              <div>
                <p className="text-xl font-semibold text-cyan-200">Generating leads...</p>
                <p className="mt-2 text-sm text-slate-400">
                  {status.leadCount || 0} / {targetLeads} leads found
                </p>
              </div>
            )}

            {jobId && status?.status === "completed" && (
              <div className="max-w-[560px]">
                <div className="text-6xl text-cyan-300">✓</div>
                <h2 className="mt-3 text-3xl font-extrabold text-white">Your leads are ready!</h2>
                <p className="mt-2 text-slate-300">
                  {status.leadCount || 0} leads collected across {selectedNiches.length} niches and {selectedStates.length} states
                </p>
                <a
                  className="mt-6 inline-block rounded-xl bg-gradient-to-r from-cyan-400 to-violet-500 px-8 py-3 text-lg font-bold text-slate-950 shadow-[0_0_26px_rgba(139,92,246,0.45)] transition hover:scale-[1.03]"
                  href={getExportUrl(jobId)}
                  onClick={() => setDidDownload(true)}
                >
                  Download CSV
                </a>
                {didDownload && (
                  <p className="mt-3 text-sm text-emerald-300">CSV downloaded successfully</p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
