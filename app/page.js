"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const ROLES = [
  { id: "strategist", emoji: "🧭", name: "Content Strategist", color: "#4f7cff", tagline: "Plans your content calendar and keeps videos aligned with your goals." },
  { id: "seo", emoji: "🔎", name: "SEO Content Specialist", color: "#18a999", tagline: "Finds what people are searching for and sharpens titles, tags & descriptions." },
  { id: "analyst", emoji: "📊", name: "Data Analyst", color: "#c9820f", tagline: "Reads your numbers to find what's actually working (or not)." },
  { id: "scriptwriter", emoji: "✍️", name: "Scriptwriter", color: "#a855d6", tagline: "Tightens hooks, pacing and structure in your scripts/outlines." },
  { id: "community", emoji: "💬", name: "Community Manager", color: "#e0557a", tagline: "Reads comments and audience signals to build loyalty." },
  { id: "social", emoji: "📱", name: "Social Media Manager", color: "#3fb6c9", tagline: "Plans how to repurpose and distribute each video across platforms." },
];
const roleMap = Object.fromEntries(ROLES.map((r) => [r.id, r]));

function timeAgo(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return d.toLocaleDateString();
}

export default function Page() {
  const [user, setUser] = useState(null);
  const [channel, setChannel] = useState({ name: "", niche: "", stage: "new", goals: "", notes: "" });
  const [tasks, setTasks] = useState([]);
  const [taskFilter, setTaskFilter] = useState("open");
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);

  const [view, setView] = useState("picker"); // picker | chat | tasks | settings
  const [active, setActive] = useState(null); // { id, title, character_ids, live_snapshot }
  const [messages, setMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [pickCharacterIds, setPickCharacterIds] = useState(["strategist"]);
  const [pickUseLive, setPickUseLive] = useState(true);
  const [starting, setStarting] = useState(false);
  const [pickError, setPickError] = useState("");

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    fetch("/api/me").then((r) => r.json()).then((d) => setUser(d.user || null)).catch(() => {});
    fetch("/api/profile").then((r) => r.json()).then((d) => d.channel && setChannel((c) => ({ ...c, ...d.channel }))).catch(() => {});
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks || [])).catch(() => {});
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => {
        const list = d.conversations || [];
        setConversations(list);
        if (list.length > 0) openConversation(list[0].id);
        else setView("picker");
      })
      .catch(() => {})
      .finally(() => setLoadingConvos(false));
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loadingChat]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  async function openConversation(id) {
    setView("chat");
    setLoadingChat(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActive(data.conversation);
      setMessages(data.messages || []);
    } catch (e) {
      setActive(null);
      setMessages([]);
    } finally {
      setLoadingChat(false);
    }
  }

  function toggleCharacter(id) {
    setPickCharacterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function startConversation() {
    if (pickCharacterIds.length === 0) {
      setPickError("Pick at least one role.");
      return;
    }
    setPickError("");
    setStarting(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterIds: pickCharacterIds, useLiveData: pickUseLive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start.");
      setConversations((prev) => [{ id: data.conversation.id, title: data.conversation.title, character_ids: pickCharacterIds, updated_at: new Date().toISOString() }, ...prev]);
      setActive(data.conversation);
      setMessages(data.messages || []);
      setView("chat");
    } catch (e) {
      setPickError(e.message);
    } finally {
      setStarting(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !active || sending) return;
    setInput("");
    setSending(true);
    const optimisticId = "tmp-" + Date.now();
    setMessages((prev) => [...prev, { id: optimisticId, sender: "user", content: text }]);

    try {
      const res = await fetch(`/api/conversations/${active.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== optimisticId),
        data.userMessage,
        ...data.assistantMessages,
      ]);
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === active.id);
        const updated = idx >= 0 ? { ...prev[idx], updated_at: new Date().toISOString() } : null;
        const rest = prev.filter((c) => c.id !== active.id);
        return updated ? [updated, ...rest] : prev;
      });
      if (data.actionsAdded?.length) {
        setTasks((prev) => [...data.actionsAdded.map((a) => ({ ...a, done: false, created_at: new Date().toISOString() })), ...prev]);
        setToast(`+${data.actionsAdded.length} added to your tasks`);
        setTimeout(() => setToast(""), 3000);
      }
    } catch (e) {
      setMessages((prev) => [...prev.filter((m) => m.id !== optimisticId), { id: optimisticId, sender: "user", content: text }, { id: optimisticId + "-err", sender: "system", content: `⚠️ ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  function onInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function saveProfile() {
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(channel),
    });
    setProfileNote(res.ok ? "Saved." : "Could not save.");
    setTimeout(() => setProfileNote(""), 2000);
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
  const activeCharacters = useMemo(() => (active?.character_ids || []).map((id) => roleMap[id]).filter(Boolean), [active]);

  return (
    <div className="shell">
      <div className="rail">
        <div className="rail-mark">🎬</div>
        <button className={"rail-btn" + (view === "picker" && !active ? " active" : "")} title="New conversation" onClick={() => setView("picker")}>
          +
        </button>
        <button className={"rail-btn" + (view === "tasks" ? " active" : "")} title="Tasks" onClick={() => setView("tasks")}>
          ✓
        </button>
        <button className={"rail-btn" + (view === "settings" ? " active" : "")} title="Channel settings" onClick={() => setView("settings")}>
          ⚙
        </button>
        <div className="rail-spacer" />
        {user?.picture && <img src={user.picture} alt="" className="rail-avatar" title={user.name} onClick={signOut} />}
      </div>

      <div className="sidebar">
        <div className="sidebar-head">
          <span>Conversations</span>
          <button className="btn-mini" onClick={() => setView("picker")}>
            + New
          </button>
        </div>
        <div className="convo-list">
          {loadingConvos ? (
            <div className="sidebar-empty">Loading…</div>
          ) : conversations.length === 0 ? (
            <div className="sidebar-empty">No conversations yet — start one.</div>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className={"convo-item" + (active?.id === c.id && view === "chat" ? " sel" : "")} onClick={() => openConversation(c.id)}>
                <div className="convo-avatars">
                  {(c.character_ids || []).slice(0, 3).map((id) => (
                    <span key={id} className="mini-avatar" style={{ background: roleMap[id]?.color || "#ccc" }}>
                      {roleMap[id]?.emoji}
                    </span>
                  ))}
                </div>
                <div className="convo-meta">
                  <div className="convo-title">{c.title || "New conversation"}</div>
                  <div className="convo-time">{timeAgo(c.updated_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="main">
        {view === "picker" && (
          <div className="picker-wrap">
            <h1>Who's joining?</h1>
            <p className="hint">Pick one or more roles to bring into the conversation. You can chat with all of them at once, like a group thread.</p>
            <div className="role-grid">
              {ROLES.map((r) => {
                const sel = pickCharacterIds.includes(r.id);
                return (
                  <div key={r.id} className={"role-card" + (sel ? " sel" : "")} onClick={() => toggleCharacter(r.id)} style={sel ? { borderColor: r.color } : undefined}>
                    <div className="check" style={sel ? { background: r.color, borderColor: r.color } : undefined}>{sel ? "✓" : ""}</div>
                    <div className="top">
                      <span className="emoji" style={{ background: r.color + "22" }}>{r.emoji}</span>
                      <span className="rname">{r.name}</span>
                    </div>
                    <div className="tagline">{r.tagline}</div>
                  </div>
                );
              })}
            </div>
            <label className="live-toggle">
              <input type="checkbox" checked={pickUseLive} onChange={(e) => setPickUseLive(e.target.checked)} />
              Connect my live YouTube channel data to this conversation
            </label>
            <p className="hint small">
              We'll pull your channel stats and recent videos when the conversation starts. You can also just paste a specific video link into the chat any time.
            </p>
            <div className="save-row">
              <button className="btn btn-primary" disabled={starting} onClick={startConversation}>
                {starting ? "Starting…" : "Start conversation →"}
              </button>
              <span className="save-note">{pickError}</span>
            </div>
          </div>
        )}

        {view === "chat" && (
          <div className="chat-wrap">
            <div className="chat-header">
              <div className="chat-header-avatars">
                {activeCharacters.map((c) => (
                  <span key={c.id} className="mini-avatar lg" style={{ background: c.color }} title={c.name}>
                    {c.emoji}
                  </span>
                ))}
              </div>
              <div className="chat-header-title">{active?.title || "Conversation"}</div>
              {active?.live_snapshot && <span className="live-pill">● live data connected</span>}
            </div>
            <div className="chat-messages" ref={scrollRef}>
              {loadingChat ? (
                <div className="sidebar-empty">Loading…</div>
              ) : (
                messages.map((m) => {
                  if (m.sender === "system") {
                    return (
                      <div key={m.id} className="msg-system">
                        {m.content}
                      </div>
                    );
                  }
                  const isUser = m.sender === "user";
                  const role = !isUser ? roleMap[m.sender] : null;
                  return (
                    <div key={m.id} className={"msg-row" + (isUser ? " user" : "")}>
                      <div className="msg-avatar" style={{ background: isUser ? "#dbe3ff" : (role?.color || "#ccc") }}>
                        {isUser ? "🙂" : role?.emoji || "🤖"}
                      </div>
                      <div className="msg-col">
                        {!isUser && <div className="msg-sender-name">{role?.name || m.sender}</div>}
                        <div className="msg-bubble">
                          {m.shared_video && (
                            <div className="video-chip">
                              📎 {m.shared_video.title}
                            </div>
                          )}
                          {m.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              {sending && (
                <div className="msg-row">
                  <div className="msg-avatar" style={{ background: activeCharacters[0]?.color || "#ccc" }}>
                    {activeCharacters[0]?.emoji || "🤖"}
                  </div>
                  <div className="msg-col">
                    <div className="msg-bubble typing">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="chat-input-bar">
              <textarea
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Ask something, paste a video link, or just describe what's going on…"
                rows={1}
              />
              <button className="send-btn" disabled={sending || !input.trim()} onClick={sendMessage}>
                ➤
              </button>
            </div>
          </div>
        )}

        {view === "tasks" && (
          <section className="view-pad">
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
                <div className="empty">Nothing here yet — action items from your conversations show up here automatically.</div>
              ) : (
                visibleTasks.map((t) => (
                  <div className={"task-row" + (t.done ? " done" : "")} key={t.id}>
                    <div className="chk" onClick={() => toggleTaskDone(t)}>
                      {t.done ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="ttext">{t.text}</div>
                      {t.why && <div className="twhy">{t.why}</div>}
                      <div className="task-meta">
                        {roleMap[t.role] && (
                          <span className="pill" style={{ background: roleMap[t.role].color + "1a", color: roleMap[t.role].color }}>
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

        {view === "settings" && (
          <section className="view-pad">
            <div className="card">
              <h2>Your channel</h2>
              <p className="hint">This context gets handed to every character so answers are actually about your channel.</p>
              <label>Channel name</label>
              <input type="text" value={channel.name} onChange={(e) => setChannel({ ...channel, name: e.target.value })} placeholder="e.g. Joshua Jumbo" />
              <label>Niche / what it's about</label>
              <input type="text" value={channel.niche} onChange={(e) => setChannel({ ...channel, niche: e.target.value })} placeholder="e.g. design + tech, building in public" />
              <label>Where you're at</label>
              <div className="stage-pick">
                {[
                  ["new", "Just starting"],
                  ["growing", "Growing"],
                  ["established", "Established"],
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
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
