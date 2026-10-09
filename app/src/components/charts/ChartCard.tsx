import { useId, useState, type ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
}

/** A chart with its plain-table twin; the toggle swaps between them. */
export function ChartCard({ title, subtitle, chart, table }: ChartCardProps) {
  const [asTable, setAsTable] = useState(false);
  const headingId = useId();
  return (
    <figure className="chart" aria-labelledby={headingId}>
      <div className="chart__head">
        <div>
          <h3 className="chart__title" id={headingId}>{title}</h3>
          {subtitle && <p className="chart__sub">{subtitle}</p>}
        </div>
        <button
          type="button"
          className="chart__toggle"
          aria-pressed={asTable}
          onClick={() => setAsTable((v) => !v)}
        >
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      <div className="chart__body">{asTable ? table : chart}</div>
    </figure>
  );
}
