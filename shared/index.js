export const SLOTS = [
  { value: 'morning', label: 'Morning (fasting)', short: 'Morning', hint: 'Before your first meal' },
  { value: 'after_breakfast', label: 'After breakfast', short: 'Breakfast', hint: 'Your after-breakfast reading' },
  { value: 'after_lunch', label: 'After lunch', short: 'Lunch', hint: 'Your after-lunch reading' },
  { value: 'after_dinner', label: 'After dinner', short: 'Dinner', hint: 'Your after-dinner reading' },
];

export function todayInTimezone(timezone = 'Asia/Kolkata', now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateReading(input, today) {
  const errors = {};
  if (!isValidDate(input.date)) errors.date = 'Please enter a valid date (1900 or later).';
  else if (input.date > today) errors.date = 'Date cannot be in the future.';
  if (!SLOTS.some((slot) => slot.value === input.slot)) errors.slot = 'Please select a valid time slot.';
  if (input.value === undefined || input.value === null || input.value === '') {
    errors.value = 'Please enter a glucose value.';
  } else if (
    !['string', 'number'].includes(typeof input.value) ||
    !/^\d+$/.test(String(input.value)) ||
    !Number.isInteger(Number(input.value)) || Number(input.value) < 40 || Number(input.value) > 600
  ) {
    errors.value = 'Value must be a whole number between 40 and 600 mg/dl.';
  }
  return errors;
}

export function reportRanges(date) {
  const first = `${date.slice(0, 7)}-01`;
  const previousEnd = new Date(`${first}T00:00:00Z`);
  previousEnd.setUTCDate(0);
  const end = previousEnd.toISOString().slice(0, 10);
  return {
    daily: { start: date, end: date },
    monthToDate: { start: first, end: date },
    monthly: { start: `${end.slice(0, 7)}-01`, end },
  };
}
