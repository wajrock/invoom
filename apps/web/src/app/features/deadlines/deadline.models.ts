import {lucideBell, lucideBuilding2, lucideLandmark, lucidePercent} from '@ng-icons/lucide';
import {daysUntil, relativeDays} from '../../shared/utils/dates';

export type DeadlineKind = 'urssaf' | 'cfe' | 'impot' | 'autre';

export const KIND_LABELS: Record<DeadlineKind, string> = {
    urssaf: 'URSSAF',
    cfe: 'CFE',
    impot: 'Impôt',
    autre: 'Autre',
};

/** Icon and tint of each kind (static class names so Tailwind generates them) */
export const KIND_STYLES: Record<DeadlineKind, {icon: string; tint: string}> = {
    urssaf: {icon: 'lucideLandmark', tint: 'bg-tint-teal/12 text-tint-teal'},
    cfe: {icon: 'lucideBuilding2', tint: 'bg-tint-plum/12 text-tint-plum'},
    impot: {icon: 'lucidePercent', tint: 'bg-tint-terracotta/12 text-tint-terracotta'},
    autre: {icon: 'lucideBell', tint: 'bg-muted text-muted-foreground'},
};

export const KIND_ICONS = {lucideLandmark, lucideBuilding2, lucidePercent, lucideBell};

export const KIND_OPTIONS = (Object.keys(KIND_LABELS) as DeadlineKind[]).map((value) => ({
    value,
    label: KIND_LABELS[value],
}));

export interface DeadlineInput {
    title: string;
    dueOn: string;
    kind: DeadlineKind;
    amount: number | null;
    note: string;
}

export interface Deadline extends DeadlineInput {
    id: string;
    /** Generated from the tax settings (URSSAF, CFE, income tax): not editable */
    auto: boolean;
    done: boolean;
    doneAt: string | null;
}

/** Short status shown next to the amount, with its colour */
export function deadlineStatus(d: Deadline): {label: string; text: string; pill: string} {
    if (d.done) {
        return {
            label: 'Effectuée',
            text: 'text-success',
            pill: 'bg-success/12 text-success',
        };
    }
    const days = daysUntil(d.dueOn);
    if (days < 0) {
        return {label: 'En retard', text: 'text-destructive', pill: 'bg-destructive/15 text-destructive'};
    }
    return {
        label: relativeDays(d.dueOn),
        text: days <= 30 ? 'text-warning' : 'text-muted-foreground',
        pill: days <= 30 ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground',
    };
}
