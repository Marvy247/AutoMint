import React from 'react';
import { render, screen } from '@testing-library/react';
import { PointsCounter } from '../components/dashboard/PointsCounter';

describe('PointsCounter Component', () => {
  it('renders total points and accrual rate correctly', () => {
    render(<PointsCounter points={2500} rate={50} />);
    expect(screen.getByTestId('points-counter')).toBeInTheDocument();
    expect(screen.getByTestId('total-points')).toHaveTextContent('2,500');
    expect(screen.getByTestId('accrual-rate')).toHaveTextContent('+50 pts/hr');
  });

  it('handles zero values cleanly', () => {
    render(<PointsCounter points={0} rate={0} />);
    expect(screen.getByTestId('total-points')).toHaveTextContent('0');
    expect(screen.getByTestId('accrual-rate')).toHaveTextContent('+0 pts/hr');
  });
});
