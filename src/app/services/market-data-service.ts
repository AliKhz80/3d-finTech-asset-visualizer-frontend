import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  GoldSpotResponse,
  GoldHistoryResponse,
  RealtimeExchangeResponse,
  FxDailyResponse,
  DigitalCurrencyResponse
} from '../models/market.models';
import { Currency } from '../models/currency.enum';

@Injectable()
export class MarketDataService {
  private readonly BASE_URL = 'https://www.alphavantage.co/query';
  
  private readonly API_KEY = 'Q0FCAQ1W0PM3X5CW';

  // Reactive Signals for Component Bindings
 

  public isLoading = signal(false);
  public error = signal<string | null>(null);
  public isDarkMode = signal(false);

  constructor(private http: HttpClient) {}

  private buildUrl(params: Record<string, string>): string {
    const query = new URLSearchParams({ ...params, apikey: this.API_KEY }).toString();
    return `${this.BASE_URL}?${query}`;
  }

  // Caching helpers
  public saveToCache(key: string, data: any): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`market_cache_${key}`, JSON.stringify({
          timestamp: Date.now(),
          data
        }));
      } catch (e) {
        console.warn('Error saving to cache:', e);
      }
    }
  }

  public getFromCache(key: string): any {
    if (typeof window !== 'undefined') {
      try {
        const item = localStorage.getItem(`market_cache_${key}`);
        if (item) {
          const parsed = JSON.parse(item);
          return parsed.data;
        }
      } catch (e) {
        console.warn('Error reading from cache:', e);
      }
    }
    return null;
  }

  // Gold
  getGoldSpot(): Observable<GoldSpotResponse> {
    const url = this.buildUrl({ function: 'GOLD_SILVER_SPOT', symbol: 'GOLD' });
    return this.http.get<GoldSpotResponse>(url).pipe(
      tap(data => {
        if (data && data.price) {
          this.saveToCache('goldSpot', data);
        }
      })
    );
  }

  getGoldHistory(interval: 'daily' | 'weekly' | 'monthly' = 'daily'): Observable<GoldHistoryResponse> {
    const url = this.buildUrl({ function: 'GOLD_SILVER_HISTORY', symbol: 'GOLD', interval });
    return this.http.get<GoldHistoryResponse>(url).pipe(
      tap(data => {
        if (data && data.data) {
          this.saveToCache(`goldHistory_${interval}`, data);
        }
      })
    );
  }

  // Currency Exchange
  getExchangeRate(from: Currency, to: Currency): Observable<RealtimeExchangeResponse> {
    const url = this.buildUrl({ function: 'CURRENCY_EXCHANGE_RATE', from_currency: from, to_currency: to });
    return this.http.get<RealtimeExchangeResponse>(url).pipe(
      tap(data => {
        if (data && data['Realtime Currency Exchange Rate']) {
          this.saveToCache(`exchange_${from}_${to}`, data);
        }
      })
    );
  }

  // FX Daily (for charts)
  getFxDaily(from: Currency, to: Currency): Observable<FxDailyResponse> {
    const url = this.buildUrl({ function: 'FX_DAILY', from_symbol: from, to_symbol: to, outputsize: 'compact' });
    return this.http.get<FxDailyResponse>(url).pipe(
      tap(data => {
        if (data && data['Time Series FX (Daily)']) {
          this.saveToCache(`fxDaily_${from}_${to}`, data);
        }
      })
    );
  }

  // Tether / USDT
  getUsdtRate(): Observable<RealtimeExchangeResponse> {
    const url = this.buildUrl({ function: 'CURRENCY_EXCHANGE_RATE', from_currency: 'USDT', to_currency: 'USD' });
    return this.http.get<RealtimeExchangeResponse>(url).pipe(
      tap(data => {
        if (data && data['Realtime Currency Exchange Rate']) {
          this.saveToCache('usdtRate', data);
        }
      })
    );
  }

  getUsdtHistory(): Observable<DigitalCurrencyResponse> {
    const url = this.buildUrl({ function: 'DIGITAL_CURRENCY_DAILY', symbol: 'USDT', market: 'USD' });
    return this.http.get<DigitalCurrencyResponse>(url).pipe(
      tap(data => {
        if (data && data['Time Series (Digital Currency Daily)']) {
          this.saveToCache('usdtHistory', data);
        }
      })
    );
  }
}