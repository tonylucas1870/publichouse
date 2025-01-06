import { Clock, Check, Trash2 } from 'lucide-react';

export const statusIcons = {
  pending: Clock,
  claimed: Check,
  disposed: Trash2,
} as const;

export const getStatusText = (status: keyof typeof statusIcons): string => {
  return status.charAt(0).toUpperCase() + status.slice(1);
};