import React from 'react';
import { Badge } from '../ui/Badge';

export interface StatusBadgeProps {
  status: string;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, dot = true }) => {
  const normalized = status?.toUpperCase();

  switch (normalized) {
    case 'PRESENT':
    case 'PAID':
    case 'ACTIVE':
    case 'SUCCESS':
      return <Badge variant="success" dot={dot}>{normalized}</Badge>;

    case 'ABSENT':
    case 'OVERDUE':
    case 'FAILED':
      return <Badge variant="danger" dot={dot}>{normalized}</Badge>;

    case 'PENDING':
    case 'PARTIAL':
    case 'DUE':
      return <Badge variant="warning" dot={dot}>{normalized}</Badge>;

    case 'INACTIVE':
    case 'DRAFT':
    case 'MOCK':
      return <Badge variant="neutral" dot={dot}>{normalized}</Badge>;

    default:
      return <Badge variant="info" dot={dot}>{status}</Badge>;
  }
};
