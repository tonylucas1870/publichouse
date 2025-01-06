import React from 'react';
import type { Finding } from '../types';
import FindingCard from './FindingCard';

interface FindingsListProps {
  findings: Finding[];
}

export default function FindingsList({ findings }: FindingsListProps) {
  return (
    <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4">
      {findings.map((finding) => (
        <div key={finding.id} className="col">
          <FindingCard finding={finding} />
        </div>
      ))}
    </div>
  );
}