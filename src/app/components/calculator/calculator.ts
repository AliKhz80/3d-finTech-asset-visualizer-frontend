import { ChangeDetectionStrategy, Component, ElementRef, Inject, OnInit, OnDestroy, AfterViewInit, PLATFORM_ID, ViewChild, signal, computed, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketDataService } from '../../services/market-data-service';
import { Currency } from '../../models/currency.enum';

declare var THREE: any;

@Component({
  standalone: true,
  selector: 'app-calculator',
  imports: [CommonModule, FormsModule],
  templateUrl: './calculator.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CalculatorComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('trading3dContainer', { static: false }) trading3dContainer!: ElementRef<HTMLDivElement>;

  // Three.js instances
  private scene: any;
  private camera: any;
  private renderer: any;
  private candlesticksGroup: any;
  private animationFrameId: number | null = null;
  private resizeObserver: any;
  private mouseX = 0;
  private mouseY = 0;

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
  ) {
    // Reactively update 3D Globe colors on theme changes
    effect(() => {
      const isDark = this.marketDataService.isDarkMode();
      if (isPlatformBrowser(this.platformId)) {
        if (this.candlesticksGroup && this.candlesticksGroup.children.length > 0) {
          const globeMesh = this.candlesticksGroup.children[0];
          if (globeMesh && globeMesh.material) {
            globeMesh.material.color.setHex(isDark ? 0x60a5fa : 0x1d4ed8);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.fetchConversionRates();
    }
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => {
        this.init3dTradingVisualizer();
      }, 50);
    }
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    try {
      if (this.scene) {
        this.scene.traverse((object: any) => {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((material: any) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });
      }
      if (this.renderer) {
        this.renderer.dispose();
      }
    } catch (err) {
      console.warn('Failed to dispose 3D trading visualizer resources:', err);
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

  private init3dTradingVisualizer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!this.trading3dContainer) return;

    try {
      const container = this.trading3dContainer.nativeElement;
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 300;

      // Scene
      this.scene = new THREE.Scene();

      // Camera
      this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
      this.camera.position.set(0, 0, 8);
      this.camera.lookAt(0, 0, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(this.renderer.domElement);

      // Group
      this.candlesticksGroup = new THREE.Group();
      this.scene.add(this.candlesticksGroup);

      // 1. Core Globe (Wireframe Sphere)
      const globeGeometry = new THREE.SphereGeometry(1.6, 24, 24);
      const isDark = document.documentElement.classList.contains('dark');
      const globeColor = isDark ? 0x60a5fa : 0x1d4ed8;
      const globeMaterial = new THREE.MeshBasicMaterial({
        color: globeColor,
        wireframe: true,
        transparent: true,
        opacity: 0.25
      });
      const globeMesh = new THREE.Mesh(globeGeometry, globeMaterial);
      this.candlesticksGroup.add(globeMesh);

      // 2. Latitude Ring
      const ring1Geometry = new THREE.RingGeometry(1.605, 1.615, 64);
      const ring1Material = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.3
      });
      const latRing = new THREE.Mesh(ring1Geometry, ring1Material);
      latRing.rotation.x = Math.PI / 2;
      this.candlesticksGroup.add(latRing);

      // 3. Financial Transaction Network Curves (Arching over the globe)
      const curveColor = 0x10b981; // Green
      const pointsArray = [
        { start: new THREE.Vector3(1.1, 0.9, 0.8), end: new THREE.Vector3(-1.1, -0.9, -0.8), peak: new THREE.Vector3(0, 2.2, 0) },
        { start: new THREE.Vector3(-1.1, 0.9, 0.8), end: new THREE.Vector3(1.1, -0.9, -0.8), peak: new THREE.Vector3(0, 2.2, 1.0) },
        { start: new THREE.Vector3(0.5, 1.4, -0.5), end: new THREE.Vector3(-0.5, -1.4, 0.5), peak: new THREE.Vector3(1.0, 0, 2.0) }
      ];

      pointsArray.forEach((pts) => {
        const curve = new THREE.QuadraticBezierCurve3(pts.start, pts.peak, pts.end);
        const curvePoints = curve.getPoints(30);
        const curveGeo = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const curveMat = new THREE.LineBasicMaterial({
          color: curveColor,
          transparent: true,
          opacity: 0.4
        });
        const line = new THREE.Line(curveGeo, curveMat);
        this.candlesticksGroup.add(line);
      });

      // 4. Orbiting Currency Asset Nodes (EUR, USD, USDT, GOLD)
      const nodeData = [
        { label: 'USD', color: 0x10b981, radius: 2.1, speed: 0.3 },
        { label: 'EUR', color: 0x3b82f6, radius: 2.5, speed: 0.2 },
        { label: 'USDT', color: 0x0d9488, radius: 1.8, speed: 0.45 },
        { label: 'GOLD', color: 0xf59e0b, radius: 2.9, speed: 0.15 }
      ];

      const nodeGroup = new THREE.Group();
      this.candlesticksGroup.add(nodeGroup);
      const meshes: any[] = [];

      nodeData.forEach((node) => {
        const nodeGeo = new THREE.SphereGeometry(0.09, 8, 8);
        const nodeMat = new THREE.MeshBasicMaterial({ color: node.color });
        const mesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeGroup.add(mesh);
        meshes.push(mesh);
      });

      // Render Loop
      const animate = () => {
        this.animationFrameId = requestAnimationFrame(animate);

        // Rotate globe group
        this.candlesticksGroup.rotation.y += 0.002;
        this.candlesticksGroup.rotation.x += 0.0003;

        // Position nodes in spherical orbit paths
        const time = Date.now() * 0.001;
        meshes.forEach((mesh, idx) => {
          const data = nodeData[idx];
          const angle = time * data.speed;
          mesh.position.x = Math.cos(angle) * data.radius;
          mesh.position.z = Math.sin(angle) * data.radius;
          mesh.position.y = Math.sin(angle * 0.5) * (data.radius * 0.2); // orbital tilt
        });

        // Mouse interactive orbital offsets
        const targetX = this.mouseX * 0.3;
        const targetY = this.mouseY * 0.3;
        this.candlesticksGroup.rotation.y += (targetX - this.candlesticksGroup.rotation.y) * 0.05;
        this.candlesticksGroup.rotation.x += (targetY - this.candlesticksGroup.rotation.x) * 0.05;

        this.renderer.render(this.scene, this.camera);
      };
      animate();

      // Mouse interactive capture
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
            this.camera.aspect = w / h;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(w, h);
          }
        });
        this.resizeObserver.observe(container);
      }

    } catch (e) {
      console.warn('Failed to initialize 3D World Globe visualizer:', e);
    }
  }

  public swapCurrencies(): void {
    const temp = this.fromCurrency();
    this.fromCurrency.set(this.toCurrency());
    this.toCurrency.set(temp);
  }
}
