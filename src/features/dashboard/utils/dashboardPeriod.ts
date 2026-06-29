import { format, getISOWeek } from 'date-fns';
import type { DashboardPeriodo } from './dashboardExecutiveInsights';

export type DashboardPeriodoQuery = 'day' | 'week' | 'month';

export const dashboardPeriodoToQuery = (periodo: DashboardPeriodo): DashboardPeriodoQuery => {
  if (periodo === 'HOY') return 'day';
  if (periodo === 'SEMANA') return 'week';
  return 'month';
};

export const buildDashboardOperativoQuery = (periodo: DashboardPeriodo, now = new Date()) => {
  const query = dashboardPeriodoToQuery(periodo);
  if (query === 'day') return `period=day&day=${format(now, 'yyyy-MM-dd')}`;
  if (query === 'week') return `period=week&week=${format(now, 'RRRR')}-${String(getISOWeek(now)).padStart(2, '0')}`;
  return `period=month&month=${format(now, 'yyyy-MM')}`;
};
