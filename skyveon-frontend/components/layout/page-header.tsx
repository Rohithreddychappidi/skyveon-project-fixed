export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 sm:mb-8 gap-4">
      <div className="min-w-0">
        <h1 className="font-display font-semibold text-2xl text-ink tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-sm text-slate mt-1">{subtitle}</p>}
      </div>
      {action && <div className="flex-none flex items-center flex-wrap gap-2">{action}</div>}
    </div>
  );
}
