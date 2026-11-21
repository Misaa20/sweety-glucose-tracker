import { useEffect, useState } from "react";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { api } from "./api.js";
import { AuthScreen } from "./components/AuthScreen.jsx";
import { Brand } from "./components/Brand.jsx";
import { Dashboard } from "./Dashboard.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError("");
    Promise.all([
      api("/meta", { signal }),
      api("/auth/me", { signal }).catch((error) => {
        if (error.status === 401) return { user: null };
        throw error;
      }),
    ])
      .then(([metadata, session]) => {
        if (!signal.aborted) {
          setMeta(metadata);
          setUser(session.user);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (!signal.aborted) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    function expired() {
      setUser(null);
      setNotice("Your session has expired. Please log in again.");
    }
    window.addEventListener("sweety:session-expired", expired);
    return () => window.removeEventListener("sweety:session-expired", expired);
  }, []);

  // Refresh the calendar boundary when returning to a tab left open overnight.
  useEffect(() => {
    function refreshDate() {
      if (document.visibilityState === "visible")
        api("/meta")
          .then(setMeta)
          .catch(() => {});
    }
    document.addEventListener("visibilitychange", refreshDate);
    return () => document.removeEventListener("visibilitychange", refreshDate);
  }, []);

  if (loading || error)
    return (
      <main className="boot-screen">
        <Brand />
        {loading ? (
          <>
            <LoaderCircle size={26} className="spin" />
            <p className="muted">A little clarity is on its way…</p>
          </>
        ) : (
          <>
            <p role="alert">{error}</p>
            <button
              className="button primary"
              onClick={() => setRetry((r) => r + 1)}
            >
              <RotateCcw size={17} /> Try again
            </button>
          </>
        )}
      </main>
    );
  if (!user)
    return (
      <AuthScreen
        notice={notice}
        onAuthenticated={(user) => {
          setUser(user);
          setNotice("");
        }}
      />
    );
  return (
    <Dashboard
      user={user}
      meta={meta}
      onLogout={() => {
        setUser(null);
        setNotice("");
      }}
    />
  );
}
