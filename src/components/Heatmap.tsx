import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ContributionLog } from '../types';
import { subDays, format, eachDayOfInterval, startOfDay } from 'date-fns';

// Empty, then four steps of the one data hue
const LEVELS = ['#eeeeee', '#d3e0f3', '#94b4e3', '#5585cf', '#1d5fbf'];

interface HeatmapProps {
  logs: ContributionLog[];
}

export function Heatmap({ logs }: HeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);

  // Cells grow with the card instead of scaling the drawing, so labels stay at their real size
  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(700, Math.floor(entry.contentRect.width))));
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;

    const margin = { top: 20, right: 0, bottom: 2, left: 34 };
    const cellPadding = 3;
    const cellSize = Math.min(18, Math.floor((width - margin.left - margin.right) / 53) - cellPadding);
    const height = margin.top + 7 * (cellSize + cellPadding) + margin.bottom;

    const svg = d3.select(svgRef.current)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', width)
      .attr('height', height);

    svg.selectAll('*').remove();

    const endDate = startOfDay(new Date());
    const startDate = subDays(endDate, 364);
    const dateRange = eachDayOfInterval({ start: startDate, end: endDate });

    // Aggregate logs by date
    const logCounts = new Map<string, number>();
    logs.forEach(log => {
      const logDateStr = log.date || (log.createdAt ? format(new Date(log.createdAt), 'yyyy-MM-dd') : null);
      if (!logDateStr) return;
      const count = log.contributionType === 'Completed' ? 3 : 1;
      logCounts.set(logDateStr, (logCounts.get(logDateStr) || 0) + count);
    });

    const colorScale = d3.scaleThreshold<number, string>()
      .domain([1, 2, 4, 6])
      .range(LEVELS);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Day labels, every other day so they stay legible
    const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    g.selectAll('.day-label')
      .data(days)
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (d, i) => i * (cellSize + cellPadding) + cellSize / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('fill', '#6b6b6b')
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
      .attr('y', -6)
      .attr('font-size', '11px')
      .attr('fill', '#6b6b6b')
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


    // On narrow screens the grid scrolls; start at the most recent weeks
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [logs, width]);

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto">
        <div ref={wrapRef} className="min-w-[700px]">
          <svg ref={svgRef} role="img" aria-label="Contributions per day over the last year"></svg>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted">
        <span>Less</span>
        <div className="flex gap-1">
          {LEVELS.map(color => (
            <span key={color} className="w-3 h-3 rounded-[2px]" style={{ background: color }} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
