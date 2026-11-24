"use client";
import { useEffect, useMemo, useState } from "react";

const ROLES = [
  { id: "strategist", emoji: "🧭", name: "Content Strategist", tagline: "Plans your content calendar and keeps videos aligned with your goals.", dataHint: "Recent video topics/titles, what's planned next." },
  { id: "seo", emoji: "🔎", name: "SEO Content Specialist", tagline: "Finds what people are searching for and sharpens titles, tags & descriptions.", dataHint: "Recent video titles + descriptions, or topics you're considering." },
  { id: "analyst", emoji: "📊", name: "Data Analyst", tagline: "Reads your numbers to find what's actually working (or not).", dataHint: "Paste recent stats: titles, views, watch time/retention %, CTR, upload dates." },
  { id: "scriptwriter", emoji: "✍️", name: "Scriptwriter", tagline: "Tightens hooks, pacing and structure in your scripts/outlines.", dataHint: "Paste a script, outline, or describe the video you're planning." },
  { id: "community", emoji: "💬", name: "Community Manager", tagline: "Reads comments and audience signals to build loyalty.", dataHint: "Paste recent comments, DMs, or describe how people are engaging." },
  { id: "social", emoji: "📱", name: "Social Media Manager", tagline: "Plans how to repurpose and distribute each video across platforms.", dataHint: "Which platforms you're already on, and how you promote videos." },
];
const roleMap = Object.fromEntries(ROLES.map((r) => [r.id, r]));

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export default function Page() {
  const [tab, setTab] = useState("ask");
  const [channel, setChannel] = useState({ name: "", niche: "", stage: "new", goals: "", notes: "" });
  const [tasks, setTasks] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState(["strategist"]);
  const [question, setQuestion] = useState("");
  const [pastedData, setPastedData] = useState("");
  const [loadingRoleIds, setLoadingRoleIds] = useState([]);
  const [results, setResults] = useState([]); // [{role, out, error}]
  const [runNote, setRunNote] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const [taskFilter, setTaskFilter] = useState("open");
  const [historyModal, setHistoryModal] = useState(null);
  const [addedTaskIds, setAddedTaskIds] = useState(new Set());
  const [user, setUser] = useState(null);
  const [useLiveData, setUseLiveData] = useState(false);
  const [liveStatus, setLiveStatus] = useState(""); // "", "loading", "ready", "error"
  const [liveError, setLiveError] = useState("");
  const [liveSnapshot, setLiveSnapshot] = useState(null); // { channel, analytics, videos }

  useEffect(() => {
    const h = (window.location.hash || "").replace("#", "");
    if (["ask", "tasks", "history", "setup"].includes(h)) setTab(h);

    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => {});
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => d.channel && setChannel((c) => ({ ...c, ...d.channel })))
      .catch(() => {});
    fetch("/api/tasks")
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {});
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d) => setRuns(d.runs || []))
      .catch(() => {});
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  async function fetchLiveData(roles) {
    setLiveStatus("loading");
    setLiveError("");
    try {
      const needsComments = roles.some((r) => r.id === "community");
      const needsTranscript = roles.some((r) => r.id === "scriptwriter" || r.id === "seo");
      const [chRes, vidRes] = await Promise.all([
        fetch("/api/youtube/channel"),
        fetch(`/api/youtube/videos?limit=8&comments=${needsComments}&transcript=${needsTranscript}`),
      ]);
      const chData = await chRes.json();
      const vidData = await vidRes.json();
      if (!chRes.ok) throw new Error(chData.error || "Could not load your channel.");
      if (!vidRes.ok) throw new Error(vidData.error || "Could not load your videos.");
      const snapshot = { channel: chData.channel, analytics: chData.analytics, videos: vidData.videos || [] };
      setLiveSnapshot(snapshot);
      setLiveStatus("ready");
      return snapshot;
    } catch (err) {
      setLiveError(err.message);
      setLiveStatus("error");
      return null;
    }
  }

  function goTab(t) {
    setTab(t);
    window.location.hash = "#" + t;
  }

  function toggleRole(id) {
    setSelectedRoles((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const dataHintText = useMemo(() => {
    const chosen = ROLES.filter((r) => selectedRoles.includes(r.id));
    if (chosen.length === 0) return "Anything to paste in? (optional)";
    return "Anything to paste in? — " + chosen.map((r) => r.dataHint).join(" ");
  }, [selectedRoles]);

  async function saveProfile() {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(channel),
    });
    setProfileNote(res.ok ? "Saved." : "Could not save.");
    setTimeout(() => setProfileNote(""), 2000);
  }

  async function runRoles() {
    if (!question.trim()) {
      setRunNote("Write a question first.");
      setTimeout(() => setRunNote(""), 2000);
      return;
    }
    if (selectedRoles.length === 0) {
      setRunNote("Pick at least one role.");
      setTimeout(() => setRunNote(""), 2000);
      return;
    }
    setRunNote("");
    setResults([]);
    setAddedTaskIds(new Set());
    const chosen = ROLES.filter((r) => selectedRoles.includes(r.id));
    setLoadingRoleIds(chosen.map((r) => r.id));

    let liveData = null;
    if (useLiveData) {
      liveData = await fetchLiveData(chosen);
      if (!liveData) {
        setLoadingRoleIds([]);
        setRunNote("Couldn't load your YouTube data — see the error above, or turn off live data and paste instead.");
        return;
      }
    }

    const runId = uid();
    const roleResults = {};

    await Promise.allSettled(
      chosen.map(async (role) => {
        try {
          const res = await fetch("/api/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roleId: role.id, question, pastedData, channel, liveData }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Request failed.");
          roleResults[role.id] = data.result;
          setResults((prev) => [...prev, { role, out: data.result }]);
        } catch (err) {
          setResults((prev) => [...prev, { role, error: err.message }]);
        } finally {
          setLoadingRoleIds((prev) => prev.filter((id) => id !== role.id));
        }
      })
    );

    const run = {
      id: runId,
      timestamp: Date.now(),
      question,
      pastedData,
      roles: chosen.map((r) => r.id),
      roleResults,
      usedLiveData: !!liveData,
    };
    setRuns((prev) => [run, ...prev]);
    fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: runId, question, pastedData, channelSnapshot: channel, roles: run.roles, roleResults, usedLiveData: !!liveData }),
    }).catch(() => {});
  }

  async function addTask(roleId, action) {
    const id = uid();
    const task = { id, text: action.text, why: action.why || "", role: roleId, done: false, created_at: new Date().toISOString() };
    setTasks((prev) => [task, ...prev]);
    setAddedTaskIds((prev) => new Set(prev).add(action.text + roleId));
    fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text: action.text, why: action.why, role: roleId }),
    }).catch(() => {});
  }

  async function toggleTaskDone(task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: !t.done } : t)));
    fetch(`/api/tasks?id=${encodeURIComponent(task.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !task.done }),
    }).catch(() => {});
  }

  async function deleteTask(task) {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    fetch(`/api/tasks?id=${encodeURIComponent(task.id)}`, { method: "DELETE" }).catch(() => {});
  }

  const visibleTasks = tasks.filter((t) => (taskFilter === "open" ? !t.done : taskFilter === "done" ? t.done : true));

  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">
          <div className="mark">🎬</div>
          <div>
            <div className="name">Multi-Hat</div>
            <div className="sub">YouTube growth crew, on call</div>
          </div>
        </div>
        <nav className="tabs">
          {["ask", "tasks", "history", "setup"].map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => goTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {user.picture && (
              <img src={user.picture} alt="" width={26} height={26} style={{ borderRadius: "50%" }} />
            )}
            <span style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{user.name}</span>
            <button className="btn btn-ghost btn-sm" onClick={signOut}>
              Sign out
            </button>
          </div>
        )}
      </div>

      {tab === "ask" && (
        <section className="view">
          <div className="card">
            <h2>Pick who's on duty</h2>
            <p className="hint">Select one or more roles. Each one looks at your situation through a different lens.</p>
            <div className="role-grid">
              {ROLES.map((r) => {
                const sel = selectedRoles.includes(r.id);
                return (
                  <div key={r.id} className={"role-card" + (sel ? " sel" : "")} onClick={() => toggleRole(r.id)}>
                    <div className="check">{sel ? "✓" : ""}</div>
                    <div className="top">
                      <span className="emoji">{r.emoji}</span>
                      <span className="rname">{r.name}</span>
                    </div>
                    <div className="tagline">{r.tagline}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2>What's going on?</h2>
            <p className="hint">Describe the situation like you would to a teammate.</p>
            <label>Your question</label>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. I'm not getting views — not sure if it's the content, quality, timing, or topic."
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={useLiveData}
                onChange={(e) => setUseLiveData(e.target.checked)}
                style={{ width: 15, height: 15 }}
              />
              Use live YouTube data instead of pasting
            </label>
            {useLiveData ? (
              <p className="hint" style={{ margin: "0 0 10px" }}>
                We'll pull your channel's recent videos, stats, subscriber/watch-time trends, thumbnails,
                and transcripts (where available) right before running. Note: thumbnail click-through-rate
                and impressions aren't available from YouTube's API, so those stay out of it either way.
                {liveStatus === "loading" && " Loading your channel now..."}
                {liveStatus === "error" && ` ${liveError}`}
              </p>
            ) : (
              <>
                <label>{dataHintText}</label>
                <textarea
                  value={pastedData}
                  onChange={(e) => setPastedData(e.target.value)}
                  placeholder="Paste video titles + views, recent comments, a script draft, upload dates..."
                />
              </>
            )}

            <div className="save-row">
              <button className="btn btn-primary" disabled={loadingRoleIds.length > 0} onClick={runRoles}>
                ▶ Run
              </button>
              <span className="save-note">{runNote}</span>
            </div>
          </div>

          {loadingRoleIds.map((id) => (
            <div className="loading-card" key={id}>
              <span className="spin"></span>
              {roleMap[id].emoji} {roleMap[id].name} is looking into it...
            </div>
          ))}

          {results.map(({ role, out, error }, i) => (
            <div className="result-card" key={i}>
              <div className="result-head">
                <span className="emoji">{role.emoji}</span>
                <span className="rname">{role.name}</span>
              </div>
              <div className="result-body">
                {error ? (
                  <p className="diagnosis">{error}</p>
                ) : (
                  <>
                    <p className="diagnosis">{out.diagnosis}</p>
                    {out.findings?.length > 0 && (
                      <>
                        <div className="block-label">What stands out</div>
                        <ul className="findings">
                          {out.findings.map((f, j) => (
                            <li key={j}>{f}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {out.actions?.length > 0 && (
                      <>
                        <div className="block-label">Suggested actions</div>
                        <div className="actions-list">
                          {out.actions.map((a, j) => {
                            const key = a.text + role.id;
                            const added = addedTaskIds.has(key);
                            return (
                              <div className="action-item" key={j}>
                                <div className="dot"></div>
                                <div>
                                  <div className="atext">{a.text}</div>
                                  {a.why && <div className="awhy">{a.why}</div>}
                                </div>
                                <button className="btn btn-ghost btn-sm addbtn" disabled={added} onClick={() => addTask(role.id, a)}>
                                  {added ? "Added ✓" : "+ Track"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    {out.followup && <div className="followup">💭 {out.followup}</div>}
                  </>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === "tasks" && (
        <section className="view">
          <div className="card">
            <h2>Tracked actions</h2>
            <p className="hint">Everything your crew has recommended, in one checklist.</p>
            <div className="filter-bar">
              {[["open", "Open"], ["done", "Done"], ["all", "All"]].map(([k, l]) => (
                <button key={k} className={taskFilter === k ? "active" : ""} onClick={() => setTaskFilter(k)}>
                  {l}
                </button>
              ))}
            </div>
            {visibleTasks.length === 0 ? (
              <div className="empty">Nothing here yet. Run a role from the Ask tab and track its suggestions.</div>
            ) : (
              visibleTasks.map((t) => (
                <div className={"task-row" + (t.done ? " done" : "")} key={t.id}>
                  <div className="chk" onClick={() => toggleTaskDone(t)}>
                    {t.done ? "✓" : ""}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="ttext">{t.text}</div>
                    <div className="task-meta">
                      {roleMap[t.role] && (
                        <span className="pill">
                          {roleMap[t.role].emoji} {roleMap[t.role].name}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="del" onClick={() => deleteTask(t)} title="Remove">
                    &times;
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "history" && (
        <section className="view">
          <div className="card">
            <h2>Past runs</h2>
            <p className="hint">Every question you've asked and who answered it.</p>
            {runs.length === 0 ? (
              <div className="empty">No runs yet.</div>
            ) : (
              runs.map((run) => (
                <div className="hist-item" key={run.id} onClick={() => setHistoryModal(run)}>
                  <div className="q">{run.question}</div>
                  <div className="meta">{new Date(run.timestamp).toLocaleString()}</div>
                  <div className="hist-roles">
                    {(run.roles || []).map((rid) => (
                      <span key={rid}>{roleMap[rid]?.emoji}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "setup" && (
        <section className="view">
          <div className="card">
            <h2>Your channel</h2>
            <p className="hint">This context gets handed to every role so answers are actually about your channel.</p>
            <label>Channel name</label>
            <input type="text" value={channel.name} onChange={(e) => setChannel({ ...channel, name: e.target.value })} placeholder="e.g. Joshua Jumbo" />
            <label>Niche / what it's about</label>
            <input type="text" value={channel.niche} onChange={(e) => setChannel({ ...channel, niche: e.target.value })} placeholder="e.g. design + tech, building in public" />
            <label>Where you're at</label>
            <div className="stage-pick">
              {[
                ["new", "Just starting — little to no data yet"],
                ["growing", "Growing — some videos, some data"],
                ["established", "Established — steady numbers to analyze"],
              ].map(([k, l]) => (
                <button key={k} className={channel.stage === k ? "sel" : ""} onClick={() => setChannel({ ...channel, stage: k })}>
                  {l}
                </button>
              ))}
            </div>
            <label>Goals (optional)</label>
            <textarea value={channel.goals} onChange={(e) => setChannel({ ...channel, goals: e.target.value })} placeholder="e.g. Grow to 10k subs, turn this into consulting leads" />
            <label>Anything else worth knowing (optional)</label>
            <textarea value={channel.notes} onChange={(e) => setChannel({ ...channel, notes: e.target.value })} placeholder="Upload schedule, past experiments, constraints..." />
            <div className="save-row">
              <button className="btn btn-primary" onClick={saveProfile}>
                Save channel profile
              </button>
              <span className="save-note">{profileNote}</span>
            </div>
          </div>
        </section>
      )}

      <div className="footer-note">Runs call Claude to read your situation — nothing is posted to YouTube on your behalf.</div>

      {historyModal && (
        <div className="modal-backdrop show" onClick={(e) => e.target.classList.contains("modal-backdrop") && setHistoryModal(null)}>
          <div className="modal">
            <div className="modal-head">
              <strong>{new Date(historyModal.timestamp).toLocaleString()}</strong>
              <button className="modal-close" onClick={() => setHistoryModal(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p className="diagnosis">
                <strong>Q:</strong> {historyModal.question}
              </p>
              {historyModal.pastedData && (
                <>
                  <div className="block-label">Pasted material</div>
                  <p className="diagnosis">{historyModal.pastedData}</p>
                </>
              )}
              {(historyModal.roles || []).map((rid) => {
                const role = roleMap[rid];
                const out = (historyModal.roleResults || {})[rid];
                if (!role || !out) return null;
                return (
                  <div className="result-card" key={rid}>
                    <div className="result-head">
                      <span className="emoji">{role.emoji}</span>
                      <span className="rname">{role.name}</span>
                    </div>
                    <div className="result-body">
                      <p className="diagnosis">{out.diagnosis}</p>
                      {out.findings?.length > 0 && (
                        <>
                          <div className="block-label">What stood out</div>
                          <ul className="findings">
                            {out.findings.map((f, j) => (
                              <li key={j}>{f}</li>
                            ))}
                          </ul>
                        </>
                      )}
                      {out.actions?.length > 0 && (
                        <>
                          <div className="block-label">Suggested actions</div>
                          <div className="actions-list">
                            {out.actions.map((a, j) => (
                              <div className="action-item" key={j}>
                                <div className="dot"></div>
                                <div>
                                  <div className="atext">{a.text}</div>
                                  {a.why && <div className="awhy">{a.why}</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
