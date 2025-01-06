import React from 'react';
import { statusIcons, getStatusText } from '../../utils/statusUtils';

interface StatusBadgeProps {
  status: keyof typeof statusIcons;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const StatusIcon = statusIcons[status];

  return (
    <span className={`status-badge ${status}`}>
      <StatusIcon size={16} />
      <span className="ms-1">{getStatusText(status)}</span>
    </span>
  );
}