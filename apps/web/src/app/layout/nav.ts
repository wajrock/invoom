import {
    lucideBuilding2,
    lucideCalculator,
    lucideCalendarClock,
    lucideLandmark,
    lucideLayoutDashboard,
    lucidePackage,
    lucidePercent,
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

/** Menu section; the first one has no title. */
export interface NavGroup {
    label?: string;
    items: NavItem[];
}

export const NAV_ICONS = {
    lucideLayoutDashboard,
    lucideReceiptEuro,
    lucideCalendarClock,
    lucideUsers,
    lucidePackage,
    lucideCalculator,
    lucideLandmark,
    lucideSettings,
    lucideBuilding2,
    lucidePercent,
    lucideShieldCheck,
};

export const NAV_GROUPS: NavGroup[] = [
    {items: [{path: '/', label: 'Tableau de bord', short: 'Accueil', icon: 'lucideLayoutDashboard'}]},
    {
        label: 'Activité',
        items: [
            {path: '/paiements', label: 'Paiements', icon: 'lucideReceiptEuro'},
            {path: '/echeances', label: 'Échéances', icon: 'lucideCalendarClock'},
        ],
    },
    {
        label: 'Facturation',
        items: [
            {path: '/clients', label: 'Clients', icon: 'lucideUsers'},
            {path: '/prestations', label: 'Prestations', icon: 'lucidePackage'},
        ],
    },
    {
        label: 'Outils',
        items: [
            {path: '/simulateur', label: 'Simulateur', icon: 'lucideCalculator'},
            {path: '/demarches', label: 'Démarches', icon: 'lucideLandmark'},
        ],
    },
];

/** Set once and rarely changed: kept out of the main menu, with its own tabs. */
export const SETTINGS: NavItem = {path: '/parametres', label: 'Paramètres', icon: 'lucideSettings'};

export const SETTINGS_TABS: NavItem[] = [
    {path: '/parametres/entreprise', label: 'Entreprise', icon: 'lucideBuilding2'},
    {path: '/parametres/fiscalite', label: 'Fiscalité', icon: 'lucidePercent'},
    {path: '/parametres/securite', label: 'Sécurité', icon: 'lucideShieldCheck'},
];

const ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS];

/** Main tabs on mobile; the other entries go into the "Plus" sheet */
const TAB_PATHS = ['/', '/paiements', '/clients', '/echeances'];

export const TABS = TAB_PATHS.map((p) => ITEMS.find((n) => n.path === p)!);

/** "Plus" sheet: the same sections without the tab bar entries, settings last. */
export const MORE_GROUPS: NavGroup[] = [
    ...NAV_GROUPS.map((g) => ({...g, items: g.items.filter((i) => !TAB_PATHS.includes(i.path))})).filter(
        (g) => g.items.length,
    ),
    {items: [SETTINGS]},
];

/** Page name shown in the menu, reused as the browser tab title so both always match. */
export function navLabel(path: string): string {
    const item = [...ITEMS, ...SETTINGS_TABS].find((i) => i.path === path);
    if (!item) throw new Error(`No navigation entry for ${path}`);
    return item.label;
}
