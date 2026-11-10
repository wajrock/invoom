import {and, gte, isNotNull, isNull, lte} from 'drizzle-orm';
import type {Deps} from '../../core/deps.ts';
import {deadlines} from '../../db/schema/index.ts';
import {generateDeadlines, type DeadlineKind} from '../fiscal/index.ts';
import {listEncaissements} from '../payments/payments.store.ts';
import {getTaxSettings} from '../settings/settings.store.ts';
import type {CustomDeadline} from './deadline.schema.ts';

export interface DeadlineView {
    id: string;
    auto: boolean;
    kind: DeadlineKind;
    title: string;
    dueOn: string;
    amount: number | null;
    note: string;
    done: boolean;
    doneAt: string | null;
}

/** Generated and custom deadlines due between `from` and `to` (inclusive). */
export async function listDeadlines(deps: Deps, from: string, to: string): Promise<DeadlineView[]> {
    const {db, cipher} = deps;
    const [tax, items] = await Promise.all([getTaxSettings(deps), listEncaissements(deps)]);
    const fromYear = Number(from.slice(0, 4));
    const toYear = Number(to.slice(0, 4));
    // A January deadline can belong to the previous year (Q4, December)
    const years = Array.from({length: toYear - fromYear + 2}, (_, i) => fromYear - 1 + i);

    // Generated deadlines keep their status in a row keyed by period: done date, or deleted by the user
    const statusRows = await db.select().from(deadlines).where(isNotNull(deadlines.autoKey));
    const doneMap = new Map(statusRows.map((r) => [r.autoKey!, r.doneAt]));
    const dismissed = new Set(
        statusRows.filter((r) => cipher.decryptJson<{dismissed?: boolean}>(r.data).dismissed).map((r) => r.autoKey!),
    );

    const auto: DeadlineView[] = generateDeadlines(years, items, tax)
        .filter((d) => d.dueOn >= from && d.dueOn <= to && !dismissed.has(d.autoKey))
        .map((d) => {
            const doneAt = doneMap.get(d.autoKey) ?? null;
            return {
                id: d.autoKey,
                auto: true,
                kind: d.kind,
                title: d.title,
                dueOn: d.dueOn,
                amount: d.amount,
                note: d.note ?? '',
                done: !!doneAt,
                doneAt: doneAt?.toISOString() ?? null,
            };
        });

    const customRows = await db
        .select()
        .from(deadlines)
        .where(and(isNull(deadlines.autoKey), gte(deadlines.dueOn, from), lte(deadlines.dueOn, to)));
    const custom: DeadlineView[] = customRows.map((r) => {
        const d = cipher.decryptJson<CustomDeadline>(r.data);
        return {
            id: r.id,
            auto: false,
            kind: d.kind,
            title: d.title,
            dueOn: r.dueOn,
            amount: d.amount,
            note: d.note,
            done: !!r.doneAt,
            doneAt: r.doneAt?.toISOString() ?? null,
        };
    });

    return [...auto, ...custom].sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}
