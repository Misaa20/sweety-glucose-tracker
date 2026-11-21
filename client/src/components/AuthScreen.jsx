import { useState } from "react";
import {
  Activity,
  Check,
  Eye,
  EyeOff,
  Heart,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { api } from "../api.js";
import { Brand } from "./Brand.jsx";

export function AuthScreen({ onAuthenticated, notice }) {
  const [mode, setMode] = useState("login");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState({});
  const registering = mode === "register";

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const validation = {};
    if (registering && (!values.name.trim() || values.name.trim().length > 100))
      validation.name = "Please enter your name (1–100 characters).";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      validation.email = "Please enter a valid email address.";
    if (
      values.password.length < 8 ||
      new TextEncoder().encode(values.password).length > 72
    )
      validation.password =
        "Password must be at least 8 characters and no more than 72 bytes.";
    setFields(validation);
    setError("");
    if (Object.keys(validation).length) return;
    setBusy(true);
    try {
      const { user } = await api(`/auth/${mode}`, {
        method: "POST",
        body: values,
      });
      onAuthenticated(user);
    } catch (error) {
      setError(error.message);
      setFields(error.fields || {});
    } finally {
      setBusy(false);
    }
  }

  function changeMode() {
    setMode(registering ? "login" : "register");
    setFields({});
    setError("");
    setVisible(false);
  }

  const fieldError = (name) =>
    fields[name] && (
      <span id={`${name}-error`} className="field-error">
        {fields[name]}
      </span>
    );

  return (
    <div className="auth-page">
      <section className="auth-story">
        <Brand />
        <div className="story-content">
          <span className="eyebrow">
            <span className="tiny-heart">
              <Heart size={14} />
            </span>{" "}
            A LITTLE CARE, EVERY DAY
          </span>
          <h1>
            Small check-ins.
            <br />
            <span>A clearer picture.</span>
          </h1>
          <p>
            A simple space to record your glucose, notice patterns, and make
            your daily routine a little easier.
          </p>
          <div className="story-preview" aria-hidden="true">
            <div className="preview-heading">
              <span className="mini-icon">
                <Activity size={18} />
              </span>
              <span>Your daily check-in</span>
              <span className="preview-tag">3 of 4 recorded</span>
            </div>
            <div className="preview-value">
              112<span>mg/dl</span>
            </div>
            <p>Morning (fasting)</p>
            <svg className="preview-chart" viewBox="0 0 360 90">
              <path
                d="M0 70 C30 70 30 20 60 30 S110 80 140 45 S190 60 220 25 S270 65 300 30 S340 35 360 10"
                fill="none"
                stroke="#8b6bea"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
            <div className="preview-bottom">
              <Check size={15} /> One small step toward understanding your day.
            </div>
          </div>
          <div className="story-benefits">
            <span>
              <Check size={17} /> Four simple daily slots
            </span>
            <span>
              <Check size={17} /> Reports at a glance
            </span>
          </div>
        </div>
        <div className="story-footer">
          <ShieldCheck size={17} /> Your readings belong to you.
        </div>
      </section>
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <div className="auth-heart">
            <Heart size={25} />
          </div>
          <h2>{registering ? "A fresh start, together." : "Welcome back."}</h2>
          <p className="muted">
            {registering
              ? "Create your account and start your first check-in."
              : "Your daily dose of clarity starts here."}
          </p>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <form onSubmit={submit} noValidate key={mode}>
            {registering && (
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="name"
                  autoComplete="name"
                  maxLength={100}
                  placeholder="What should we call you?"
                  aria-invalid={!!fields.name}
                  aria-describedby={fields.name ? "name-error" : undefined}
                  disabled={busy}
                />
                {fieldError("name")}
              </div>
            )}
            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                placeholder="you@example.com"
                aria-invalid={!!fields.email}
                aria-describedby={fields.email ? "email-error" : undefined}
                disabled={busy}
              />
              {fieldError("email")}
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-input">
                <input
                  id="password"
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  placeholder="At least 8 characters"
                  aria-invalid={!!fields.password}
                  aria-describedby={
                    fields.password ? "password-error" : undefined
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {fieldError("password")}
            </div>
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <button className="button primary auth-submit" disabled={busy}>
              {busy && <LoaderCircle size={18} className="spin" />}
              {busy
                ? "Just a moment…"
                : registering
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>
          <p className="auth-switch">
            {registering ? "Already have an account?" : "New to Sweety?"}{" "}
            <button
              className="text-button"
              type="button"
              onClick={changeMode}
              disabled={busy}
            >
              {registering ? "Log in" : "Create an account"}
            </button>
          </p>
          <div className="auth-private">
            <ShieldCheck size={16} /> A private space for your daily readings
          </div>
        </div>
        <p className="auth-bottom">
          A little consistency. A little more clarity.
        </p>
      </main>
    </div>
  );
}
