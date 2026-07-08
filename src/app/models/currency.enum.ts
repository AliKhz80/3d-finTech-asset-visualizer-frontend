// src/app/core/models/currency.enum.ts

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  JPY = 'JPY',
  GBP = 'GBP',
  CNY = 'CNY',
  INR = 'INR',
  AED = 'AED',
  // Add more as needed
  USDT = 'USDT',   // Tether
  GOLD = 'GOLD',   // For consistency with Gold APIs
  XAU = 'XAU'      // Alternative for Gold
}

export enum CurrencyName {
  USD = 'United States Dollar',
  EUR = 'Euro',
  JPY = 'Japanese Yen',
  GBP = 'British Pound Sterling',
  CNY = 'Chinese Yuan',
  INR = 'Indian Rupee',
  AED = 'United Arab Emirates Dirham',
  USDT = 'Tether'
}

// Helper function
export function getCurrencyName(code: Currency | string): string {
  return CurrencyName[code as keyof typeof CurrencyName] || code;
}