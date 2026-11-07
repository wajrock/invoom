import type {EChartsCoreOption} from 'echarts/core';
import {formatCents} from '../../shared/utils/money';
import {MONTHS} from './dashboard-summary';
import type {Dashboard} from './dashboard.models';

/** Monthly revenue bars for the year, with last year as a dashed line. */
export function monthlyChart(d: Dashboard | null, dark: boolean): EChartsCoreOption {
    const text = dark ? '#a1a1aa' : '#71717a';
    const grid = dark ? 'rgba(255,255,255,0.08)' : '#e4e4e7';
    const toEur = (v: number) => Math.round(v) / 100;
    return {
        animationDuration: 400,
        grid: {left: 8, right: 8, top: 32, bottom: 8, containLabel: true},
        legend: {top: 0, right: 0, textStyle: {color: text}, itemWidth: 12, itemHeight: 8},
        tooltip: {
            trigger: 'axis',
            valueFormatter: (v: number) => formatCents(Math.round(v * 100)),
            backgroundColor: dark ? '#27272a' : '#fff',
            borderColor: grid,
            textStyle: {color: dark ? '#fafafa' : '#18181b'},
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
                itemStyle: {color: dark ? '#60a5fa' : '#2563eb', borderRadius: [4, 4, 0, 0]},
                barMaxWidth: 28,
            },
            {
                name: String(d ? d.year - 1 : ''),
                type: 'line',
                data: (d?.previousMonthly ?? []).map(toEur),
                itemStyle: {color: dark ? '#71717a' : '#a1a1aa'},
                lineStyle: {type: 'dashed', width: 2},
                symbol: 'circle',
                symbolSize: 5,
            },
        ],
    };
}
