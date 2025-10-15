import { QuickCreate } from '../../../modules/quick-create';
import { TotalLinksCard } from './total-links-card';

interface DashboardSidebarProps {
  total: number;
  isLoading: boolean;
}

export function DashboardSidebar({ total, isLoading }: DashboardSidebarProps) {
  return (
    <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
      <TotalLinksCard total={total} isLoading={isLoading} />
      <QuickCreate />
    </div>
  );
}
