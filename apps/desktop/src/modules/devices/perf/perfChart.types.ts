/** One line of a performance chart: the series key it reads, its name and its colour. */
export interface PerfChartLine {
  key: string;
  label: string;
  color: string;
  dashed?: boolean;
}
