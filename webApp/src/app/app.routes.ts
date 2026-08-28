import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'roster',
    loadComponent: () => import('./features/roster/roster.component').then((m) => m.RosterComponent)
  },
  {
    path: 'captura',
    loadComponent: () =>
      import('./features/weekly-capture/weekly-capture.component').then((m) => m.WeeklyCaptureComponent)
  },
  {
    path: 'equipos',
    loadComponent: () =>
      import('./features/team-balancer/team-balancer.component').then((m) => m.TeamBalancerComponent)
  },
  {
    path: 'convocatoria',
    loadComponent: () =>
      import('./features/convocatoria/convocatoria.component').then((m) => m.ConvocatoriaComponent)
  },
  {
    path: 'ajustes',
    loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent)
  },
  { path: '**', redirectTo: '' }
];
