import { Routes } from '@angular/router';
export const routes: Routes = [
  { path: 'dashboard', loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard) },
  { path: 'analytics', loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent) },
  { path: 'calculator', loadComponent: () => import('./components/calculator/calculator').then(m => m.CalculatorComponent) },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' }
];
