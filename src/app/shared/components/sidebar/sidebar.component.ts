import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  standalone: true,
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  public menuItems = [
    { label: 'Dashboard', route: '/dashboard', icon: 'home' },
    { label: 'Analytics', route: '/analytics', icon: 'analytics' },
    { label: 'Calculator', route: '/calculator', icon: 'calculate' }
  ];
}
