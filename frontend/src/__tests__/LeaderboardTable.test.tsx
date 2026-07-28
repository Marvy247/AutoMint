import React from 'react';
import { render, screen } from '@testing-library/react';
import { LeaderboardTable } from '../components/leaderboard/LeaderboardTable';

describe('LeaderboardTable Component', () => {
  it('renders empty message when no users are provided', () => {
    render(<LeaderboardTable users={[]} />);
    expect(screen.getByTestId('empty-leaderboard')).toBeInTheDocument();
    expect(screen.getByText('No leaderboard data available')).toBeInTheDocument();
  });

  it('renders users list correctly', () => {
    const mockUsers = [
      { rank: 1, address: 'GABC...1234', points: 1500, botCount: 3 },
      { rank: 2, address: 'GXYZ...5678', points: 900, botCount: 1 },
    ];

    render(<LeaderboardTable users={mockUsers} />);
    expect(screen.getByTestId('leaderboard-table')).toBeInTheDocument();
    expect(screen.getByTestId('user-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('user-row-2')).toBeInTheDocument();
    expect(screen.getByText('GABC...1234')).toBeInTheDocument();
    expect(screen.getByText('1,500')).toBeInTheDocument();
  });
});
