import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideArrowLeft, lucideArrowRight, lucideInfo} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSwitchImports} from '@spartan-ng/helm/switch';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {HlmTooltipImports} from '@spartan-ng/helm/tooltip';
import {Auth} from '../../core/auth/auth.service';
import {errorMessage} from '../../core/http/error-message';
import {NavigationService} from '../../core/navigation/navigation.service';
import {BrandPattern} from '../../shared/ui/brand-pattern/brand-pattern';
import {DateInput} from '../../shared/ui/date-input/date-input';
import {FieldError} from '../../shared/ui/field-error/field-error';
import {Logo} from '../../shared/ui/logo/logo';
import {Spinner} from '../../shared/ui/spinner/spinner';
import {TaxSettingsApi} from '../settings/tax-settings.api';
import type {Activity, ActivityDefaults} from '../settings/tax-settings.models';
import {OnboardingApi} from './onboarding.api';
import {addressError, bicError, emailError, formatSiret, ibanError, siretError} from './onboarding.validation';

type Step = 'company' | 'activity' | 'bank';
type Field = 'name' | 'legal' | 'siret' | 'address' | 'email' | 'start' | 'holder' | 'iban' | 'bic' | 'bank';
type FieldErrors = Partial<Record<Field, string>>;

const STEPS: {id: Step; title: string; subtitle: string}[] = [
    {id: 'company', title: 'Ton entreprise', subtitle: 'Ces informations figurent en tête de chacune de tes factures.'},
    {
        id: 'activity',
        title: 'Ton activité',
        subtitle: 'Pour calculer tes cotisations, ton impôt et ce qu’il te reste.',
    },
    {
        id: 'bank',
        title: 'Être payé',
        subtitle: 'Tes coordonnées bancaires figurent sous le total de chaque facture, pour être payé par virement.',
    },
];

/**
 * First-run setup of a new account, required before the app: business details and bank details for the invoices,
 * the activity for the contributions. Sent once; afterwards everything is edited in the settings.
 */
@Component({
    selector: 'app-onboarding',
    imports: [
        FormsModule,
        NgIcon,
        HlmButtonImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSwitchImports,
        HlmTextareaImports,
        HlmTooltipImports,
        BrandPattern,
        DateInput,
        FieldError,
        Logo,
        Spinner,
    ],
    providers: [provideIcons({lucideArrowLeft, lucideArrowRight, lucideInfo})],
    templateUrl: './onboarding.page.html',
})
export class OnboardingPage {
    private readonly api = inject(OnboardingApi);
    private readonly auth = inject(Auth);
    private readonly nav = inject(NavigationService);

    protected readonly steps = STEPS;
    protected readonly index = signal(0);
    protected readonly step = computed(() => STEPS[this.index()]);
    /** Server or loading error, shown under the form */
    protected readonly error = signal('');
    /** Shown under each field once the user tried to continue; cleared as they edit it */
    protected readonly errors = signal<FieldErrors>({});
    protected readonly saving = signal(false);
    protected readonly activities = signal<ActivityDefaults[]>([]);

    protected readonly company = {
        name: '',
        legal: 'Entrepreneur individuel',
        siret: '',
        address: '',
        email: this.auth.email() ?? '',
        phone: '',
        iban: '',
        bic: '',
        bank: '',
        accountHolder: '',
    };
    protected readonly tax = {
        activity: 'bnc' as Activity,
        activityStart: `${new Date().getUTCFullYear()}-01-01`,
        versementLiberatoire: false,
    };

    constructor() {
        inject(TaxSettingsApi)
            .defaults()
            .then((list) => this.activities.set(list))
            .catch((err: unknown) => this.error.set(errorMessage(err)));
    }

    /** Problems of the current step's fields, in display order */
    private check(): FieldErrors {
        const c = this.company;
        const all: FieldErrors = {};
        switch (this.step().id) {
            case 'company':
                if (!c.name.trim())
                    all.name = 'Indique le nom de ton entreprise, ou tes prénom et nom si tu es en nom propre.';
                if (!c.legal.trim())
                    all.legal = 'Indique ta forme juridique (par exemple « Entrepreneur individuel »).';
                all.siret = siretError(c.siret);
                all.address = addressError(c.address);
                all.email = emailError(c.email);
                break;
            case 'activity':
                if (!this.tax.activityStart) all.start = 'Indique la date de début de ton activité (jj/mm/aaaa).';
                break;
            case 'bank':
                // Printed under the total of every invoice, for payment by transfer
                if (!c.accountHolder.trim())
                    all.holder = 'Indique le titulaire du compte, tel qu’il figure sur ton RIB.';
                all.iban = c.iban.trim() ? ibanError(c.iban) : 'Indique ton IBAN.';
                all.bic = bicError(c.bic);
                if (!c.bank.trim()) all.bank = 'Indique le nom de ta banque.';
                break;
        }
        return Object.fromEntries(Object.entries(all).filter(([, e]) => e)) as FieldErrors;
    }

    /** The user is fixing this field: its message goes away; the SIRET is checked as it is typed */
    protected edited(field: Field, value = '') {
        if (field === 'siret') {
            // Runs before ngModel writes the value: the new one comes as the event
            const error = value.trim() ? siretError(value) : '';
            this.errors.update((all) => {
                const rest = Object.fromEntries(Object.entries(all).filter(([k]) => k !== 'siret')) as FieldErrors;
                return error ? {...rest, siret: error} : rest;
            });
            return;
        }
        if (!this.errors()[field]) return;
        this.errors.update((all) => Object.fromEntries(Object.entries(all).filter(([k]) => k !== field)));
    }

    protected tidySiret() {
        this.company.siret = formatSiret(this.company.siret);
    }

    back() {
        this.error.set('');
        this.errors.set({});
        this.index.update((i) => Math.max(0, i - 1));
    }

    async next() {
        this.error.set('');
        const errors = this.check();
        this.errors.set(errors);
        const first = Object.keys(errors)[0];
        if (first) {
            // Straight to the first field to fix (screen readers then read its message)
            document.getElementById(`ob-${first}`)?.focus();
            return;
        }
        if (this.index() < STEPS.length - 1) {
            this.index.update((i) => i + 1);
            // Usually the business itself, for a sole trader: offered, still editable
            if (this.step().id === 'bank' && !this.company.accountHolder)
                this.company.accountHolder = this.company.name;
            return;
        }
        await this.finish();
    }

    private async finish() {
        this.saving.set(true);
        try {
            await this.api.complete({company: this.company, tax: this.tax});
            await this.auth.refresh();
            void this.auth.loadAccount(true);
            toast.success('Bienvenue sur Invoom');
            await this.nav.navigateByUrl('/');
        } catch (err) {
            this.error.set(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }

    async logout() {
        await this.auth.logout();
        await this.nav.navigateByUrl('/login');
    }
}
