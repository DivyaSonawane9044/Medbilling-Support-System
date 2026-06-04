import React from "react";

/**
 * Tiny sparkline component built with SVG.
 * series: array of numbers
 */
export default function SalesSparkline({ series = [] , width=120, height=34, stroke="#2563eb"}) {
  if (!series || series.length === 0) {
    // placeholder empty bar
    return <svg width={width} height={height}><rect width={width} height={height} fill="#f3f4f6" rx="4"/></svg>;
  }

  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = max - min || 1;
  const step = width / (series.length - 1);

  const points = series.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  }).join(" ");

  const last = series[series.length-1];
  return (
    <svg width={width} height={height}>
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={ (series.length-1) * step } cy={ height - ((last-min)/range)*(height-6) - 3 } r="2.5" fill={stroke} />
    </svg>
  );
}
