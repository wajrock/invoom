export type DeadlineKind = 'urssaf' | 'cfe' | 'impot' | 'autre';

export const KIND_LABELS: Record<DeadlineKind, string> = {
    urssaf: 'URSSAF',
    cfe: 'CFE',
    impot: 'Impôt',
    autre: 'Autre',
};

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
