import { ChangeDetectionStrategy, Component, EventEmitter, Inject, Input, OnInit, Output, PLATFORM_ID, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-header',
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {
  @Input() showBackButton = false;
  @Input() showLiveFeed = false;
  @Output() themeChanged = new EventEmitter<boolean>();

  public isDarkMode = signal<boolean>(false);

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem('theme');
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const useDark = savedTheme === 'dark' || (!savedTheme && systemDark);
      if (useDark) {
        document.documentElement.classList.add('dark');
        this.isDarkMode.set(true);
      } else {
        document.documentElement.classList.remove('dark');
        this.isDarkMode.set(false);
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
        localStorage.setItem('theme', 'light');
      } else {
        doc.classList.add('dark');
        this.isDarkMode.set(true);
        dark = true;
        localStorage.setItem('theme', 'dark');
      }
      this.themeChanged.emit(dark);
    }
  }
}
