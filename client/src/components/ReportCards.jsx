import {
  CalendarDays,
  CalendarRange,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { formatRange } from "../format.js";

const TYPES = [
  {
    key: "daily",
    title: "Daily report",
    subtitle: "A snapshot of your day",
    icon: CalendarDays,
    color: "purple",
  },
  {
    key: "monthToDate",
    title: "Month to date",
    subtitle: "From the 1st to your selected date",
    icon: CalendarRange,
    color: "green",
  },
  {
    key: "monthly",
    title: "Previous month",
    subtitle: "Your last full calendar month",
    icon: CalendarRange,
    color: "peach",
  },
];

export function ReportCards({ report }) {
  return (
    <div className="report-grid">
      {TYPES.map(({ key, title, subtitle, icon: Icon, color }) => {
        const data = report[key];
        return (
          <article
            className={`report-card ${color}`}
            key={key}
            aria-label={title}
          >
            <div className="report-title">
              <span className={`report-icon ${color}`}>
                <Icon size={19} />
              </span>
              <h3>{title}</h3>
              <span className="count-badge">
                {data.count} {data.count === 1 ? "reading" : "readings"}
              </span>
            </div>
            <p className="report-range">{formatRange(data.start, data.end)}</p>
            {data.count ? (
              <>
                <div className="report-average">
                  {data.average.toFixed(1)}
                  <span>mg/dl</span>
                </div>
                <p className="average-label">Average glucose</p>
                <div className="report-extremes">
                  <span>
                    <TrendingDown size={15} /> Lowest{" "}
                    <strong>{data.lowest}</strong>
                  </span>
                  <span>
                    <TrendingUp size={15} /> Highest{" "}
                    <strong>{data.highest}</strong>
                  </span>
                </div>
              </>
            ) : (
              <div className="report-empty">
                <p>No readings just yet.</p>
                <span>Record a reading in this range to see your summary.</span>
              </div>
            )}
            <p className="report-subtitle">{subtitle}</p>
          </article>
        );
      })}
    </div>
  );
}
