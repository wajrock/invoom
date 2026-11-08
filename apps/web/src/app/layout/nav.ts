import {
    lucideBuilding2,
    lucideCalendarClock,
    lucideLayoutDashboard,
    lucideLink,
    lucidePackage,
    lucideReceiptEuro,
    lucideSettings,
    lucideShieldCheck,
    lucideUsers,
} from '@ng-icons/lucide';

export interface NavItem {
    path: string;
    label: string;
    /** Short label for the mobile tab bar */
    short?: string;
    icon: string;
}

export const NAV_ICONS = {
    lucideLayoutDashboard,
    lucideReceiptEuro,
    lucideUsers,
    lucidePackage,
    lucideCalendarClock,
    lucideLink,
    lucideBuilding2,
    lucideSettings,
    lucideShieldCheck,
};

export const NAV: NavItem[] = [
    {path: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'lucideLayoutDashboard'},
    {path: '/paiements', label: 'Paiements', icon: 'lucideReceiptEuro'},
    {path: '/clients', label: 'Clients', icon: 'lucideUsers'},
    {path: '/prestations', label: 'Prestations', icon: 'lucidePackage'},
    {path: '/echeances', label: 'Échéances', icon: 'lucideCalendarClock'},
    {path: '/plateformes', label: 'Plateformes', icon: 'lucideLink'},
    {path: '/entreprise', label: 'Entreprise', icon: 'lucideBuilding2'},
    {path: '/parametres', label: 'Paramètres fiscaux', icon: 'lucideSettings'},
    {path: '/securite', label: 'Sécurité', icon: 'lucideShieldCheck'},
];

/** Main tabs on mobile; the other entries go into the "Plus" sheet */
const TAB_PATHS = ['/', '/paiements', '/clients', '/echeances'];

export const TABS = TAB_PATHS.map((p) => NAV.find((n) => n.path === p)!);
export const MORE = NAV.filter((n) => !TAB_PATHS.includes(n.path));

/** Page name shown in the menu, reused as the browser tab title so both always match. */
export function navLabel(path: string): string {
    const item = NAV.find((i) => i.path === path);
    if (!item) throw new Error(`No navigation entry for ${path}`);
    return item.label;
}
