export default function Loading() {
  return (
    <main className="bg-app-gradient min-h-screen p-4 text-foreground md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="h-16 rounded-lg bg-muted" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
          <div className="h-24 rounded-lg bg-muted" />
        </div>
        <div className="h-80 rounded-lg bg-muted" />
      </div>
    </main>
  );
}
