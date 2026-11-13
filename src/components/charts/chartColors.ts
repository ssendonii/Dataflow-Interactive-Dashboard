export const SERIES_PALETTE = [
  '#2563EB', // Cobalt Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#4F46E5', // Indigo
  '#0D9488', // Teal
  '#E11D48', // Rose
  '#64748B', // Cool Slate
  '#0284C7', // Sky
];

export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  'Credit Card': '#2563EB',
  'Debit Card': '#059669',
  eWallet: '#D97706',
  Cash: '#64748B',
};

export function getSeriesColor(key: string, index = 0): string {
  return PAYMENT_METHOD_COLORS[key] || SERIES_PALETTE[index % SERIES_PALETTE.length];
}
