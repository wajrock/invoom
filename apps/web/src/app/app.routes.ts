import type {Routes} from '@angular/router';
import {authGuard, guestGuard} from './core/auth/auth.guards';
import {Shell} from './layout/shell';

export const routes: Routes = [
    {
        path: 'login',
        canActivate: [guestGuard],
        title: 'Connexion · Invoom',
        loadComponent: () => import('./features/auth/login/login.page').then((m) => m.LoginPage),
    },
    {
        path: '',
        component: Shell,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                pathMatch: 'full',
                title: 'Tableau de bord · Invoom',
                loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
            },
            {
                path: 'paiements',
                title: 'Paiements · Invoom',
                loadComponent: () => import('./features/payments/payments.page').then((m) => m.PaymentsPage),
            },
            {
                path: 'clients',
                title: 'Clients · Invoom',
                loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage),
            },
            {
                path: 'prestations',
                title: 'Prestations · Invoom',
                loadComponent: () => import('./features/services/services.page').then((m) => m.ServicesPage),
            },
            {
                path: 'echeances',
                title: 'Échéances · Invoom',
                loadComponent: () => import('./features/deadlines/deadlines.page').then((m) => m.DeadlinesPage),
            },
            {
                path: 'plateformes',
                title: 'Plateformes · Invoom',
                loadComponent: () => import('./features/platforms/platforms.page').then((m) => m.PlatformsPage),
            },
            {
                path: 'entreprise',
                title: 'Entreprise · Invoom',
                loadComponent: () => import('./features/company/company.page').then((m) => m.CompanyPage),
            },
            {
                path: 'securite',
                title: 'Sécurité · Invoom',
                loadComponent: () => import('./features/auth/security/security.page').then((m) => m.SecurityPage),
            },
            {
                path: 'parametres',
                title: 'Paramètres · Invoom',
                loadComponent: () => import('./features/settings/tax-settings.page').then((m) => m.TaxSettingsPage),
            },
        ],
    },
    {path: '**', redirectTo: ''},
];
