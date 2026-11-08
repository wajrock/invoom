import {Component} from '@angular/core';

/** The brand boomerang, in a 79 × 64 box. */
const BOOMERANG =
    'M1.28753 14.3763C9.72862 37.534 25.3122 64 39.5971 64C51.2245 64 69.2784 40.4253 77.1361 18.0322C77.2176 17.7998 77.3177 17.5767 77.4239 17.3549C78.2371 15.6576 78.4813 13.7311 78.1127 11.8731C77.7201 9.89367 76.6571 8.1179 75.1096 6.85636C73.562 5.59482 71.6285 4.92782 69.6472 4.97201C67.9829 5.00914 66.3739 5.54609 65.0174 6.50485C64.5039 6.86771 64.1315 7.39608 63.8608 7.9699C57.0255 22.4583 50.4131 34.4648 40.9175 37.9641C40.4759 38.1269 40.0065 38.2057 39.5386 38.1641C30.2333 37.3368 21.4548 20.3711 13.3145 3.18396C13.0897 2.70919 12.7959 2.26673 12.3972 1.93082C10.9221 0.688039 9.06152 1.20642e-07 7.13136 0C4.9395 -1.36998e-07 2.83741 0.887255 1.28753 2.46658C-0.262348 4.0459 0.0201649 7.41382 0.0201643 7.63986C0.0201644 9.87336 0.578788 12.763 1.28753 14.3763Z';

const TILE = 256;
const CELL = 64;

/** Small deterministic PRNG, so the mosaic looks random but never changes between renders. */
function mulberry32(seed: number): () => number {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Each boomerang stays inside its cell, so the tile repeats without visible seams.
const TRANSFORMS = (() => {
    const rnd = mulberry32(7);
    const out: string[] = [];
    for (let y = CELL / 2; y < TILE; y += CELL) {
        for (let x = CELL / 2; x < TILE; x += CELL) {
            const jx = (rnd() - 0.5) * 16;
            const jy = (rnd() - 0.5) * 16;
            const rotation = Math.round(rnd() * 360);
            const scale = 0.3 + rnd() * 0.12;
            out.push(
                `translate(${(x + jx).toFixed(1)} ${(y + jy).toFixed(1)}) rotate(${rotation}) scale(${scale.toFixed(2)}) translate(-39.5 -32)`,
            );
        }
    }
    return out;
})();

let nextId = 0;

/**
 * Decorative boomerang mosaic from the brand cover. Drawn in the current text colour: set its colour,
 * opacity and any fade mask from the outside.
 */
@Component({
    selector: 'app-brand-pattern',
    host: {class: 'pointer-events-none block', 'aria-hidden': 'true'},
    template: `
        <svg class="size-full" fill="currentColor">
            <defs>
                <path [attr.id]="id + '-b'" [attr.d]="path" />
                <pattern [attr.id]="id" [attr.width]="tile" [attr.height]="tile" patternUnits="userSpaceOnUse">
                    @for (t of transforms; track $index) {
                        <use [attr.href]="'#' + id + '-b'" [attr.transform]="t" />
                    }
                </pattern>
            </defs>
            <rect width="100%" height="100%" [attr.fill]="'url(#' + id + ')'" />
        </svg>
    `,
})
export class BrandPattern {
    protected readonly id = `brand-pattern-${nextId++}`;
    protected readonly path = BOOMERANG;
    protected readonly tile = TILE;
    protected readonly transforms = TRANSFORMS;
}
