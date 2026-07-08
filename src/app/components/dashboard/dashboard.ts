import { ChangeDetectionStrategy, Component, ElementRef, Inject, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, ViewChild, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MarketDataService } from '../../services/market-data-service';
import { Currency } from '../../models/currency.enum';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

declare var Chart: any;
declare var THREE: any;

@Component({
  standalone: true,
  selector: 'dashboard',
  imports: [CommonModule, RouterLink, HeaderComponent, FooterComponent],
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('chartGold', { static: false }) chartGoldCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartEuro', { static: false }) chartEuroCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartTether', { static: false }) chartTetherCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvas3dContainer', { static: false }) canvas3dContainer!: ElementRef<HTMLDivElement>;

  // Three.js instances
  private threeScene: any;
  private threeCamera: any;
  private threeRenderer: any;
  private threeGlobe: any;
  private threeRing1: any;
  private threeRing2: any;
  private resizeObserver: any;
  private animationFrameId: number | null = null;
  private mouseX = 0;
  private mouseY = 0;

  // Real API Price & Rate states
  public goldPrice = signal<number>(2333.30);
  public goldChange = signal<number>(1.24);

  public euroRate = signal<number>(1.0943);
  public euroChange = signal<number>(0.05);

  public tetherRate = signal<number>(0.9998);
  public tetherChange = signal<number>(-0.02);

  // Status & Warning flags
  public isServiceLoading: any;
  public serviceError: any;
  public apiWarning = signal<boolean>(false);
  public isDarkMode = signal<boolean>(false);


  // Chart objects
  private charts: { [key: string]: any } = {
    gold: null,
    euro: null,
    tether: null
  };

  // Sparkline coordinates loaded from APIs (defaults shown on first load)
  private goldDataPoints = [2340, 2345, 2342, 2355, 2350, 2358, 2333.30];
  private euroDataPoints = [1.0910, 1.0915, 1.0925, 1.0918, 1.0920, 1.0922, 1.0943];
  private tetherDataPoints = [1.0001, 0.9999, 1.0000, 0.9997, 0.9998, 0.9999, 0.9998];

  constructor(
    private marketDataService: MarketDataService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isServiceLoading = this.marketDataService.isLoading;
    this.serviceError = this.marketDataService.error;
  }

  ngOnInit(): void {
    this.fetchMarketData();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.init3DVisualizer();
    }
  }

  ngOnDestroy(): void {
    Object.keys(this.charts).forEach(key => {
      if (this.charts[key]) {
        this.charts[key].destroy();
      }
    });

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    try {
      if (this.threeGlobe) {
        this.threeGlobe.geometry.dispose();
        this.threeGlobe.material.dispose();
      }
      if (this.threeRing1) {
        this.threeRing1.geometry.dispose();
        this.threeRing1.material.dispose();
      }
      if (this.threeRing2) {
        this.threeRing2.geometry.dispose();
        this.threeRing2.material.dispose();
      }
      if (this.threeRenderer) {
        this.threeRenderer.dispose();
      }
    } catch (e) {
      console.warn('Error disposing Three.js resources:', e);
    }
  }

  public fetchMarketData(): void {
    this.marketDataService.isLoading.set(true);
    this.apiWarning.set(false);

    // 1. Fetch Gold Spot & Daily History
    this.marketDataService.getGoldSpot().subscribe({
      next: (spot) => {
        if (this.isRateLimit(spot)) {
          this.handleRateLimit();
          return;
        }
        if (spot && spot.price) {
          this.goldPrice.set(parseFloat(spot.price));
        }
        this.fetchGoldHistory();
      },
      error: () => this.handleRateLimit()
    });

    // 2. Fetch EUR/USD Exchange Rate & Daily History
    this.marketDataService.getExchangeRate(Currency.EUR, Currency.USD).subscribe({
      next: (rate) => {
        if (this.isRateLimit(rate)) {
          this.handleRateLimit();
          return;
        }
        if (rate && rate['Realtime Currency Exchange Rate']) {
          const val = parseFloat(rate['Realtime Currency Exchange Rate']['5. Exchange Rate']);
          this.euroRate.set(val);
        }
        this.fetchEuroHistory();
      },
      error: () => this.handleRateLimit()
    });

    // 3. Fetch USDT/USD Rate & History
    this.marketDataService.getUsdtRate().subscribe({
      next: (rate) => {
        if (this.isRateLimit(rate)) {
          this.handleRateLimit();
          return;
        }
        if (rate && rate['Realtime Currency Exchange Rate']) {
          const val = parseFloat(rate['Realtime Currency Exchange Rate']['5. Exchange Rate']);
          this.tetherRate.set(val);
        }
        this.fetchTetherHistory();
      },
      error: () => this.handleRateLimit()
    });
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
    // Read spot values
    const cachedGold = this.marketDataService.getFromCache('goldSpot');
    if (cachedGold && cachedGold.price) {
      this.goldPrice.set(parseFloat(cachedGold.price));
    }
    const cachedEuro = this.marketDataService.getFromCache(`exchange_${Currency.EUR}_${Currency.USD}`);
    if (cachedEuro && cachedEuro['Realtime Currency Exchange Rate']) {
      this.euroRate.set(parseFloat(cachedEuro['Realtime Currency Exchange Rate']['5. Exchange Rate']));
    }
    const cachedTether = this.marketDataService.getFromCache('usdtRate');
    if (cachedTether && cachedTether['Realtime Currency Exchange Rate']) {
      this.tetherRate.set(parseFloat(cachedTether['Realtime Currency Exchange Rate']['5. Exchange Rate']));
    }

    // Read history sparklines
    const cachedGoldHist = this.marketDataService.getFromCache('goldHistory_daily');
    if (cachedGoldHist && cachedGoldHist.data) {
      const pts = cachedGoldHist.data.map((d: any) => parseFloat(d.price)).reverse().slice(-7);
      this.goldDataPoints = pts;
      this.calculateChange('gold', this.goldPrice(), pts);
    }
    const cachedEuroHist = this.marketDataService.getFromCache(`fxDaily_${Currency.EUR}_${Currency.USD}`);
    if (cachedEuroHist && cachedEuroHist['Time Series FX (Daily)']) {
      const series = cachedEuroHist['Time Series FX (Daily)'];
      const keys = Object.keys(series).reverse().slice(-7);
      const pts = keys.map(k => parseFloat(series[k]['4. close']));
      this.euroDataPoints = pts;
      this.calculateChange('euro', this.euroRate(), pts);
    }
    const cachedTetherHist = this.marketDataService.getFromCache('usdtHistory');
    if (cachedTetherHist && cachedTetherHist['Time Series (Digital Currency Daily)']) {
      const series = cachedTetherHist['Time Series (Digital Currency Daily)'];
      const keys = Object.keys(series).reverse().slice(-7);
      const pts = keys.map(k => parseFloat(series[k]['4. close']));
      this.tetherDataPoints = pts;
      this.calculateChange('tether', this.tetherRate(), pts);
    }

    this.initCharts();
  }

  private fetchGoldHistory(): void {
    this.marketDataService.getGoldHistory('daily').subscribe({
      next: (res) => {
        if (this.isRateLimit(res)) {
          this.handleRateLimit();
          return;
        }
        if (res && res.data) {
          const pts = res.data.map(d => parseFloat(d.price)).reverse().slice(-7);
          this.goldDataPoints = pts;
          this.calculateChange('gold', this.goldPrice(), pts);
          if (isPlatformBrowser(this.platformId)) {
            this.rebuildChart('gold', pts);
          }
        }
        this.marketDataService.isLoading.set(false);
      },
      error: () => this.handleRateLimit()
    });
  }

  private fetchEuroHistory(): void {
    this.marketDataService.getFxDaily(Currency.EUR, Currency.USD).subscribe({
      next: (res) => {
        if (this.isRateLimit(res)) {
          this.handleRateLimit();
          return;
        }
        const series = res ? res['Time Series FX (Daily)'] : null;
        if (series) {
          const keys = Object.keys(series).reverse().slice(-7);
          const pts = keys.map(k => parseFloat(series[k]['4. close']));
          this.euroDataPoints = pts;
          this.calculateChange('euro', this.euroRate(), pts);
          if (isPlatformBrowser(this.platformId)) {
            this.rebuildChart('euro', pts);
          }
        }
        this.marketDataService.isLoading.set(false);
      },
      error: () => this.handleRateLimit()
    });
  }

  private fetchTetherHistory(): void {
    this.marketDataService.getUsdtHistory().subscribe({
      next: (res) => {
        if (this.isRateLimit(res)) {
          this.handleRateLimit();
          return;
        }
        const series = res ? res['Time Series (Digital Currency Daily)'] : null;
        if (series) {
          const keys = Object.keys(series).reverse().slice(-7);
          const pts = keys.map(k => parseFloat(series[k]['4. close']));
          this.tetherDataPoints = pts;
          this.calculateChange('tether', this.tetherRate(), pts);
          if (isPlatformBrowser(this.platformId)) {
            this.rebuildChart('tether', pts);
          }
        }
        this.marketDataService.isLoading.set(false);
      },
      error: () => this.handleRateLimit()
    });
  }

  private calculateChange(asset: 'gold' | 'euro' | 'tether', current: number, history: number[]): void {
    if (history && history.length >= 2) {
      const prevClose = history[history.length - 2];
      if (prevClose > 0) {
        const change = ((current - prevClose) / prevClose) * 100;
        if (asset === 'gold') this.goldChange.set(change);
        else if (asset === 'euro') this.euroChange.set(change);
        else if (asset === 'tether') this.tetherChange.set(change);
      }
    }
  }

  private initCharts(): void {
    if (this.chartGoldCanvas) {
      this.charts['gold'] = this.createSparkline(this.chartGoldCanvas.nativeElement, '#f59e0b', this.goldDataPoints);
    }
    if (this.chartEuroCanvas) {
      this.charts['euro'] = this.createSparkline(this.chartEuroCanvas.nativeElement, '#2563eb', this.euroDataPoints);
    }
    if (this.chartTetherCanvas) {
      this.charts['tether'] = this.createSparkline(this.chartTetherCanvas.nativeElement, '#0d9488', this.tetherDataPoints);
    }
  }

  private rebuildChart(key: string, pts: number[]): void {
    if (this.charts[key]) {
      this.charts[key].destroy();
    }
    const canvas = key === 'gold' ? this.chartGoldCanvas : key === 'euro' ? this.chartEuroCanvas : this.chartTetherCanvas;
    const color = key === 'gold' ? '#f59e0b' : key === 'euro' ? '#2563eb' : '#0d9488';
    if (canvas) {
      this.charts[key] = this.createSparkline(canvas.nativeElement, color, pts);
    }
  }

  private createSparkline(canvas: HTMLCanvasElement, color: string, dataPoints: number[]): any {
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    return new Chart(ctx, {
      type: 'line',
      data: {
        labels: new Array(dataPoints.length).fill(''),
        datasets: [{
          data: [...dataPoints],
          borderColor: color,
          borderWidth: 2.5,
          pointRadius: 0,
          fill: true,
          backgroundColor: (context: any) => {
            const gradient = context.chart.ctx.createLinearGradient(0, 0, 0, 100);
            gradient.addColorStop(0, color + '22');
            gradient.addColorStop(1, color + '00');
            return gradient;
          },
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
      }
    });
  }


  public onThemeChanged(isDark: boolean): void {
    this.isDarkMode.set(isDark);
    if (isPlatformBrowser(this.platformId)) {
      if (this.threeGlobe && this.threeGlobe.material) {
        this.threeGlobe.material.color.setHex(isDark ? 0x60a5fa : 0x1d4ed8);
      }
    }
  }

  private init3DVisualizer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.canvas3dContainer) return;

    try {
      const container = this.canvas3dContainer.nativeElement;
      const width = container.clientWidth || 300;
      const height = container.clientHeight || 250;

      // Scene
      this.threeScene = new THREE.Scene();

      // Camera
      this.threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
      this.threeCamera.position.z = 5;

      // Renderer
      this.threeRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.threeRenderer.setSize(width, height);
      this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(this.threeRenderer.domElement);

      // Sphere (Globe)
      const globeGeometry = new THREE.SphereGeometry(1.5, 20, 20);
      const isDark = document.documentElement.classList.contains('dark');
      const globeColor = isDark ? 0x60a5fa : 0x1d4ed8;

      const globeMaterial = new THREE.MeshBasicMaterial({
        color: globeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      this.threeGlobe = new THREE.Mesh(globeGeometry, globeMaterial);
      this.threeScene.add(this.threeGlobe);

      // Financial Orbit Ring 1 (Gold/Amber theme color)
      const ring1Geometry = new THREE.RingGeometry(1.7, 1.71, 64);
      const ring1Material = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4
      });
      this.threeRing1 = new THREE.Mesh(ring1Geometry, ring1Material);
      this.threeRing1.rotation.x = Math.PI / 2.5;
      this.threeScene.add(this.threeRing1);

      // Financial Orbit Ring 2 (Teal theme color)
      const ring2Geometry = new THREE.RingGeometry(1.9, 1.91, 64);
      const ring2Material = new THREE.MeshBasicMaterial({
        color: 0x0d9488,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
      });
      this.threeRing2 = new THREE.Mesh(ring2Geometry, ring2Material);
      this.threeRing2.rotation.x = -Math.PI / 3.5;
      this.threeRing2.rotation.y = Math.PI / 8;
      this.threeScene.add(this.threeRing2);

      // Orbit points (particles) for extra fintech analytics feel
      const particleGeo = new THREE.BufferGeometry();
      const particleCount = 40;
      const posArray = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 1.5;
        posArray[i] = r * Math.sin(phi) * Math.cos(theta);
        posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        posArray[i + 2] = r * Math.cos(phi);
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      const particleMat = new THREE.PointsMaterial({
        size: 0.05,
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.8
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      this.threeScene.add(particles);

      // Render Loop
      const animate = () => {
        this.animationFrameId = requestAnimationFrame(animate);

        this.threeGlobe.rotation.y += 0.002;
        this.threeGlobe.rotation.x += 0.0005;
        this.threeRing1.rotation.z -= 0.003;
        this.threeRing2.rotation.z += 0.002;
        particles.rotation.y -= 0.001;

        const targetX = this.mouseX * 0.4;
        const targetY = this.mouseY * 0.4;
        this.threeGlobe.rotation.y += (targetX - this.threeGlobe.rotation.y) * 0.05;
        this.threeGlobe.rotation.x += (targetY - this.threeGlobe.rotation.x) * 0.05;

        this.threeRenderer.render(this.threeScene, this.threeCamera);
      };
      animate();

      // Mouse movements
      container.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        this.mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      });

      container.addEventListener('mouseleave', () => {
        this.mouseX = 0;
        this.mouseY = 0;
      });

      // Resize observer
      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          const w = container.clientWidth;
          const h = container.clientHeight;
          if (w && h) {
            this.threeCamera.aspect = w / h;
            this.threeCamera.updateProjectionMatrix();
            this.threeRenderer.setSize(w, h);
          }
        });
        this.resizeObserver.observe(container);
      }

    } catch (err) {
      console.warn('Failed to initialize Three.js visualizer:', err);
    }
  }
}
