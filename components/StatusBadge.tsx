
import React from 'react';
import { ComplaintStatus } from '../types';
import { translations as t } from '../translations';

interface Props {
  status: ComplaintStatus;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  const styles = {
    [ComplaintStatus.PENDING]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [ComplaintStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 border-blue-200',
    [ComplaintStatus.RESOLVED]: 'bg-green-100 text-green-800 border-green-200',
    [ComplaintStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    [ComplaintStatus.PENDING]: t.pending,
    [ComplaintStatus.IN_PROGRESS]: t.inProgress,
    [ComplaintStatus.RESOLVED]: t.resolved,
    [ComplaintStatus.REJECTED]: t.rejected,
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};
