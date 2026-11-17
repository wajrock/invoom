import type {EChartsCoreOption} from 'echarts/core';
import {themeColors} from '../../shared/utils/theme-color';
import {formatCents} from '../../shared/utils/money';
import {MONTHS} from './dashboard-summary';
import type {Dashboard} from './dashboard.models';

/**
 * Monthly revenue bars for the year, with last year as a dashed line. Colours come from the theme tokens at call
 * time: call it again when the theme changes.
 */
export function monthlyChart(d: Dashboard | null): EChartsCoreOption {
    const themeColor = themeColors();
    const text = themeColor('muted-foreground');
    const grid = themeColor('border');
    const toEur = (v: number) => Math.round(v) / 100;
    return {
        animationDuration: 400,
        grid: {left: 8, right: 8, top: 32, bottom: 8, containLabel: true},
        legend: {top: 0, right: 0, textStyle: {color: text}, itemWidth: 12, itemHeight: 8},
        tooltip: {
            trigger: 'axis',
            valueFormatter: (v: number) => formatCents(Math.round(v * 100)),
            backgroundColor: themeColor('popover'),
            borderColor: grid,
            textStyle: {color: themeColor('popover-foreground')},
        },
        xAxis: {
            type: 'category',
            data: MONTHS,
            axisLine: {lineStyle: {color: grid}},
            axisTick: {show: false},
            axisLabel: {color: text},
        },
        yAxis: {
            type: 'value',
            splitLine: {lineStyle: {color: grid}},
            axisLabel: {
                color: text,
                formatter: (v: number) => (v >= 1000 ? `${Math.round(v / 1000)} k€` : `${v} €`),
            },
        },
        series: [
            {
                name: String(d ? d.year : ''),
                type: 'bar',
                data: (d?.monthly ?? []).map(toEur),
                itemStyle: {color: themeColor('chart-1'), borderRadius: [4, 4, 0, 0]},
                barMaxWidth: 28,
            },
            {
                name: String(d ? d.year - 1 : ''),
                type: 'line',
                data: (d?.previousMonthly ?? []).map(toEur),
                itemStyle: {color: themeColor('chart-2')},
                lineStyle: {type: 'dashed', width: 2},
                symbol: 'circle',
                symbolSize: 5,
            },
        ],
    };
}
