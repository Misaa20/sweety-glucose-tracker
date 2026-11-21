export function formatDate(date, options = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    ...options,
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatRange(start, end) {
  if (start === end) return formatDate(start, { year: "numeric" });
  return `${formatDate(start)} – ${formatDate(end, { year: "numeric" })}`;
}

export function initials(name) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}
