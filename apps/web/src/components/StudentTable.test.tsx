import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StudentTable } from './StudentTable';
import { makeStudent } from '../test/fixtures';

const NOW = Date.parse('2026-05-04T09:10:00.000Z');

describe('StudentTable', () => {
  it('renders one row per student with status and attendance', () => {
    render(
      <StudentTable
        statuses={[
          makeStudent({
            studentId: 's1',
            name: 'Ava Thompson',
            status: 'online',
            late: true,
            attendancePct: 88,
          }),
          makeStudent({
            studentId: 's2',
            name: 'Ben Ode',
            status: 'absent',
            attendancePct: 0,
            joinedAt: null,
            currentStintStartedAt: null,
          }),
        ]}
        isLoading={false}
        nowMs={NOW}
        caption="Test roster"
      />,
    );
    const table = screen.getByRole('table', { name: 'Test roster' });
    expect(within(table).getByText('Ava Thompson')).toBeInTheDocument();
    expect(within(table).getByText('Ben Ode')).toBeInTheDocument();
    expect(within(table).getAllByText('Online')).toHaveLength(1);
    expect(within(table).getAllByText('Absent')).toHaveLength(1);
    expect(within(table).getAllByText('Late')).toHaveLength(1);
    expect(within(table).getAllByText('88%')).toHaveLength(1);
  });

  it('shows loading skeletons while data is pending', () => {
    render(<StudentTable statuses={undefined} isLoading nowMs={NOW} caption="loading" />);
    expect(screen.queryByRole('table', { description: 'loading' })).not.toBeInTheDocument();
    expect(screen.queryByText('No students match')).not.toBeInTheDocument();
  });

  it('shows the empty state when the filtered list is empty', () => {
    render(<StudentTable statuses={[]} isLoading={false} nowMs={NOW} caption="empty" />);
    expect(screen.getByText('No students match')).toBeInTheDocument();
  });
});
