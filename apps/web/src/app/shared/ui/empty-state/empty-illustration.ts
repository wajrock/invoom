import {Component, input} from '@angular/core';

export type EmptyIllustrationName =
    'invoices' | 'clients' | 'services' | 'sites' | 'calendar' | 'declaration' | 'archive';

/** The brand boomerang (79 × 64): what you send out comes back */
const BOOMERANG =
    'M1.29 14.38C9.73 37.53 25.31 64 39.6 64c11.62 0 29.68-23.57 37.54-45.97.08-.23.18-.46.29-.68a8.2 8.2 0 0 0 .69-5.48 8.1 8.1 0 0 0-3-5.02 7.9 7.9 0 0 0-5.46-1.88 7.9 7.9 0 0 0-4.63 1.53c-.51.37-.89.9-1.16 1.47C57.03 22.46 50.41 34.46 40.92 37.96c-.44.17-.91.25-1.38.2-9.3-.82-18.09-17.79-26.23-34.98-.22-.47-.52-.91-.92-1.25A7.13 7.13 0 0 0 7.13 0 7.1 7.1 0 0 0 1.29 2.47C-.26 4.05.02 7.41.02 7.64c0 2.23.56 5.12 1.27 6.74Z';

/**
 * Drawings for the empty states, as plain as the rest of the app: flat shapes with thin borders on a soft petrol
 * disc, petrol for the subject, terracotta for one detail, the boomerang as signature. Every colour is a theme token,
 * so they follow the dark theme; decorative only.
 */
@Component({
    selector: 'app-empty-illustration',
    host: {class: 'block', 'aria-hidden': 'true'},
    templateUrl: './empty-illustration.html',
})
export class EmptyIllustration {
    readonly name = input.required<EmptyIllustrationName>();
    protected readonly boomerang = BOOMERANG;
    /** Days of the calendar drawings: 5 columns × 3 rows */
    protected readonly cells = [0, 1, 2, 3, 4].flatMap((col) =>
        [0, 1, 2].map((row) => ({x: 67 + col * 14, y: 55 + row * 12})),
    );
}
