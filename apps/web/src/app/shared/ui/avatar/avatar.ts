import {Component, computed, input} from '@angular/core';
import {NgIcon, provideIcons} from '@ng-icons/core';
import {lucideUsers} from '@ng-icons/lucide';

/** Palette tints (styles.css), as static class names so Tailwind generates them */
const TINTS = [
    'bg-tint-teal/12 text-tint-teal',
    'bg-tint-terracotta/12 text-tint-terracotta',
    'bg-tint-ochre/14 text-tint-ochre',
    'bg-tint-sage/14 text-tint-sage',
    'bg-tint-plum/12 text-tint-plum',
    'bg-tint-slate/12 text-tint-slate',
    'bg-tint-clay/12 text-tint-clay',
    'bg-tint-moss/12 text-tint-moss',
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
