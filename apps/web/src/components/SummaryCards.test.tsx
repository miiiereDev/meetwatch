import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SummaryCards } from './SummaryCards';

describe('SummaryCards', () => {
  it('renders each status count and the attendance average', () => {
    render(
      <SummaryCards
        summary={{
          online: 12,
          left: 4,
          absent: 3,
          late: 2,
          unstable: 1,
          total: 19,
          attendanceAvgPct: 81.4,
        }}
      />,
    );
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('Absent')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Late')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/19 students · 81% average attendance/)).toBeInTheDocument();
  });
});
