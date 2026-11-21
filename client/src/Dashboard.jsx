import { useEffect, useState } from "react";
import {
  Activity,
  CalendarDays,
  ChartNoAxesCombined,
  Check,
  ClipboardList,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { SLOTS } from "@sweety/shared";
import { api } from "./api.js";
import { formatDate, initials } from "./format.js";
import { Brand } from "./components/Brand.jsx";
import { DailyReadings } from "./components/DailyReadings.jsx";
import { Modal } from "./components/Modal.jsx";
import { ReadingForm } from "./components/ReadingForm.jsx";
import { ReportCards } from "./components/ReportCards.jsx";
import { ReadingHistory } from "./components/ReadingHistory.jsx";
import { TrendChart } from "./components/TrendChart.jsx";

const NAVIGATION = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "history", label: "My readings", icon: ClipboardList },
  { id: "reports", label: "Reports & trends", icon: ChartNoAxesCombined },
];

export function Dashboard({ user, meta, onLogout }) {
  const [view, setView] = useState("overview");
  const [date, setDate] = useState(meta.today);
  const [page, setPage] = useState(1);
  const [version, setVersion] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [toast, setToast] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const signal = controller.signal;
    Promise.all([
      api(`/reports?date=${date}`, { signal }),
      view === "history"
        ? api(`/readings?page=${page}&limit=12`, { signal })
        : Promise.resolve(null),
    ])
      .then(([report, history]) => {
        if (signal.aborted) return;
        if (history && page > 1 && !history.readings.length) {
          setPage(page - 1);
          return;
        }
        setData({ report, history });
        setLoading(false);
      })
      .catch((error) => {
        if (signal.aborted) return;
        setError(error.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [date, page, version, view]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  function navigate(next) {
    setView(next);
    setPage(1);
    setData(null);
  }
  function openModal(next) {
    setModalError("");
    setModal(next);
  }
  function saved(message) {
    setModal(null);
    setVersion((value) => value + 1);
    setToast(message);
  }
  function add(slot) {
    openModal({
      type: "add",
      slot:
        slot ||
        SLOTS.find(
          (slot) =>
            !data?.report.readings.some(
              (reading) => reading.slot === slot.value,
            ),
        )?.value ||
        "morning",
    });
  }
  async function saveReading(values) {
    const editing = modal.type === "edit";
    await api(editing ? `/readings/${modal.reading.id}` : "/readings", {
      method: editing ? "PUT" : "POST",
      body: values,
    });
    saved(
      editing ? "Reading updated." : "Reading saved. A small check-in, done.",
    );
  }
  async function deleteReading() {
    setBusy(true);
    setModalError("");
    try {
      await api(`/readings/${modal.reading.id}`, { method: "DELETE" });
      saved("Reading deleted.");
    } catch (error) {
      setModalError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setLoggingOut(true);
    try {
      await api("/auth/logout", { method: "POST" });
      onLogout();
    } catch (error) {
      setError(error.message);
      setLoggingOut(false);
    }
  }

  const report = data?.report;
  const title =
    view === "overview"
      ? `Hello, ${user.name.split(/\s+/)[0]}.`
      : view === "history"
        ? "Your reading journal."
        : "A little more perspective.";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">YOUR DAILY COMPANION</p>
        <nav aria-label="Main navigation">
          {NAVIGATION.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-button ${view === id ? "active" : ""}`}
              onClick={() => navigate(id)}
              aria-current={view === id ? "page" : undefined}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Heart size={21} />
          </span>
          <h3>Little steps count.</h3>
          <p>
            Every reading helps you see your own story a little more clearly.
          </p>
          <div className="note-decoration" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="sidebar-bottom">
          <span className="privacy-note">
            <ShieldCheck size={16} /> Your space. Your readings.
          </span>
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>Personal account</span>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={logout}
              disabled={loggingOut}
              aria-label="Log out"
            >
              {loggingOut ? (
                <LoaderCircle className="spin" size={18} />
              ) : (
                <LogOut size={18} />
              )}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">Your health, one day at a time</span>
          <span className="topbar-note">
            <Heart size={15} /> Made for your everyday
          </span>
        </header>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "overview"
                  ? "LET’S CHECK IN"
                  : view === "history"
                    ? "ONE CHECK-IN AT A TIME"
                    : "YOUR NUMBERS, WITH CONTEXT"}
              </div>
              <h1>{title}</h1>
              <p className="muted">
                {view === "overview"
                  ? "A small moment for you. A clearer picture of your day."
                  : view === "history"
                    ? "Look back, make a correction, or add a moment you missed."
                    : "See your daily, month-to-date, and previous-month summaries."}
              </p>
            </div>
            <button
              className="button primary add-main"
              onClick={() => add()}
              disabled={loading}
            >
              <Plus size={18} /> Add reading
            </button>
          </div>
          {view !== "history" && (
            <div className="date-toolbar">
              <div className="date-control">
                <CalendarDays size={18} />
                <label htmlFor="selected-date">Report date</label>
                <input
                  id="selected-date"
                  type="date"
                  value={date}
                  min="1900-01-01"
                  max={meta.today}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (
                      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                      value >= "1900-01-01" &&
                      value <= meta.today
                    )
                      setDate(value);
                  }}
                />
              </div>
              <button
                className="button date-today"
                onClick={() => setDate(meta.today)}
                disabled={date === meta.today}
              >
                Today
              </button>
              <span className="timezone-note">
                Dates in {meta.timezone.replaceAll("_", " ")}
              </span>
            </div>
          )}
          {error && (
            <div className="error-banner fetch-error" role="alert">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => setVersion((v) => v + 1)}
              >
                <RotateCcw size={15} /> Try again
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>Gathering your readings…</p>
            </div>
          ) : (
            !error &&
            report && (
              <>
                {view === "overview" && (
                  <>
                    <section className="welcome-banner">
                      <div>
                        <span className="banner-label">
                          <Sparkles size={15} /> A LITTLE CONSISTENCY GOES A
                          LONG WAY
                        </span>
                        <h2>
                          {report.daily.count === 4
                            ? "Your daily check-ins are complete."
                            : "Make room for your daily check-in."}
                        </h2>
                        <p>
                          {report.daily.count === 4
                            ? "All four readings are saved. You can review or edit them anytime."
                            : "Record up to four readings a day. We’ll bring the bigger picture together."}
                        </p>
                      </div>
                      <div className="banner-art" aria-hidden="true">
                        <div className="art-circle">
                          <Activity size={53} strokeWidth={1.6} />
                        </div>
                        <span className="art-check">
                          <Check size={20} />
                        </span>
                        <span className="art-sparkle">✦</span>
                      </div>
                    </section>
                    <DailyReadings
                      readings={report.readings}
                      date={date}
                      today={meta.today}
                      onAdd={add}
                      onEdit={(reading) => openModal({ type: "edit", reading })}
                      onDelete={(reading) =>
                        openModal({ type: "delete", reading })
                      }
                    />
                  </>
                )}
                {view !== "history" && (
                  <>
                    <section
                      className="reports-section"
                      aria-labelledby="reports-heading"
                    >
                      <div className="section-heading">
                        <div>
                          <h2 id="reports-heading">Your numbers at a glance</h2>
                          <p className="muted">
                            A little context for every check-in.
                          </p>
                        </div>
                        <span className="section-meta">
                          All values in mg/dl
                        </span>
                      </div>
                      <ReportCards report={report} />
                    </section>
                    <TrendChart trend={report.trend} date={date} />
                  </>
                )}
                {view === "reports" && (
                  <DailyReadings
                    readings={report.readings}
                    date={date}
                    today={meta.today}
                    onAdd={add}
                    onEdit={(reading) => openModal({ type: "edit", reading })}
                    onDelete={(reading) =>
                      openModal({ type: "delete", reading })
                    }
                  />
                )}
                {view === "history" && data.history && (
                  <ReadingHistory
                    data={data.history}
                    onAdd={() => add()}
                    onEdit={(reading) => openModal({ type: "edit", reading })}
                    onDelete={(reading) =>
                      openModal({ type: "delete", reading })
                    }
                    onPage={setPage}
                    loading={loading}
                  />
                )}
              </>
            )
          )}
          <footer className="dashboard-footer">
            <span>
              <Heart size={13} /> Small check-ins. A clearer picture.
            </span>
            <span>Sweety · Your daily glucose companion</span>
          </footer>
        </main>
      </div>
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast">
            <Check size={18} />
            {toast}
          </div>
        )}
      </div>
      {modal && modal.type !== "delete" && (
        <Modal
          title={
            modal.type === "edit" ? "Edit your reading" : "A moment to check in"
          }
          description="One reading. A little more clarity."
          onClose={() => setModal(null)}
          busy={busy}
        >
          <ReadingForm
            today={meta.today}
            defaultDate={view === "history" ? meta.today : date}
            defaultSlot={modal.slot}
            initial={modal.reading}
            onSave={saveReading}
            onCancel={() => setModal(null)}
            onBusyChange={setBusy}
          />
        </Modal>
      )}
      {modal?.type === "delete" && (
        <Modal
          title="Delete this reading?"
          description={`${SLOTS.find((slot) => slot.value === modal.reading.slot).label} · ${formatDate(modal.reading.date, { year: "numeric" })} · ${modal.reading.value} mg/dl`}
          onClose={() => setModal(null)}
          busy={busy}
        >
          <p className="delete-explanation">
            This reading will be removed from your journal and reports. You can
            add a new reading for this slot afterward.
          </p>
          {modalError && (
            <div className="error-banner" role="alert">
              {modalError}
            </div>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() => setModal(null)}
              disabled={busy}
            >
              Keep reading
            </button>
            <button
              className="button danger"
              onClick={deleteReading}
              disabled={busy}
            >
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Trash2 size={17} />
              )}
              {busy ? "Deleting…" : "Delete reading"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
