import {
  Check,
  Coffee,
  Moon,
  Pencil,
  Plus,
  Sun,
  Sunrise,
  Trash2,
} from "lucide-react";
import { SLOTS } from "@sweety/shared";

const ICONS = [Sunrise, Coffee, Sun, Moon];

export function DailyReadings({
  readings,
  date,
  today,
  onAdd,
  onEdit,
  onDelete,
}) {
  const count = readings.length;
  return (
    <section className="daily-section" aria-labelledby="daily-title">
      <div className="section-heading">
        <div>
          <h2 id="daily-title">
            {date === today ? "Your daily check-ins" : "Daily check-ins"}
          </h2>
          <p className="muted">Four small moments to understand your day.</p>
        </div>
        <span className={`daily-progress ${count === 4 ? "complete" : ""}`}>
          {count === 4 && <Check size={14} />}
          <strong>{count} of 4</strong> recorded
        </span>
      </div>
      <div className="slots-grid">
        {SLOTS.map((slot, index) => {
          const reading = readings.find(
            (reading) => reading.slot === slot.value,
          );
          const Icon = ICONS[index];
          return (
            <article
              className={`slot-card ${reading ? "has-reading" : ""}`}
              key={slot.value}
            >
              <div className="slot-top">
                <span className={`slot-icon slot-${index}`}>
                  <Icon size={21} />
                </span>
                {reading ? (
                  <span className="recorded-label">
                    <Check size={12} /> Recorded
                  </span>
                ) : (
                  <span className="pending-label">Not recorded</span>
                )}
              </div>
              <h3>{slot.label}</h3>
              {reading ? (
                <>
                  <div className="slot-value">
                    {reading.value}
                    <span>mg/dl</span>
                  </div>
                  <div className="slot-actions">
                    <button
                      className="text-button"
                      onClick={() => onEdit(reading)}
                      aria-label={`Edit ${slot.label} reading`}
                    >
                      <Pencil size={13} /> Edit reading
                    </button>
                    <button
                      className="icon-button delete-icon"
                      onClick={() => onDelete(reading)}
                      aria-label={`Delete ${slot.label} reading`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="slot-hint">{slot.hint}</p>
                  <button
                    className="slot-add"
                    onClick={() => onAdd(slot.value)}
                    aria-label={`Add ${slot.label} reading`}
                  >
                    <Plus size={16} /> Add reading
                  </button>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
