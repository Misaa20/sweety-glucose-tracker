import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  Heart,
  LoaderCircle,
  LogOut,
  RotateCcw,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { SLOTS } from "@sweety/shared";
import { api } from "./api.js";
import { formatDate, initials } from "./format.js";
import { Brand } from "./components/Brand.jsx";
import { ReportCards } from "./components/ReportCards.jsx";
import { TrendChart } from "./components/TrendChart.jsx";

export function DoctorDashboard({ user, meta, onLogout }) {
  const [patients, setPatients] = useState(null);
  const [selected, setSelected] = useState("");
  const [date, setDate] = useState(meta.today);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setPatients(null);
    setReport(null);
    setLoading(true);
    api("/doctor/patients", { signal: controller.signal })
      .then(({ patients }) => {
        if (controller.signal.aborted) return;
        setPatients(patients);
        setSelected((previous) =>
          patients.some((patient) => String(patient.id) === previous)
            ? previous
            : String(patients[0]?.id || ""),
        );
        if (!patients.length) setLoading(false);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!selected || !patients) return;
    const controller = new AbortController();
    setError("");
    setReport(null);
    setLoading(true);
    api(`/doctor/patients/${selected}/reports?date=${date}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [selected, date, patients]);

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

  return (
    <div className="app-shell doctor-shell">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">YOUR CARE WORKSPACE</p>
        <nav aria-label="Main navigation">
          <span className="nav-button active" aria-current="page">
            <Users size={20} /> Patient reports
          </span>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Stethoscope size={22} />
          </span>
          <h3>A clearer view of care.</h3>
          <p>Review the readings and reports of patients assigned to you.</p>
        </div>
        <div className="sidebar-bottom">
          <span className="privacy-note">
            <ShieldCheck size={16} /> Assigned patients only
          </span>
          <div className="user-card">
            <span className="avatar">{initials(user.name)}</span>
            <div>
              <strong>{user.name}</strong>
              <span>Doctor account</span>
            </div>
            <button
              className="icon-button"
              onClick={logout}
              aria-label="Log out"
              disabled={loggingOut}
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
          <span className="breadcrumb">
            A clearer picture for better conversations
          </span>
          <span className="topbar-note">
            <ShieldCheck size={15} /> Patient reports
          </span>
        </header>
        <main className="dashboard">
          <div className="page-heading">
            <div>
              <div className="eyebrow">YOUR CARE WORKSPACE</div>
              <h1>Your patients, at a glance.</h1>
              <p className="muted">
                Review daily check-ins and monthly reports for your assigned
                patients.
              </p>
            </div>
            <span className="doctor-role-badge">
              <Stethoscope size={17} /> Doctor
            </span>
          </div>
          {patients?.length > 0 && (
            <div className="doctor-filters">
              <div className="field">
                <label htmlFor="patient-select">Assigned patient</label>
                <select
                  id="patient-select"
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                >
                  {patients.map((patient) => (
                    <option value={patient.id} key={patient.id}>
                      {patient.name} · {patient.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="doctor-report-date">Report date</label>
                <input
                  id="doctor-report-date"
                  type="date"
                  min="1900-01-01"
                  max={meta.today}
                  value={date}
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
                className="button secondary"
                disabled={date === meta.today}
                onClick={() => setDate(meta.today)}
              >
                <CalendarDays size={16} /> Today
              </button>
              <span className="timezone-note">Dates in {meta.timezone}</span>
            </div>
          )}
          {error && (
            <div className="error-banner fetch-error" role="alert">
              <span>{error}</span>
              <button
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RotateCcw size={16} /> Try again
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>Gathering patient reports…</p>
            </div>
          )}
          {!loading && !error && patients?.length === 0 && (
            <section className="panel history-empty">
              <span className="empty-icon">
                <Users size={30} />
              </span>
              <h2>No patients assigned yet.</h2>
              <p className="muted">
                Your patients will appear here once an administrator assigns
                them to your account.
              </p>
            </section>
          )}
          {!loading && !error && report && (
            <>
              <section className="doctor-patient-heading">
                <span className="avatar">{initials(report.patient.name)}</span>
                <div>
                  <h2>{report.patient.name}</h2>
                  <p className="muted">{report.patient.email}</p>
                </div>
                <span className="doctor-readonly">
                  <ShieldCheck size={15} /> Read-only reports
                </span>
              </section>
              <section
                className="reports-section"
                aria-labelledby="doctor-reports-title"
              >
                <div className="section-heading">
                  <div>
                    <h2 id="doctor-reports-title">Patient report summaries</h2>
                    <p className="muted">
                      The selected date anchors all three reports.
                    </p>
                  </div>
                  <span className="section-meta">All values in mg/dl</span>
                </div>
                <ReportCards report={report} />
              </section>
              <section
                className="panel"
                aria-labelledby="patient-readings-title"
              >
                <div className="panel-heading">
                  <div>
                    <h2 id="patient-readings-title">Daily readings</h2>
                    <p className="muted">
                      {formatDate(date, { year: "numeric" })}
                    </p>
                  </div>
                  <ClipboardList size={20} />
                </div>
                {report.readings.length ? (
                  <div className="table-scroll">
                    <table>
                      <caption className="sr-only">
                        Patient daily readings
                      </caption>
                      <thead>
                        <tr>
                          <th>Time slot</th>
                          <th>Glucose (mg/dl)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.readings.map((reading) => (
                          <tr key={reading.id}>
                            <td>
                              {
                                SLOTS.find(
                                  (slot) => slot.value === reading.slot,
                                ).label
                              }
                            </td>
                            <td>
                              <strong>{reading.value}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="doctor-empty-day muted">
                    No readings recorded for this date.
                  </p>
                )}
              </section>
              <TrendChart trend={report.trend} date={date} />
            </>
          )}
          <footer className="dashboard-footer">
            <span>
              <Heart size={13} /> Small check-ins. A clearer picture.
            </span>
            <span>Sweety · Doctor workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
