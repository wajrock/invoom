// Tree-shaken ECharts: only the modules we use are bundled.
// ngx-echarts expects a module exposing init(), hence the echarts/core re-export.
import {BarChart, LineChart} from 'echarts/charts';
import {GridComponent, LegendComponent, TooltipComponent} from 'echarts/components';
import {use} from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';

use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export * from 'echarts/core';
