import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function StatCard({ title, value, description, icon: Icon, isLoading = false }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription>{title}</CardDescription>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden="true" />}
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
        )}
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </CardContent>
    </Card>
  );
}
