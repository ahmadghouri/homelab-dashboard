import { ConstructionIcon } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';

// Temporary page for modules that are not built yet. Each is replaced by its real page.
export function ComingSoonPage({ title, description, milestone }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={ConstructionIcon}
        title="Not built yet"
        description={`This page is part of milestone ${milestone}.`}
      />
    </>
  );
}
