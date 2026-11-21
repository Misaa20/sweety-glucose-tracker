import { useState } from "react";
import { Check, LoaderCircle } from "lucide-react";
import { SLOTS, validateReading } from "@sweety/shared";

export function ReadingForm({
  today,
  initial,
  defaultDate,
  defaultSlot = "morning",
  onSave,
  onCancel,
  onBusyChange = () => {},
}) {
  const [values, setValues] = useState({
    date: initial?.date || defaultDate || today,
    slot: initial?.slot || defaultSlot,
    value: initial?.value ?? "",
  });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function change(event) {
    const { name, value } = event.target;
    setValues((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: undefined }));
    setError("");
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    const validation = validateReading(values, today);
    setErrors(validation);
    setError("");
    if (Object.keys(validation).length) return;
    setBusy(true);
    onBusyChange(true);
    try {
      await onSave({ ...values, value: Number(values.value) });
    } catch (error) {
      setErrors(error.fields || {});
      setError(error.message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="reading-form">
      <div className="field">
        <label htmlFor="reading-date">Date</label>
        <input
          id="reading-date"
          name="date"
          type="date"
          min="1900-01-01"
          max={today}
          value={values.date}
          onChange={change}
          disabled={busy}
          aria-invalid={!!errors.date}
          aria-describedby={errors.date ? "reading-date-error" : undefined}
        />
        {errors.date && (
          <span id="reading-date-error" className="field-error">
            {errors.date}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="reading-slot">Time slot</label>
        <select
          id="reading-slot"
          name="slot"
          value={values.slot}
          onChange={change}
          disabled={busy}
          aria-invalid={!!errors.slot}
          aria-describedby={errors.slot ? "reading-slot-error" : undefined}
        >
          {SLOTS.map((slot) => (
            <option key={slot.value} value={slot.value}>
              {slot.label}
            </option>
          ))}
        </select>
        {errors.slot && (
          <span id="reading-slot-error" className="field-error">
            {errors.slot}
          </span>
        )}
      </div>
      <div className="field">
        <label htmlFor="reading-value">
          Glucose value <span className="label-hint">mg/dl</span>
        </label>
        <div className="glucose-input">
          <input
            id="reading-value"
            name="value"
            type="number"
            inputMode="numeric"
            min="40"
            max="600"
            step="1"
            placeholder="e.g. 112"
            value={values.value}
            onChange={change}
            disabled={busy}
            aria-invalid={!!errors.value}
            aria-describedby={
              errors.value ? "reading-value-error" : "reading-value-hint"
            }
          />
          <span>mg/dl</span>
        </div>
        {errors.value ? (
          <span id="reading-value-error" className="field-error">
            {errors.value}
          </span>
        ) : (
          <span className="field-hint" id="reading-value-hint">
            Enter a whole number between 40 and 600.
          </span>
        )}
      </div>
      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button
          className="button secondary"
          type="button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Check size={17} />
          )}
          {busy ? "Saving…" : initial ? "Save changes" : "Save reading"}
        </button>
      </div>
    </form>
  );
}
