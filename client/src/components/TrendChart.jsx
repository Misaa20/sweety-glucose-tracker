import { lazy, Suspense } from "react";
import { Activity } from "lucide-react";
import { formatDate } from "../format.js";

const Chart = lazy(() => import("./TrendPlot.jsx"));

export function TrendChart({ trend, date }) {
  return (
    <section className="panel trend-panel" aria-labelledby="trend-title">
      <div className="panel-heading">
        <div>
          <h2 id="trend-title">The bigger picture</h2>
          <p className="muted">
            Daily averages for{" "}
            {formatDate(date, {
              month: "long",
              year: "numeric",
              day: undefined,
            })}
          </p>
        </div>
        <span className="chart-legend">
          <span /> Average glucose
        </span>
      </div>
      {trend.length ? (
        <>
          <Suspense
            fallback={<div className="chart-placeholder">Loading chart…</div>}
          >
            <Chart trend={trend} />
          </Suspense>
          <p className="chart-caption">
            Daily average in mg/dl · Each point combines the readings recorded
            that day.
          </p>
          <details className="chart-data">
            <summary>View chart data</summary>
            <table>
              <caption className="sr-only">
                Monthly daily average glucose readings
              </caption>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Average (mg/dl)</th>
                  <th>Readings</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((point) => (
                  <tr key={point.date}>
                    <td>{formatDate(point.date)}</td>
                    <td>{point.average.toFixed(1)}</td>
                    <td>{point.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <div className="chart-empty">
          <span className="empty-icon">
            <Activity size={27} />
          </span>
          <h3>Your story starts with a reading.</h3>
          <p>
            Add a reading this month and your daily averages will appear here.
          </p>
        </div>
      )}
    </section>
  );
}
