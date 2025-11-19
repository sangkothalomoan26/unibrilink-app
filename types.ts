
export type Theme = 'light' | 'dark';

export interface Provider {
  id: number;
  name: string;
  logoUrl?: string;
}

export interface Voucher {
  id: string; // providerId-name
  providerId: number;
  name: string;
  totalStock: number;
  remainingStock: number;
  costPrice: number;
  sellPrice: number;
  plannedStock: number;
}

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export interface ActivityLog {
  id: number;
  timestamp: string;
  type: 'SALE' | 'EDIT' | 'DELETE_VOUCHER' | 'DELETE_PROVIDER' | 'IMPORT' | 'ADD_STOCK';
  message: string;
}
