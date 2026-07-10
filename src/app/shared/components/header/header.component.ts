import { ChangeDetectionStrategy, Component, EventEmitter, Inject, OnInit, Output, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { MarketDataService } from '../../../services/market-data-service';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HeaderComponent implements OnInit {
  @Output() themeChanged = new EventEmitter<boolean>();

  public isDarkMode = signal<boolean>(false);
  public currentUrl = signal<string>('');

  constructor(
    private marketDataService: MarketDataService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentUrl.set(event.urlAfterRedirects || event.url || '');
    });
  }

  ngOnInit(): void {
    this.currentUrl.set(this.router.url);

    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = savedTheme === 'dark' || (!savedTheme && systemDark);
      if (useDark) {
        document.documentElement.classList.add('dark');
        this.isDarkMode.set(true);
        this.marketDataService.isDarkMode.set(true);
      } else {
        document.documentElement.classList.remove('dark');
        this.isDarkMode.set(false);
        this.marketDataService.isDarkMode.set(false);
      }
      this.themeChanged.emit(useDark);
    }
  }

  public toggleTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const doc = document.documentElement;
      let dark = false;
      if (doc.classList.contains('dark')) {
        doc.classList.remove('dark');
        this.isDarkMode.set(false);
        this.marketDataService.isDarkMode.set(false);
        localStorage.setItem('theme', 'light');
      } else {
        doc.classList.add('dark');
        this.isDarkMode.set(true);
        this.marketDataService.isDarkMode.set(true);
        dark = true;
        localStorage.setItem('theme', 'dark');
      }
      this.themeChanged.emit(dark);
    }
  }
}
