import type { ReactNode } from "react";

export function PageHeader({
  actions,
  description,
  eyebrow,
  icon,
  title,
}: {
  actions?: ReactNode;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <div className="shrink-0">{icon}</div> : null}
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-sm font-medium text-muted-foreground">{eyebrow}</p>
          ) : null}
          <h1 className="text-3xl font-bold leading-tight md:text-4xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
