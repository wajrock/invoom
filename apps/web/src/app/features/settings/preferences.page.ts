import {Component, inject, signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideCheck} from '@ng-icons/lucide';
import {HlmBadgeImports} from '@spartan-ng/helm/badge';
import {HlmLabelImports} from '@spartan-ng/helm/label';
import {THEME_OPTIONS, ThemeService} from '../../core/theme.service';
import {SettingsSection} from '../../shared/ui/settings-section/settings-section';
import {CURRENCIES} from '../../shared/utils/money';

/** "USD" → "dollar des États-Unis", from the browser's own currency names */
const currencyNames = new Intl.DisplayNames('fr', {type: 'currency'});
const currencyName = (code: string) => currencyNames.of(code) ?? code;

/**
 * Settings › Preferences: theme (light, dark or the device's, with a preview of each), and the language and
 * currency of the app, which are not applied yet: they only keep the choice for the page's lifetime.
 */
@Component({
    selector: 'app-preferences',
    imports: [FormsModule, NgIcon, HlmBadgeImports, HlmLabelImports, SettingsSection],
    providers: [provideIcons({lucideCheck})],
    template: `
        <app-settings-section
            heading="Thème"
            description="« Système » suit le réglage de ton appareil, y compris le mode sombre automatique le soir."
        >
            <div class="grid grid-cols-3 gap-2 sm:gap-3" role="radiogroup" aria-label="Thème">
                @for (t of options; track t.value) {
                    @let selected = theme.mode() === t.value;
                    <button
                        type="button"
                        role="radio"
                        class="bg-card grid gap-2 rounded-xl border p-1.5 text-left transition-colors sm:gap-3 sm:p-2"
                        [class]="selected ? 'border-primary ring-primary/30 ring-2' : 'hover:border-input'"
                        [attr.aria-checked]="selected"
                        (click)="theme.set(t.value)"
                    >
                        <!-- Miniature of the app in that theme; colours fixed on purpose, whatever the current one -->
                        <span class="flex h-16 overflow-hidden rounded-lg border sm:h-24" aria-hidden="true">
                            @for (half of previews[t.value]; track $index) {
                                <span class="flex flex-1 gap-1.5 p-2" [style.background]="half.bg">
                                    <span class="w-4 rounded-sm" [style.background]="half.side"></span>
                                    <span class="grid flex-1 content-start gap-1.5">
                                        <span class="h-2 w-2/3 rounded-full" [style.background]="half.text"></span>
                                        <span class="h-8 rounded-md" [style.background]="half.card"></span>
                                        <span class="h-1.5 w-1/2 rounded-full" [style.background]="half.accent"></span>
                                    </span>
                                </span>
                            }
                        </span>
                        <span class="flex items-center gap-2 px-1 pb-1 text-sm font-medium">
                            <span class="flex-1">{{ t.label }}</span>
                            @if (selected) {
                                <span
                                    class="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full"
                                >
                                    <ng-icon name="lucideCheck" class="text-xs" />
                                </span>
                            }
                        </span>
                    </button>
                }
            </div>
        </app-settings-section>

        <app-settings-section
            heading="Langue et devise"
            description="Pour l'interface et l'affichage des montants. Les factures gardent la langue et la devise de chaque client, et le chiffre d'affaires reste déclaré en euros."
        >
            <span sectionAside hlmBadge variant="outline" class="mt-1 justify-self-start">Bientôt</span>
            <div class="settings-card grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                <div class="grid gap-2">
                    <label hlmLabel for="p-language">Langue</label>
                    <select id="p-language" class="select-native" [(ngModel)]="language">
                        @for (l of languages; track l.value) {
                            <option [value]="l.value">{{ l.label }}</option>
                        }
                    </select>
                </div>
                <div class="grid gap-2">
                    <label hlmLabel for="p-currency">Devise</label>
                    <select id="p-currency" class="select-native" [(ngModel)]="currency">
                        @for (c of currencies; track c.code) {
                            <option [value]="c.code">{{ c.label }}</option>
                        }
                    </select>
                </div>
            </div>
        </app-settings-section>
    `,
})
export class PreferencesPage {
    protected readonly theme = inject(ThemeService);
    protected readonly options = THEME_OPTIONS;

    protected readonly languages = [
        {value: 'fr', label: 'Français'},
        {value: 'en', label: 'English'},
    ];
    protected readonly currencies = CURRENCIES.map((code) => ({code, label: `${code} · ${currencyName(code)}`}));
    protected readonly language = signal('fr');
    protected readonly currency = signal('EUR');

    private static readonly LIGHT = {
        bg: '#f4f4f4',
        side: '#faf7f2',
        card: '#fafaf8',
        text: '#24201c',
        accent: '#005461',
    };
    private static readonly DARK = {
        bg: '#121212',
        side: '#171717',
        card: '#1a1a1a',
        text: '#e6e6e6',
        accent: '#5aa9b2',
    };
    protected readonly previews = {
        system: [PreferencesPage.LIGHT, PreferencesPage.DARK],
        light: [PreferencesPage.LIGHT],
        dark: [PreferencesPage.DARK],
    };
}
