import { Hono } from 'hono';
import type { Deps } from '../deps.ts';
import { ACTIVITY_LABELS, defaultCeilings, defaultRates, sortPeriods, type Activity } from '../lib/fiscal.ts';
import { parseJson } from '../lib/http.ts';
import { getTaxSettings, putSetting } from '../lib/store.ts';
import { taxSettingsSchema } from '../lib/types.ts';

export const settingsRoutes = (deps: Deps) =>
  new Hono()
    .get('/tax', async (c) => c.json(await getTaxSettings(deps)))
    .put('/tax', async (c) => {
      const parsed = await parseJson(c, taxSettingsSchema);
      const body = { ...parsed, periods: sortPeriods(parsed.periods) };
      await putSetting(deps, 'tax', body);
      return c.json(body);
    })
    .get('/tax/defaults', (c) => {
      const activities = Object.keys(ACTIVITY_LABELS) as Activity[];
      return c.json(
        activities.map((a) => ({ activity: a, label: ACTIVITY_LABELS[a], rates: defaultRates(a), ...defaultCeilings(a) })),
      );
    });
