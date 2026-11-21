import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "../format.js";

export default function TrendPlot({ trend }) {
  return (
    <div
      className="chart-container"
      role="img"
      aria-label="Line chart of daily average glucose. A data table is available below."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={trend}
          margin={{ top: 12, right: 16, bottom: 8, left: -17 }}
          accessibilityLayer
        >
          <CartesianGrid
            strokeDasharray="3 5"
            vertical={false}
            stroke="#eceaf2"
          />
          <XAxis
            dataKey="date"
            tickFormatter={(date) => formatDate(date)}
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            minTickGap={28}
            tick={{ fill: "#7c798e", fontSize: 12 }}
          />
          <YAxis
            domain={["auto", "auto"]}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            tick={{ fill: "#7c798e", fontSize: 12 }}
          />
          <Tooltip
            labelFormatter={(date) => formatDate(date, { year: "numeric" })}
            formatter={(value) => [
              `${Number(value).toFixed(1)} mg/dl`,
              "Average",
            ]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e9e5f2",
              fontSize: 14,
            }}
          />
          <Line
            type="linear"
            dataKey="average"
            stroke="#7953dc"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#7953dc", strokeWidth: 2, stroke: "#fff" }}
            activeDot={{ r: 6, stroke: "#fff", strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
