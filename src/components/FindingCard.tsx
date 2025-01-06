import React from 'react';
import { MapPin } from 'lucide-react';
import type { Finding } from '../types';
import StatusBadge from './ui/StatusBadge';
import { formatDate } from '../utils/dateUtils';

interface FindingCardProps {
  finding: Finding;
}

export default function FindingCard({ finding }: FindingCardProps) {
  return (
    <div className="card h-100">
      <img
        src={finding.imageUrl}
        alt={finding.description}
        className="card-img-top"
        style={{ height: '200px', objectFit: 'cover' }}
      />
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <StatusBadge status={finding.status} />
          <small className="text-muted">{formatDate(finding.dateFound)}</small>
        </div>
        <p className="card-text">{finding.description}</p>
        <p className="card-text text-muted d-flex align-items-center gap-1">
          <MapPin size={16} />
          {finding.location}
        </p>
      </div>
    </div>
  );
}