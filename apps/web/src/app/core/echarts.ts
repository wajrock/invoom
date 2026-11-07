// Import minimal d'ECharts : seuls les modules utilisés sont embarqués.
// ngx-echarts attend un module exposant init() : on réexporte echarts/core.
import { BarChart, LineChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export * from 'echarts/core';
