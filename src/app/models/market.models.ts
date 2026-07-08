import { Currency } from './currency.enum';

export interface GoldSpotResponse {
  nominal: string;
  timestamp: string;
  price: string;
}

export interface GoldHistoryItem {
  date: string;
  price: string;
}

export interface GoldHistoryResponse {
  nominal: string;
  data: GoldHistoryItem[];
}

// Realtime Exchange Rate (used for both fiat and USDT)
export interface RealtimeExchangeRate {
  '1. From_Currency Code': Currency | string;
  '2. From_Currency Name'?: string;
  '3. To_Currency Code': Currency | string;
  '4. To_Currency Name'?: string;
  '5. Exchange Rate': string;
  '6. Last Refreshed': string;
  '7. Time Zone': string;
  '8. Bid Price': string;
  '9. Ask Price': string;
}

export interface RealtimeExchangeResponse {
  'Realtime Currency Exchange Rate': RealtimeExchangeRate;
}

// FX Daily (for charts)
export interface FxDailyMeta {
  '1. Information': string;
  '2. From Symbol': Currency | string;
  '3. To Symbol': Currency | string;
  '4. Output Size': string;
  '5. Last Refreshed': string;
  '6. Time Zone': string;
}

export interface FxDailyItem {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
}

export interface FxDailyResponse {
  'Meta Data': FxDailyMeta;
  'Time Series FX (Daily)': { [date: string]: FxDailyItem };
}

// Digital Currency (USDT History)
export interface DigitalCurrencyMeta {
  '1. Information': string;
  '2. Digital Currency Code': string;
  '3. Digital Currency Name': string;
  '4. Market Code': string;
  '5. Market Name': string;
  '6. Last Refreshed': string;
  '7. Time Zone': string;
}

export interface DigitalCurrencyItem {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

export interface DigitalCurrencyResponse {
  'Meta Data': DigitalCurrencyMeta;
  'Time Series (Digital Currency Daily)': { [date: string]: DigitalCurrencyItem };
}