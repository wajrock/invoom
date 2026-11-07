import {Component, computed, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCopy, lucidePencil, lucidePlus, lucideTrash2} from '@ng-icons/lucide';
import {toast} from '@spartan-ng/brain/sonner';
import {HlmButtonImports} from '@spartan-ng/helm/button';
import {HlmCardImports} from '@spartan-ng/helm/card';
import {HlmInputImports} from '@spartan-ng/helm/input';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {HlmSkeletonImports} from '@spartan-ng/helm/skeleton';
import {HlmTextareaImports} from '@spartan-ng/helm/textarea';
import {errorMessage} from '../../core/http/error-message';
import {PageHeader} from '../../shared/ui/page-header/page-header';
import {Spinner} from '../../shared/ui/spinner/spinner';
import {copyToClipboard} from '../../shared/utils/clipboard';
import {CompanyApi} from './company.api';
import type {CompanyField} from './company.models';

const MULTILINE = new Set(['address']);

@Component({
    selector: 'app-company',
    imports: [
        FormsModule,
        NgIcon,
        HlmButtonImports,
        HlmCardImports,
        HlmInputImports,
        HlmLabelImports,
        HlmSkeletonImports,
        HlmTextareaImports,
        PageHeader,
        Spinner,
    ],
    providers: [provideIcons({lucideCopy, lucidePencil, lucidePlus, lucideTrash2})],
    templateUrl: './company.page.html',
})
export class CompanyPage {
    private readonly api = inject(CompanyApi);

    protected readonly fields = signal<CompanyField[] | null>(null);
    protected readonly editing = signal(false);
    protected readonly saving = signal(false);
    protected readonly error = signal('');
    protected newField = {group: '', label: ''};
    private snapshot: CompanyField[] = [];

    protected readonly groups = computed(() => {
        const map = new Map<string, CompanyField[]>();
        for (const f of this.fields() ?? []) map.set(f.group, [...(map.get(f.group) ?? []), f]);
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

    multiline(f: CompanyField) {
        return MULTILINE.has(f.id) || f.value.includes('\n');
    }

    copy(f: CompanyField) {
        void copyToClipboard(f.value, `${f.label} copié`);
    }

    copyAll() {
        const text = this.groups()
            .map((g) =>
                g.fields
                    .filter((f) => f.value)
                    .map((f) => `${f.label} : ${f.value}`)
                    .join('\n'),
            )
            .filter(Boolean)
            .join('\n\n');
        void copyToClipboard(text, 'Informations copiées');
    }

    edit() {
        this.snapshot = structuredClone(this.fields() ?? []);
        // Working copy: fields are edited in place through ngModel
        this.fields.set(structuredClone(this.snapshot));
        this.editing.set(true);
    }

    cancel() {
        this.fields.set(this.snapshot);
        this.editing.set(false);
    }

    addField() {
        const label = this.newField.label.trim();
        if (!label) return void toast.error('Libellé requis');
        const group = this.newField.group.trim() || 'Général';
        const id = `${label
            .toLowerCase()
            .normalize('NFD')
            .replace(/[^a-z0-9]+/g, '-')
            .slice(0, 40)}-${Date.now().toString(36)}`;
        this.fields.update((list) => [...(list ?? []), {id, group, label, value: ''}]);
        this.newField = {group, label: ''};
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
            this.editing.set(false);
            toast.success('Informations enregistrées');
        } catch (err) {
            toast.error(errorMessage(err));
        } finally {
            this.saving.set(false);
        }
    }
}
