import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, BookOpen, MessageCircle, X, Undo2 } from "lucide-react";
import { Card, GhostButton, PrimaryButton, SectionTitle } from "@/components/verbo/ui";
import { useAuth } from "@/lib/auth";
import {
  type Club, type ClubType, type ClubReleaseRequest,
  loadClubs, subscribeClubs, claimClub, releaseClub,
  loadReleaseRequests, subscribeReleaseRequests, addReleaseRequest,
  FREE_RELEASE_WINDOW_MS,
} from "@/lib/clubs-store";

export const Route = createFileRoute("/teacher/clubs")({ component: Page });

const PROPOSE_URL = "https://wa.me/522461152136?text=Hola!%20Quiero%20proponer%20una%20idea%20de%20club:%20";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtMMSS(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
function typeBadge(t: ClubType) {
  return t === "insight"
    ? { label: "Insight", cls: "bg-accent/15 text-accent", Icon: Sparkles }
    : { label: "Book Club", cls: "bg-primary/10 text-primary", Icon: BookOpen };
}

type SubView = "available" | "mine";
type Filter = "all" | ClubType;

function Page() {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [requests, setRequests] = useState<ClubReleaseRequest[]>([]);
  const [sub, setSub] = useState<SubView>("available");
  const [filter, setFilter] = useState<Filter>("all");
  // Live "Release" banner state (last claim by this teacher in this tab).
  const [banner, setBanner] = useState<{ clubId: string; claimedAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [releaseFor, setReleaseFor] = useState<Club | null>(null);

  useEffect(() => {
    setClubs(loadClubs());
    setRequests(loadReleaseRequests());
    const u1 = subscribeClubs(() => setClubs(loadClubs()));
    const u2 = subscribeReleaseRequests(() => setRequests(loadReleaseRequests()));
    return () => { u1(); u2(); };
  }, []);

  // Tick every second while banner is active.
  useEffect(() => {
    if (!banner) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [banner]);

  // Auto-dismiss banner when window elapses.
  useEffect(() => {
    if (!banner) return;
    const remaining = banner.claimedAt + FREE_RELEASE_WINDOW_MS - now;
    if (remaining <= 0) setBanner(null);
  }, [now, banner]);

  const available = useMemo(
    () => clubs
      .filter((c) => !c.teacher_id && c.status !== "completed" && c.status !== "cancelled")
      .filter((c) => filter === "all" || c.type === filter)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [clubs, filter],
  );

  const mine = useMemo(
    () => clubs
      .filter((c) => user && c.teacher_id === user.id)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [clubs, user],
  );

  const pendingByClub = useMemo(() => {
    const set = new Set<string>();
    requests.forEach((r) => set.add(r.club_id));
    return set;
  }, [requests]);

  if (!user) return null;

  const onClaim = (c: Club) => {
    const updated = claimClub(c.id, user.id);
    if (!updated) {
      toast.error("This club was just claimed by another teacher");
      setClubs(loadClubs());
      return;
    }
    setBanner({ clubId: c.id, claimedAt: +new Date(updated.claimed_at ?? new Date().toISOString()) });
    setNow(Date.now());
    toast.success("Club claimed!");
  };

  const onFreeRelease = () => {
    if (!banner) return;
    releaseClub(banner.clubId);
    setBanner(null);
    toast("Club released");
  };

  const onSubmitRelease = (club: Club, reason: string) => {
    addReleaseRequest({ club_id: club.id, teacher_id: user.id, reason });
    setReleaseFor(null);
    toast.success("Release request submitted for admin approval");
  };

  const remaining = banner ? banner.claimedAt + FREE_RELEASE_WINDOW_MS - now : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clubs</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Claim upcoming Book Clubs and Verbo Insights, and manage the ones you’re already leading.
          </p>
        </div>
        <a
          href={PROPOSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          <MessageCircle className="h-4 w-4" /> Propose a Club Idea
        </a>
      </div>

      {banner && remaining > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          <div className="text-foreground">
            <strong>Club claimed!</strong> You can release it free of charge within{" "}
            <span className="font-mono font-semibold">{fmtMMSS(remaining)}</span>.
          </div>
          <PrimaryButton onClick={onFreeRelease}>
            <Undo2 className="h-3.5 w-3.5" /> Release
          </PrimaryButton>
        </div>
      )}

      {/* Sub-view switcher */}
      <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1">
        {([
          { id: "available" as const, label: "Available Clubs" },
          { id: "mine" as const, label: "My Clubs" },
        ]).map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
              sub === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === "available" && (
        <>
          <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-1 text-sm">
            {([
              { id: "all" as const, label: "All" },
              { id: "book" as const, label: "Book Clubs" },
              { id: "insight" as const, label: "Insights" },
            ]).map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                className={`rounded-md px-3 py-1 font-medium transition-all ${
                  filter === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((c) => {
              const b = typeBadge(c.type);
              return (
                <Card key={c.id} className="!p-0 overflow-hidden flex flex-col">
                  <div className="relative aspect-video w-full bg-secondary/60">
                    {c.cover_image ? (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{c.cover_image}</div>
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <b.Icon className="h-10 w-10" />
                      </div>
                    )}
                    <span className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                      <b.Icon className="h-3 w-3" /> {b.label}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(c.date)} · {c.duration_minutes} min</div>
                    <div className="text-xs text-muted-foreground">Enrolled: {c.spots_taken}{c.spots_total ? `/${c.spots_total}` : ""}</div>
                    <div className="mt-auto pt-3">
                      <PrimaryButton className="w-full justify-center" onClick={() => onClaim(c)}>
                        Claim
                      </PrimaryButton>
                    </div>
                  </div>
                </Card>
              );
            })}
            {available.length === 0 && (
              <Card className="sm:col-span-2 lg:col-span-3">
                <p className="text-sm text-muted-foreground">No available clubs match this filter right now.</p>
              </Card>
            )}
          </div>
        </>
      )}

      {sub === "mine" && (
        <div className="space-y-3">
          {mine.length === 0 && (
            <Card><p className="text-sm text-muted-foreground">You haven’t claimed any clubs yet.</p></Card>
          )}
          {mine.map((c) => {
            const b = typeBadge(c.type);
            const claimedAt = c.claimed_at ? +new Date(c.claimed_at) : 0;
            const withinFree = claimedAt > 0 && Date.now() - claimedAt < FREE_RELEASE_WINDOW_MS;
            const pending = pendingByClub.has(c.id);
            return (
              <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                    <b.Icon className="h-3 w-3" /> {b.label}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{fmtDate(c.date)} · {c.duration_minutes} min</div>
                  </div>
                </div>
                {pending ? (
                  <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-medium text-warning-foreground">Release requested</span>
                ) : withinFree ? (
                  <GhostButton disabled className="opacity-60">Within free release window</GhostButton>
                ) : (
                  <GhostButton onClick={() => setReleaseFor(c)}>Request Release</GhostButton>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {releaseFor && (
        <RequestReleaseModal
          club={releaseFor}
          onClose={() => setReleaseFor(null)}
          onSubmit={(reason) => onSubmitRelease(releaseFor, reason)}
        />
      )}
    </div>
  );
}

function RequestReleaseModal({ club, onClose, onSubmit }: { club: Club; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Request Release</h2>
          <button onClick={onClose} aria-label="Close" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
            <div className="font-medium text-foreground">{club.title}</div>
            <div>{club.type === "insight" ? "Insight" : "Book Club"} · {fmtDate(club.date)}</div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground">Reason</label>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Optional — helps the admin decide.</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              placeholder="Why you need to release this club…"
              className="mt-1.5 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            This does not release the club immediately — an admin will review your request. If approved, a penalty may be applied to your Financial adjustments.
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-secondary/30 px-6 py-4">
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={() => onSubmit(reason.trim())}>Submit Request</PrimaryButton>
        </div>
      </div>
    </div>
  );
}
