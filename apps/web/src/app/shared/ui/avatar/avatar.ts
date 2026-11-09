import {Component, computed, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideUsers} from '@ng-icons/lucide';

/** Static class names so Tailwind generates them */
const TINTS = [
    'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    'bg-orange-500/15 text-orange-700 dark:text-orange-300',
];
const NEUTRAL = 'bg-muted text-muted-foreground';

/** `sm` in table rows, `md` in touch lists and card headers */
const SIZES = {sm: 'size-8 text-xs', md: 'size-10 text-sm'} as const;

/** "Spitzli Development" → "SD", "edisplay" → "ED" */
export function initials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
    return letters.toUpperCase();
}

/** Same name, same colour: a simple string hash picks the tint */
function tintFor(name: string): string {
    let h = 0;
    for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0;
    return TINTS[Math.abs(h) % TINTS.length];
}

/**
 * Client avatar: coloured initials, with the name as tooltip. Without a name it stands for "all clients".
 * Decorative for screen readers: keep the name in the surrounding text or an sr-only span.
 */
@Component({
    selector: 'app-avatar',
    imports: [NgIcon],
    providers: [provideIcons({lucideUsers})],
    host: {
        '[class]': 'classes()',
        '[attr.title]': "name() ?? 'Tous les clients'",
        'aria-hidden': 'true',
    },
    template: `
        @if (name(); as n) {
            {{ initials(n) }}
        } @else {
            <ng-icon name="lucideUsers" />
        }
    `,
})
export class Avatar {
    readonly name = input<string | null>(null);
    readonly size = input<keyof typeof SIZES>('sm');

    protected readonly initials = initials;
    protected readonly classes = computed(() => {
        const n = this.name();
        return [
            'inline-grid shrink-0 place-items-center rounded-full font-semibold select-none',
            SIZES[this.size()],
            n ? tintFor(n) : NEUTRAL,
        ].join(' ');
    });
}
