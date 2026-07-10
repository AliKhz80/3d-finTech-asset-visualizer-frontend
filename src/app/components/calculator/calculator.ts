import { ChangeDetectionStrategy, Component, Inject, OnInit, PLATFORM_ID, signal, computed } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketDataService } from '../../services/market-data-service';
import { Currency } from '../../models/currency.enum';

@Component({
  standalone: true,
  selector: 'app-calculator',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-gutter lg:p-xl space-y-gutter flex-1 max-w-[800px] mx-auto w-full flex flex-col gap-6 pt-6">
      
      <!-- Calculator Main Panel -->
      <div class="glass-panel p-6 md:p-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low/40 flex flex-col gap-6">
        
        <!-- Header Section -->
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-2xl">calculate</span>
          </div>
          <div>
            <h2 class="text-xl font-bold text-on-surface">Money Exchange Calculator</h2>
            <p class="text-xs text-on-surface-variant">Real-time exchange ratios powered by AlphaVantage</p>
          </div>
        </div>

        <!-- Telemetry HUD showing current live conversion rates -->
        <div class="grid grid-cols-3 gap-2 bg-surface-container/30 border border-outline-variant/20 p-4 rounded-xl text-xs font-mono">
          <div class="flex flex-col gap-1">
            <span class="text-[9px] text-on-surface-variant uppercase tracking-widest">EUR / USD</span>
            <span class="font-bold text-on-surface font-mono-data">
              {{ isRatesLoading() ? '...' : (eurRate() | number:'1.4-4') }}
            </span>
          </div>
          <div class="flex flex-col gap-1 border-x border-outline-variant/30 px-3 md:px-4">
            <span class="text-[9px] text-on-surface-variant uppercase tracking-widest">USDT / USD</span>
            <span class="font-bold text-on-surface font-mono-data">
              {{ isRatesLoading() ? '...' : (usdtRate() | number:'1.4-4') }}
            </span>
          </div>
          <div class="flex flex-col gap-1 pl-3 md:pl-4">
            <span class="text-[9px] text-on-surface-variant uppercase tracking-widest">GOLD / USD</span>
            <span class="font-bold text-on-surface font-mono-data text-amber-500 dark:text-amber-400">
              {{ isRatesLoading() ? '...' : (goldRate() | number:'1.2-2') }}
            </span>
          </div>
        </div>

        <!-- Interactive Calculator Form -->
        <div class="flex flex-col gap-4 relative">
          
          <!-- Amount Input Card -->
          <div class="flex flex-col gap-1.5">
            <label for="calc-amount" class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Amount</label>
            <div class="relative rounded-xl overflow-hidden bg-surface-container border border-outline-variant/30 hover:border-primary/50 transition-all">
              <input 
                id="calc-amount"
                type="number"
                min="0"
                [ngModel]="amount()"
                (ngModelChange)="amount.set($event)"
                class="w-full bg-transparent px-4 py-3.5 text-on-surface font-mono-data text-lg focus:outline-none"
                placeholder="Enter amount..."
              />
            </div>
          </div>

          <!-- Currency Exchange Selector Cards -->
          <div class="grid grid-cols-1 md:grid-cols-9 gap-4 items-center">
            
            <!-- Source Currency -->
            <div class="md:col-span-4 flex flex-col gap-1.5">
              <label for="from-currency" class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">From</label>
              <div class="relative bg-surface-container border border-outline-variant/30 rounded-xl overflow-hidden">
                <select 
                  id="from-currency"
                  [ngModel]="fromCurrency()"
                  (ngModelChange)="fromCurrency.set($event)"
                  class="w-full bg-transparent px-4 py-3.5 pr-10 text-on-surface text-sm focus:outline-none cursor-pointer appearance-none dark:bg-slate-900"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USDT">USDT - Tether</option>
                  <option value="GOLD">XAU - Gold Ounce</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">arrow_drop_down</span>
              </div>
            </div>

            <!-- Swap Currencies Trigger Button -->
            <div class="md:col-span-1 flex justify-center pt-5">
              <button (click)="swapCurrencies()" class="w-10 h-10 rounded-full bg-surface-container hover:bg-primary hover:text-white border border-outline-variant/30 hover:border-primary flex items-center justify-center text-on-surface transition-all shadow-sm cursor-pointer" aria-label="Swap Currencies">
                <span class="material-symbols-outlined text-lg">swap_horiz</span>
              </button>
            </div>

            <!-- Destination Currency -->
            <div class="md:col-span-4 flex flex-col gap-1.5">
              <label for="to-currency" class="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">To</label>
              <div class="relative bg-surface-container border border-outline-variant/30 rounded-xl overflow-hidden">
                <select 
                  id="to-currency"
                  [ngModel]="toCurrency()"
                  (ngModelChange)="toCurrency.set($event)"
                  class="w-full bg-transparent px-4 py-3.5 pr-10 text-on-surface text-sm focus:outline-none cursor-pointer appearance-none dark:bg-slate-900"
                >
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="USDT">USDT - Tether</option>
                  <option value="GOLD">XAU - Gold Ounce</option>
                </select>
                <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant">arrow_drop_down</span>
              </div>
            </div>

          </div>

        </div>

        <!-- Calculated Live Result Box -->
        <div class="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center mt-4">
          <span class="text-xs text-on-surface-variant uppercase tracking-wider mb-2">Calculated Exchange Value</span>
          <div class="font-mono-data font-extrabold text-2xl md:text-3xl text-primary mb-1">
            {{ (amount() || 0) | number:'1.2-4' }} {{ fromCurrency() }} = {{ result() | number:'1.2-4' }} {{ toCurrency() }}
          </div>
          <p class="text-[10px] text-on-surface-variant font-mono">
            1 {{ fromCurrency() }} = {{ (result() / ((amount() || 1) || 1)) | number:'1.2-6' }} {{ toCurrency() }}
          </p>
        </div>

      </div>

    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit {
  // Conversion Rates (Default fallback values matching global defaults)
  public eurRate = signal<number>(1.0943);
  public usdtRate = signal<number>(0.9998);
  public goldRate = signal<number>(2333.30);
  public isRatesLoading = signal<boolean>(false);

  // Form Inputs
  public amount = signal<number>(1);
  public fromCurrency = signal<string>('EUR');
  public toCurrency = signal<string>('USD');

  // Reactive Conversion Logic
  public result = computed(() => {
    const amt = this.amount();
    const from = this.fromCurrency();
    const to = this.toCurrency();

    if (amt <= 0) return 0;

    // 1. Convert source currency to USD
    let amountInUSD = amt;
    if (from === 'EUR') {
      amountInUSD = amt * this.eurRate();
    } else if (from === 'USDT') {
      amountInUSD = amt * this.usdtRate();
    } else if (from === 'GOLD') {
      amountInUSD = amt * this.goldRate();
    }

    // 2. Convert USD to destination currency
    let finalResult = amountInUSD;
    if (to === 'EUR') {
      finalResult = amountInUSD / this.eurRate();
    } else if (to === 'USDT') {
      finalResult = amountInUSD / this.usdtRate();
    } else if (to === 'GOLD') {
      finalResult = amountInUSD / this.goldRate();
    }

    return finalResult;
  });

  constructor(
    private marketDataService: MarketDataService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchConversionRates();
    }
  }

  private fetchConversionRates(): void {
    this.isRatesLoading.set(true);

    // Fetch EUR spot rate
    this.marketDataService.getExchangeRate(Currency.EUR, Currency.USD).subscribe({
      next: (rate) => {
        if (rate && rate['Realtime Currency Exchange Rate']) {
          const exchangeRate = parseFloat(rate['Realtime Currency Exchange Rate']['5. Exchange Rate']);
          if (!isNaN(exchangeRate)) {
            this.eurRate.set(exchangeRate);
          }
        }
      }
    });

    // Fetch USDT spot rate
    this.marketDataService.getExchangeRate(Currency.USDT, Currency.USD).subscribe({
      next: (rate) => {
        if (rate && rate['Realtime Currency Exchange Rate']) {
          const exchangeRate = parseFloat(rate['Realtime Currency Exchange Rate']['5. Exchange Rate']);
          if (!isNaN(exchangeRate)) {
            this.usdtRate.set(exchangeRate);
          }
        }
      }
    });

    // Fetch GOLD spot rate
    this.marketDataService.getGoldSpot().subscribe({
      next: (spot) => {
        if (spot && spot.price) {
          const priceVal = parseFloat(spot.price);
          if (!isNaN(priceVal)) {
            this.goldRate.set(priceVal);
          }
        }
      },
      complete: () => {
        this.isRatesLoading.set(false);
      }
    });
  }

  public swapCurrencies(): void {
    const temp = this.fromCurrency();
    this.fromCurrency.set(this.toCurrency());
    this.toCurrency.set(temp);
  }
}
