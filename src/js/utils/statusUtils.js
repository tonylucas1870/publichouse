export const STATUS_CONFIG = {
  pending: {
    icon: 'Clock',
    class: 'bg-warning bg-opacity-25 text-warning',
    text: 'Pending'
  },
  fixed: {
    icon: 'CheckCircle',
    class: 'bg-success bg-opacity-25 text-success',
    text: 'Fixed'
  },
  wont_fix: {
    icon: 'XCircle',
    class: 'bg-danger bg-opacity-25 text-danger',
    text: 'Won\'t Fix'
  }
};

export const getStatusText = (status) => {
  return STATUS_CONFIG[status]?.text || 'Unknown';
};

export const getStatusConfig = (status) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
};