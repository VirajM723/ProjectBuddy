import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { ContributionLog } from '../types';
import { subDays, format, eachDayOfInterval, startOfDay } from 'date-fns';

interface HeatmapProps {
  logs: ContributionLog[];
}

export function Heatmap({ logs }: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 130;
    const cellSize = 12;
    const cellPadding = 2;
    const margin = { top: 20, right: 20, bottom: 20, left: 40 };

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', 'auto');

    svg.selectAll('*').remove();

    const endDate = startOfDay(new Date());
    const startDate = subDays(endDate, 364);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Aggregate logs by date
    const logCounts = new Map<string, number>();
    logs.forEach(log => {
      const count = log.contributionType === 'Completed' ? 3 : 1;
      logCounts.set(log.date, (logCounts.get(log.date) || 0) + count);
    });

    const colorScale = d3.scaleThreshold<number, string>()
      .domain([1, 2, 4, 6])
      .range(['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Day labels
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    g.selectAll('.day-label')
      .data(days)
      .enter()
      .append('text')
      .attr('x', -10)
      .attr('y', (d, i) => i * (cellSize + cellPadding) + cellSize / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '9px')
      .attr('fill', '#94a3b8')
      .text(d => d);

    // Month labels
    const months = d3.timeMonths(startDate, endDate);
    g.selectAll('.month-label')
      .data(months)
      .enter()
      .append('text')
      .attr('x', d => {
        const weekNum = d3.timeWeek.count(startDate, d);
        return weekNum * (cellSize + cellPadding);
      })
      .attr('y', -5)
      .attr('font-size', '10px')
      .attr('fill', '#64748b')
      .text(d => format(d, 'MMM'));

    // Cells
    g.selectAll('.cell')
      .data(dateRange)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('x', d => {
        const weekNum = d3.timeWeek.count(startDate, d);
        return weekNum * (cellSize + cellPadding);
      })
      .attr('y', d => d.getDay() * (cellSize + cellPadding))
      .attr('rx', 2)
      .attr('fill', d => colorScale(logCounts.get(format(d, 'yyyy-MM-dd')) || 0))
      .append('title')
      .text(d => {
        const count = logCounts.get(format(d, 'yyyy-MM-dd')) || 0;
        return `${count} contributions on ${format(d, 'MMM d, yyyy')}`;
      });

  }, [logs]);

  return (
    <div className="overflow-x-auto bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
      <div className="min-w-[700px]">
        <svg ref={svgRef}></svg>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-[10px] text-slate-400">
        <span>Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-[2px] bg-[#ebedf0]"></div>
          <div className="w-3 h-3 rounded-[2px] bg-[#9be9a8]"></div>
          <div className="w-3 h-3 rounded-[2px] bg-[#40c463]"></div>
          <div className="w-3 h-3 rounded-[2px] bg-[#30a14e]"></div>
          <div className="w-3 h-3 rounded-[2px] bg-[#216e39]"></div>
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
