import logoSrc from "@/assets/verbo-logo.png";

export function Logo({ className = "", showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={logoSrc}
        alt="Verbo Language Solutions"
        className="h-9 w-9 rounded-lg object-cover"
      />
      {showWordmark && (
        <div className="flex flex-col leading-none">
          <span className="font-semibold tracking-tight text-foreground">Verbo</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Language Solutions</span>
        </div>
      )}
    </div>
  );
}
