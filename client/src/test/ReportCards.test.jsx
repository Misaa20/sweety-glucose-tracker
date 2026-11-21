import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ReportCards } from '../components/ReportCards.jsx';

const summary = { start: '2026-10-15', end: '2026-10-15', count: 2, highest: 150, lowest: 100, average: 125 };

describe('Report cards', () => {
  it('shows the average to one decimal and correctly labels previous month', () => {
    render(<ReportCards report={{ daily: summary, monthToDate: { ...summary, start: '2026-10-01' }, monthly: { ...summary, start: '2026-09-01', end: '2026-09-30' } }} />);
    const daily = within(screen.getByRole('article', { name: 'Daily report' }));
    expect(daily.getByText('125.0')).toBeInTheDocument();
    expect(daily.getByText('2 readings')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'Previous month' })).toHaveTextContent('1 Sept – 30 Sept 2026');
  });

  it('shows a friendly message instead of null statistics for empty reports', () => {
    const empty = { ...summary, count: 0, highest: null, lowest: null, average: null };
    render(<ReportCards report={{ daily: empty, monthToDate: empty, monthly: empty }} />);
    expect(screen.getAllByText('No readings just yet.')).toHaveLength(3);
    expect(screen.getAllByText('0 readings')).toHaveLength(3);
    expect(screen.queryByText('null')).not.toBeInTheDocument();
  });
});
