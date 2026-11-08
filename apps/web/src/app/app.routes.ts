import type {Routes} from '@angular/router';
import {authGuard, guestGuard} from './core/auth/auth.guards';
import {navLabel} from './layout/nav';
import {Shell} from './layout/shell';

export const routes: Routes = [
    {
        path: 'login',
        canActivate: [guestGuard],
        title: 'Connexion',
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
                title: navLabel('/'),
                loadComponent: () => import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
            },
            {
                path: 'paiements',
                title: navLabel('/paiements'),
                loadComponent: () => import('./features/payments/payments.page').then((m) => m.PaymentsPage),
            },
            {
                path: 'clients',
                title: navLabel('/clients'),
                loadComponent: () => import('./features/clients/clients.page').then((m) => m.ClientsPage),
            },
            {
                path: 'prestations',
                title: navLabel('/prestations'),
                loadComponent: () => import('./features/services/services.page').then((m) => m.ServicesPage),
            },
            {
                path: 'echeances',
                title: navLabel('/echeances'),
                loadComponent: () => import('./features/deadlines/deadlines.page').then((m) => m.DeadlinesPage),
            },
            {
                path: 'simulateur',
                title: navLabel('/simulateur'),
                loadComponent: () => import('./features/simulator/simulator.page').then((m) => m.SimulatorPage),
            },
            {
                path: 'demarches',
                title: navLabel('/demarches'),
                loadComponent: () => import('./features/platforms/platforms.page').then((m) => m.PlatformsPage),
            },
            {
                path: 'parametres',
                loadComponent: () => import('./features/settings/settings.layout').then((m) => m.SettingsLayout),
                children: [
                    {path: '', pathMatch: 'full', redirectTo: 'entreprise'},
                    {
                        path: 'entreprise',
                        title: navLabel('/parametres/entreprise'),
                        loadComponent: () => import('./features/company/company.page').then((m) => m.CompanyPage),
                    },
                    {
                        path: 'fiscalite',
                        title: navLabel('/parametres/fiscalite'),
                        loadComponent: () =>
                            import('./features/settings/tax-settings.page').then((m) => m.TaxSettingsPage),
                    },
                    {
                        path: 'securite',
                        title: navLabel('/parametres/securite'),
                        loadComponent: () =>
                            import('./features/auth/security/security.page').then((m) => m.SecurityPage),
                    },
                ],
            },
            // Former addresses, kept for bookmarks and links already sent
            {path: 'plateformes', redirectTo: 'demarches'},
            {path: 'entreprise', redirectTo: 'parametres/entreprise'},
            {path: 'securite', redirectTo: 'parametres/securite'},
        ],
    },
    {path: '**', redirectTo: ''},
];
