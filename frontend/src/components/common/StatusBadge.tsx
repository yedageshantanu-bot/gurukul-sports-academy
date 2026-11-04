import React from 'react';
import { Badge } from '../ui/Badge';

export interface StatusBadgeProps {
  status: string;
  dot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, dot = true }) => {
  const normalized = status?.toUpperCase();

  switch (normalized) {
    case 'PAID':
    case 'PAID IN FULL':
      return <Badge variant="success" dot={dot}>Paid in full</Badge>;

    case 'PARTIAL':
    case 'PARTIALLY SETTLED':
      return <Badge variant="warning" dot={dot}>Partially settled</Badge>;

    case 'PENDING':
      return <Badge variant="warning" dot={dot}>Pending</Badge>;

    case 'OVERDUE':
      return <Badge variant="danger" dot={dot}>Pending (Overdue)</Badge>;

    case 'PRESENT':
    case 'ACTIVE':
    case 'SUCCESS':
      return <Badge variant="success" dot={dot}>{normalized}</Badge>;

    case 'ABSENT':
    case 'FAILED':
      return <Badge variant="danger" dot={dot}>{normalized}</Badge>;

    case 'DUE':
      return <Badge variant="warning" dot={dot}>Pending</Badge>;

    case 'INACTIVE':
    case 'DRAFT':
    case 'MOCK':
      return <Badge variant="neutral" dot={dot}>{normalized}</Badge>;

    default:
      return <Badge variant="info" dot={dot}>{status}</Badge>;
  }
};
