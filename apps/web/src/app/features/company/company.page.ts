import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCopy, lucidePencil, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {Auth} from '../../core/auth/auth.service';
import {errorMessage} from '../../core/http/error-message';
import {type HasUnsavedChanges} from '../../core/navigation/unsaved-changes.guard';
import {Confirm} from '../../shared/ui/confirm/confirm';
import {SettingsSection} from '../../shared/ui/settings-section/settings-section';
import {Spinner} from '../../shared/ui/spinner/spinner';
import {copyToClipboard} from '../../shared/utils/clipboard';
import {CompanyApi} from './company.api';
import type {CompanyField} from './company.models';

const MULTILINE = new Set(['address']);

/** What each default group is for; groups the user creates have no description */
const GROUP_DESCRIPTIONS: Record<string, string> = {
    Identité: 'Mentions légales imprimées en tête de chaque facture.',
    Coordonnées: 'Où tes clients peuvent te joindre.',
    Banque: 'Pour être payé par virement : l’IBAN figure sous le total.',
};

@Component({
    selector: 'app-company',
    imports: [
        FormsModule,
        NgIcon,
        HlmButtonImports,
        HlmInputImports,
        HlmSkeletonImports,
        HlmTextareaImports,
        SettingsSection,
        Spinner,
    ],
    providers: [provideIcons({lucideCopy, lucidePencil, lucidePlus, lucideTrash2})],
    templateUrl: './company.page.html',
})
export class CompanyPage implements HasUnsavedChanges {
    private readonly api = inject(CompanyApi);
    private readonly auth = inject(Auth);
    private readonly confirm = inject(Confirm);

    protected readonly fields = signal<CompanyField[] | null>(null);
    /** Section being edited, by group name */
    protected readonly editing = signal<string | null>(null);
    protected readonly saving = signal(false);
    protected readonly error = signal('');
    protected newLabel = '';
    private snapshot: CompanyField[] = [];

    protected readonly groups = computed(() => {
        const map = new Map<string, CompanyField[]>();
        for (const f of this.fields() ?? []) map.set(f.group, [...(map.get(f.group) ?? []), f]);
        // A section emptied while edited stays on screen, with its add field and save buttons
        const editing = this.editing();
        if (editing && !map.has(editing)) map.set(editing, []);
        return [...map.entries()].map(([name, fields]) => ({name, fields}));
    });

    constructor() {
        void this.load();
    }

    async load() {
        try {
            this.fields.set((await this.api.get()).fields);
        } catch (err) {
            this.error.set(errorMessage(err));
        }
    }

    canLeave() {
        return !this.hasUnsavedChanges() || this.confirm.discardChanges();
    }

    private hasUnsavedChanges() {
        return this.editing() !== null && JSON.stringify(this.fields()) !== JSON.stringify(this.snapshot);
    }

    describe(group: string): string {
        return GROUP_DESCRIPTIONS[group] ?? '';
    }

    multiline(f: CompanyField) {
        return MULTILINE.has(f.id) || f.value.includes('\n');
    }

    copy(f: CompanyField) {
        void copyToClipboard(f.value, `${f.label} copié`);
    }

    /** Only this section becomes editable; the others keep showing their values */
    edit(group: string) {
        this.snapshot = structuredClone(this.fields() ?? []);
        // Working copy: fields are edited in place through ngModel
        this.fields.set(structuredClone(this.snapshot));
        this.newLabel = '';
        this.editing.set(group);
    }

    cancel() {
        this.fields.set(this.snapshot);
        this.editing.set(null);
    }

    addField(group: string) {
        const label = this.newLabel.trim();
        if (!label) return void toast.error('Libellé requis');
        const id = `${label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 40)}-${Date.now().toString(36)}`;
        this.fields.update((list) => [...(list ?? []), {id, group, label, value: ''}]);
        this.newLabel = '';
    }

    removeField(f: CompanyField) {
        this.fields.update((list) => (list ?? []).filter((x) => x !== f));
    }

    async save() {
        const fields = (this.fields() ?? []).map((f) => ({...f, label: f.label.trim() || 'Sans titre'}));
        this.saving.set(true);
        try {
            const res = await this.api.save({fields});
            this.fields.set(res.fields);
            this.editing.set(null);
            toast.success('Informations enregistrées');
            // The account menu shows the business name
            void this.auth.loadAccount(true);
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
