import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityFeed } from './ActivityFeed';
import { makeActivity } from '../test/fixtures';

describe('ActivityFeed', () => {
  it('renders join and leave entries with the mapped student name', () => {
    render(
      <ActivityFeed
        activity={[
          makeActivity({ id: 'a1', kind: 'join', studentName: 'Ava Thompson' }),
          makeActivity({ id: 'a2', kind: 'leave', studentName: null, displayName: 'guest-42' }),
        ]}
      />,
    );
    expect(screen.getByText('Ava Thompson')).toBeInTheDocument();
    expect(screen.getByText('guest-42')).toBeInTheDocument();
    expect(screen.getAllByText('joined')).toHaveLength(1);
    expect(screen.getAllByText('left')).toHaveLength(1);
  });

  it('shows an empty state when nothing has happened', () => {
    render(<ActivityFeed activity={[]} />);
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });
});
