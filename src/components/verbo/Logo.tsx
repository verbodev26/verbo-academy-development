export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm tracking-tight">
        V
      </div>
      <div className="flex flex-col leading-none">
        <span className="font-semibold tracking-tight text-foreground">Verbo</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Language Solutions</span>
      </div>
    </div>
  );
}
