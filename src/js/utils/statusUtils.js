export const STATUS_CONFIG = {
  pending: {
    icon: 'Clock',
    class: 'bg-warning bg-opacity-25 text-warning',
    text: 'Pending'
  },
  open: {
    icon: 'AlertCircle',
    class: 'bg-info bg-opacity-25 text-info',
    text: 'Open'
  },
  blocked: {
    icon: 'Ban',
    class: 'bg-danger bg-opacity-25 text-danger',
    text: 'Blocked'
  },
  wont_fix: {
    icon: 'XCircle',
    class: 'bg-secondary bg-opacity-25 text-secondary',
    text: 'Won\'t Fix'
  },
  fixed: {
    icon: 'CheckCircle',
    class: 'bg-success bg-opacity-25 text-success',
    text: 'Fixed'
  }
};

export const getStatusText = (status) => {
  return STATUS_CONFIG[status]?.text || 'Unknown';
};

export const getStatusConfig = (status) => {
  return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
};