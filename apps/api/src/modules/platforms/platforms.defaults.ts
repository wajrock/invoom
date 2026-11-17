import type {Platform} from './platform.schema.ts';

/** Usual sites a micro-entrepreneur needs, offered in one click while the list is empty. */
export const DEFAULT_PLATFORMS: Platform[] = [
    {
        name: 'URSSAF auto-entrepreneur',
        url: 'https://www.autoentrepreneur.urssaf.fr',
        category: 'Administratif',
        description: 'Déclarations de CA et paiement des cotisations',
        login: '',
    },
    {
        name: 'impots.gouv – Professionnel',
        url: 'https://cfspro.impots.gouv.fr',
        category: 'Administratif',
        description: 'CFE, messagerie pro',
        login: '',
    },
    {
        name: 'impots.gouv – Particulier',
        url: 'https://cfspart.impots.gouv.fr',
        category: 'Administratif',
        description: 'Déclaration de revenus (2042-C-PRO)',
        login: '',
    },
    {
        name: 'Annuaire des entreprises',
        url: 'https://annuaire-entreprises.data.gouv.fr',
        category: 'Administratif',
        description: 'Extrait SIRENE / avis de situation',
        login: '',
    },
    {
        name: 'Guichet unique INPI',
        url: 'https://procedures.inpi.fr',
        category: 'Administratif',
        description: 'Modifications de l’entreprise',
        login: '',
    },
];
