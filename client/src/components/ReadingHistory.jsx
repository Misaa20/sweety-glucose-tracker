import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { SLOTS } from "@sweety/shared";
import { formatDate } from "../format.js";

export function ReadingHistory({
  data,
  onEdit,
  onDelete,
  onAdd,
  onPage,
  loading,
}) {
  const { readings, pagination } = data;
  if (!pagination.total)
    return (
      <section className="panel history-empty">
        <span className="empty-icon">
          <ClipboardList size={30} />
        </span>
        <h2>A fresh page for your readings.</h2>
        <p className="muted">
          Your saved check-ins will appear here, ready whenever you need them.
        </p>
        <button className="button primary" onClick={onAdd}>
          <Plus size={17} /> Add your first reading
        </button>
      </section>
    );
  return (
    <section className="panel history-panel" aria-label="Reading history">
      <div className="panel-heading">
        <div>
          <h2>Every check-in, in one place</h2>
          <p className="muted">
            {pagination.total} saved{" "}
            {pagination.total === 1 ? "reading" : "readings"} · Newest dates
            first
          </p>
        </div>
      </div>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">All your glucose readings</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Time slot</th>
              <th>Glucose</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {readings.map((reading) => {
              const slot = SLOTS.find((slot) => slot.value === reading.slot);
              return (
                <tr key={reading.id}>
                  <td>{formatDate(reading.date, { year: "numeric" })}</td>
                  <td>{slot.label}</td>
                  <td>
                    <strong>{reading.value}</strong>{" "}
                    <span className="muted">mg/dl</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button
                        className="icon-button"
                        onClick={() => onEdit(reading)}
                        aria-label={`Edit ${slot.label} reading on ${reading.date}`}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button delete-icon"
                        onClick={() => onDelete(reading)}
                        aria-label={`Delete ${slot.label} reading on ${reading.date}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          Page {pagination.page} of {pagination.totalPages}
        </span>
        <div>
          <button
            className="button secondary"
            onClick={() => onPage(pagination.page - 1)}
            disabled={pagination.page === 1 || loading}
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <button
            className="button secondary"
            onClick={() => onPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || loading}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
