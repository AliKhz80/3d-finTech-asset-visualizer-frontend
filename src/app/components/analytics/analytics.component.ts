import { ChangeDetectionStrategy, Component, ElementRef, Inject, OnInit, OnDestroy, PLATFORM_ID, ViewChild, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MarketDataService } from '../../services/market-data-service';
import { Currency } from '../../models/currency.enum';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

declare var Chart: any;

@Component({
  standalone: true,
  selector: 'analytics',
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit, OnDestroy {
  @ViewChild('historicalChart', { static: false }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  // Selected state
  public selectedAsset = signal<'GOLD' | 'EUR' | 'USDT'>('GOLD');
  public selectedInterval = signal<'daily' | 'weekly' | 'monthly'>('daily');

  // Loading/Status
  public isServiceLoading: any;
  public serviceError: any;
  public apiWarning = signal<boolean>(false);
  public isDarkMode = signal<boolean>(false);

  // Real financial statistics
  public bidRate = signal<number>(0.0);
  public askRate = signal<number>(0.0);
  public dailyHigh = signal<number>(0.0);
  public dailyLow = signal<number>(0.0);

  // Main historical chart instance
  private mainChart: any = null;

  constructor(
    private marketDataService: MarketDataService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isServiceLoading = this.marketDataService.isLoading;
    this.serviceError = this.marketDataService.error;
  }

  ngOnInit(): void {
    // Initial load
    this.loadHistoryData();
  }

  ngOnDestroy(): void {
    if (this.mainChart) {
      this.mainChart.destroy();
    }
  }

  public selectAsset(asset: 'GOLD' | 'EUR' | 'USDT'): void {
    if (this.selectedAsset() !== asset) {
      this.selectedAsset.set(asset);
      this.loadHistoryData();
    }
  }

  public selectInterval(interval: 'daily' | 'weekly' | 'monthly'): void {
    if (this.selectedInterval() !== interval) {
      this.selectedInterval.set(interval);
      this.loadHistoryData();
    }
  }

  private isRateLimit(res: any): boolean {
    if (!res) return true;
    return (
      res.hasOwnProperty('Note') ||
      res.hasOwnProperty('Information') ||
      res.hasOwnProperty('Error Message')
    );
  }

  private handleRateLimit(): void {
    this.apiWarning.set(true);
    if (isPlatformBrowser(this.platformId)) {
      this.loadCachedData();
    }
    this.marketDataService.isLoading.set(false);
  }

  private loadCachedData(): void {
    const asset = this.selectedAsset();

    // Load Bid/Ask
    if (asset === 'GOLD') {
      const cached = this.marketDataService.getFromCache('goldSpot');
      if (cached && cached.price) {
        const val = parseFloat(cached.price);
        this.bidRate.set(val - 0.5);
        this.askRate.set(val + 0.5);
      }
    } else if (asset === 'EUR') {
      const cached = this.marketDataService.getFromCache(`exchange_${Currency.EUR}_${Currency.USD}`);
      if (cached && cached['Realtime Currency Exchange Rate']) {
        const rateObj = cached['Realtime Currency Exchange Rate'];
        this.bidRate.set(parseFloat(rateObj['8. Bid Price']));
        this.askRate.set(parseFloat(rateObj['9. Ask Price']));
      }
    } else {
      const cached = this.marketDataService.getFromCache('usdtRate');
      if (cached && cached['Realtime Currency Exchange Rate']) {
        const rateObj = cached['Realtime Currency Exchange Rate'];
        this.bidRate.set(parseFloat(rateObj['8. Bid Price']));
        this.askRate.set(parseFloat(rateObj['9. Ask Price']));
      }
    }

    // Load History & High/Low
    if (asset === 'GOLD') {
      const cachedHist = this.marketDataService.getFromCache(`goldHistory_${this.selectedInterval()}`);
      if (cachedHist && cachedHist.data) {
        const dataPoints = cachedHist.data
          .map((item: any) => ({ date: this.formatDate(item.date), price: parseFloat(item.price) }))
          .reverse()
          .slice(-10);
        this.renderChart(dataPoints);
        const prices = dataPoints.map((d: any) => d.price);
        this.dailyHigh.set(Math.max(...prices));
        this.dailyLow.set(Math.min(...prices));
      }
    } else if (asset === 'EUR') {
      const cachedHist = this.marketDataService.getFromCache(`fxDaily_${Currency.EUR}_${Currency.USD}`);
      if (cachedHist && cachedHist['Time Series FX (Daily)']) {
        const timeSeries = cachedHist['Time Series FX (Daily)'];
        const keys = Object.keys(timeSeries).reverse().slice(-10);
        const dataPoints = keys.map(key => ({
          date: this.formatDate(key),
          price: parseFloat(timeSeries[key]['4. close'])
        }));
        this.renderChart(dataPoints);
        const latest = timeSeries[keys[keys.length - 1]];
        this.dailyHigh.set(parseFloat(latest['2. high']));
        this.dailyLow.set(parseFloat(latest['3. low']));
      }
    } else {
      const cachedHist = this.marketDataService.getFromCache('usdtHistory');
      if (cachedHist && cachedHist['Time Series (Digital Currency Daily)']) {
        const timeSeries = cachedHist['Time Series (Digital Currency Daily)'];
        const keys = Object.keys(timeSeries).reverse().slice(-10);
        const dataPoints = keys.map(key => ({
          date: this.formatDate(key),
          price: parseFloat(timeSeries[key]['4. close'])
        }));
        this.renderChart(dataPoints);
        const latest = timeSeries[keys[keys.length - 1]];
        this.dailyHigh.set(parseFloat(latest['2. high']));
        this.dailyLow.set(parseFloat(latest['3. low']));
      }
    }
  }

  private loadHistoryData(): void {
    this.marketDataService.isLoading.set(true);
    this.apiWarning.set(false);
    const asset = this.selectedAsset();
    const interval = this.selectedInterval();

    // 1. Fetch Real-time rates to populate Bid/Ask
    if (asset === 'GOLD') {
      this.marketDataService.getGoldSpot().subscribe({
        next: (spot) => {
          if (this.isRateLimit(spot)) {
            this.handleRateLimit();
            return;
          }
          if (spot && spot.price) {
            const val = parseFloat(spot.price);
            this.bidRate.set(val - 0.25);
            this.askRate.set(val + 0.25);
          }
        },
        error: () => this.handleRateLimit()
      });
    } else if (asset === 'EUR') {
      this.marketDataService.getExchangeRate(Currency.EUR, Currency.USD).subscribe({
        next: (rate) => {
          if (this.isRateLimit(rate)) {
            this.handleRateLimit();
            return;
          }
          if (rate && rate['Realtime Currency Exchange Rate']) {
            const rateObj = rate['Realtime Currency Exchange Rate'];
            this.bidRate.set(parseFloat(rateObj['8. Bid Price']));
            this.askRate.set(parseFloat(rateObj['9. Ask Price']));
          }
        },
        error: () => this.handleRateLimit()
      });
    } else {
      this.marketDataService.getExchangeRate(Currency.USDT, Currency.USD).subscribe({
        next: (rate) => {
          if (this.isRateLimit(rate)) {
            this.handleRateLimit();
            return;
          }
          if (rate && rate['Realtime Currency Exchange Rate']) {
            const rateObj = rate['Realtime Currency Exchange Rate'];
            this.bidRate.set(parseFloat(rateObj['8. Bid Price']));
            this.askRate.set(parseFloat(rateObj['9. Ask Price']));
          }
        },
        error: () => this.handleRateLimit()
      });
    }

    // 2. Fetch Historical data
    if (asset === 'GOLD') {
      this.marketDataService.getGoldHistory(interval).subscribe({
        next: (res) => {
          if (this.isRateLimit(res)) {
            this.handleRateLimit();
            return;
          }
          if (res && res.data && res.data.length > 0) {
            const dataPoints = res.data
              .map(item => ({ date: this.formatDate(item.date), price: parseFloat(item.price) }))
              .reverse()
              .slice(-10);
            this.renderChart(dataPoints);
            const prices = dataPoints.map(d => d.price);
            this.dailyHigh.set(Math.max(...prices));
            this.dailyLow.set(Math.min(...prices));
          } else {
            this.handleRateLimit();
          }
          this.marketDataService.isLoading.set(false);
        },
        error: () => this.handleRateLimit()
      });
    } else if (asset === 'EUR') {
      this.marketDataService.getFxDaily(Currency.EUR, Currency.USD).subscribe({
        next: (res) => {
          if (this.isRateLimit(res)) {
            this.handleRateLimit();
            return;
          }
          const timeSeries = res ? res['Time Series FX (Daily)'] : null;
          if (timeSeries) {
            const keys = Object.keys(timeSeries).reverse().slice(-10);
            const dataPoints = keys.map(key => ({
              date: this.formatDate(key),
              price: parseFloat(timeSeries[key]['4. close'])
            }));
            this.renderChart(dataPoints);
            const latestItem = timeSeries[keys[keys.length - 1]];
            this.dailyHigh.set(parseFloat(latestItem['2. high']));
            this.dailyLow.set(parseFloat(latestItem['3. low']));
          } else {
            this.handleRateLimit();
          }
          this.marketDataService.isLoading.set(false);
        },
        error: () => this.handleRateLimit()
      });
    } else {
      this.marketDataService.getUsdtHistory().subscribe({
        next: (res) => {
          if (this.isRateLimit(res)) {
            this.handleRateLimit();
            return;
          }
          const timeSeries = res ? res['Time Series (Digital Currency Daily)'] : null;
          if (timeSeries) {
            const keys = Object.keys(timeSeries).reverse().slice(-10);
            const dataPoints = keys.map(key => ({
              date: this.formatDate(key),
              price: parseFloat(timeSeries[key]['4. close'])
            }));
            this.renderChart(dataPoints);
            const latestItem = timeSeries[keys[keys.length - 1]];
            this.dailyHigh.set(parseFloat(latestItem['2. high']));
            this.dailyLow.set(parseFloat(latestItem['3. low']));
          } else {
            this.handleRateLimit();
          }
          this.marketDataService.isLoading.set(false);
        },
        error: () => this.handleRateLimit()
      });
    }
  }

  private formatDate(dateStr: string): string {
    try {
      const parts = dateStr.split('-');
      if (parts.length >= 3) {
        return `${parts[1]}-${parts[2]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  private renderChart(dataPoints: Array<{ date: string; price: number }>): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.chartCanvas) return;

    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const isDark = document.documentElement.classList.contains('dark');
    const legendColor = isDark ? '#eff0fa' : '#414753';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.03)';
    const tickColor = isDark ? '#94a3b8' : '#717785';

    const labels = dataPoints.map(d => d.date);
    const prices = dataPoints.map(d => d.price);

    // Calculate secondary dataset: SMA-3 (Moving Average)
    const sma = prices.map((price, idx, arr) => {
      if (idx < 2) return price;
      return parseFloat(((arr[idx] + arr[idx-1] + arr[idx-2]) / 3).toFixed(4));
    });

    if (this.mainChart) {
      this.mainChart.destroy();
    }

    const gradientPrimary = ctx.createLinearGradient(0, 0, 0, 400);
    gradientPrimary.addColorStop(0, 'rgba(18, 117, 226, 0.15)');
    gradientPrimary.addColorStop(1, 'rgba(18, 117, 226, 0.0)');

    const gradientSecondary = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSecondary.addColorStop(0, 'rgba(65, 71, 83, 0.05)');
    gradientSecondary.addColorStop(1, 'rgba(65, 71, 83, 0.0)');

    this.mainChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Market Price (USD)',
            data: prices,
            borderColor: '#1275e2',
            backgroundColor: gradientPrimary,
            fill: true,
            tension: 0.4,
            borderWidth: 2.5,
            pointRadius: 3,
            pointHoverRadius: 6,
          },
          {
            label: '3-Day SMA Trendline',
            data: sma,
            borderColor: '#717785',
            backgroundColor: gradientSecondary,
            fill: true,
            tension: 0.4,
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            pointHoverRadius: 6,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index',
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              color: legendColor,
              font: { family: 'Inter', size: 11, weight: '500' },
              boxWidth: 12,
              padding: 20
            }
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#1275e2',
            bodyColor: '#181c22',
            borderColor: '#e0e2ec',
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            titleFont: { weight: 'bold' },
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: tickColor,
              font: { family: 'Inter', size: 10 }
            }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: tickColor,
              font: { family: 'Inter', size: 10 }
            }
          }
        }
      }
    });
  }

  public onThemeChanged(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    if (isPlatformBrowser(this.platformId)) {
      this.loadHistoryData();
    }
  }
}
