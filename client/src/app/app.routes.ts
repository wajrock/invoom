import type { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Connexion · Freelance Hub',
    loadComponent: () => import('./pages/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Tableau de bord · Freelance Hub',
        loadComponent: () => import('./pages/dashboard').then((m) => m.DashboardPage),
      },
      {
        path: 'paiements',
        title: 'Paiements · Freelance Hub',
        loadComponent: () => import('./pages/payments').then((m) => m.PaymentsPage),
      },
      {
        path: 'clients',
        title: 'Clients · Freelance Hub',
        loadComponent: () => import('./pages/clients').then((m) => m.ClientsPage),
      },
      {
        path: 'prestations',
        title: 'Prestations · Freelance Hub',
        loadComponent: () => import('./pages/services').then((m) => m.ServicesPage),
      },
      {
        path: 'echeances',
        title: 'Échéances · Freelance Hub',
        loadComponent: () => import('./pages/deadlines').then((m) => m.DeadlinesPage),
      },
      {
        path: 'plateformes',
        title: 'Plateformes · Freelance Hub',
        loadComponent: () => import('./pages/platforms').then((m) => m.PlatformsPage),
      },
      {
        path: 'entreprise',
        title: 'Entreprise · Freelance Hub',
        loadComponent: () => import('./pages/company').then((m) => m.CompanyPage),
      },
      {
        path: 'parametres',
        title: 'Paramètres · Freelance Hub',
        loadComponent: () => import('./pages/settings').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
