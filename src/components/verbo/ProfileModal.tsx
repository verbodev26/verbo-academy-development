import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { Award, Crown, Flame, Lock, Trophy, Camera } from "lucide-react";
import { setAvatar, useAvatar } from "@/lib/avatar-store";
import {
  getLeaderboardIdentity,
  setLeaderboardIdentity,
  type LeaderboardIdentityMode,
} from "@/lib/leaderboard-identity-store";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const EQUIPPED = [
  { icon: Crown, label: "Early Adopter", tone: "from-amber-400 to-orange-500" },
  { icon: Trophy, label: "First Session", tone: "from-indigo-400 to-violet-500" },
  { icon: Flame, label: "On Fire", tone: "from-rose-400 to-red-500" },
];

const CATALOG = [
  {
    key: "longevity",
    icon: Crown,
    title: "Longevity (Loyalty)",
    unlock: "Unlocked by staying active training in Verbo for months.",
  },
  {
    key: "conqueror",
    icon: Trophy,
    title: "Level Conqueror",
    unlock: "Unlocked by completing 100% of a language level.",
  },
  {
    key: "streak",
    icon: Flame,
    title: "Streak Master",
    unlock: "Unlocked by chaining 3 or more perfect scores in activities.",
  },
  {
    key: "scholar",
    icon: Award,
    title: "Verbo Scholar",
    unlock: "Unlocked by completing 25 sessions with a perfect rating.",
  },
];

export function ProfileModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const [gallery, setGallery] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatar = useAvatar(user?.id);

  const [lbMode, setLbMode] = useState<LeaderboardIdentityMode>("real");
  const [lbNickname, setLbNickname] = useState("");

  useEffect(() => {
    if (!user) return;
    const cur = getLeaderboardIdentity(user.id);
    setLbMode(cur.mode);
    setLbNickname(cur.nickname);
  }, [user, open]);

  if (!user) return null;
  const initial = user.name?.[0] ?? "?";

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(user.id, String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <div className="grid gap-0 md:grid-cols-2">
            {/* LEFT */}
            <div className="border-r border-border bg-secondary/30 p-6">
              <DialogTitle className="text-base font-semibold text-foreground">My Profile</DialogTitle>

              <div className="mt-5 flex flex-col items-center">
                <div
                  className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full shadow-md"
                  onClick={() => fileRef.current?.click()}
                >
                  {avatar ? (
                    <img src={avatar} alt={user.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#01304a] to-[#0a4a6e] text-3xl font-semibold text-white">
                      {initial}
                    </div>
                  )}
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="mb-1 h-4 w-4" />
                    Change Photo
                  </div>
                  <input
                    ref={fileRef}
                    id="avatar-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPick}
                  />
                </div>
                <div className="mt-3 text-center">
                  <div className="text-base font-semibold text-foreground">{user.name}</div>
                  {user.company && (
                    <div className="text-xs text-muted-foreground">
                      {user.company} · {user.hired_plan}
                    </div>
                  )}
                </div>
              </div>

              <form
                className="mt-6 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  onOpenChange(false);
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Change Password
                </div>
                {["Current Password", "New Password", "Confirm New Password"].map((p) => (
                  <input
                    key={p}
                    type="password"
                    placeholder={p}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                  />
                ))}
                <button
                  type="submit"
                  className="w-full cursor-pointer rounded-lg bg-[#f38934] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e07a25]"
                >
                  Update Profile
                </button>
              </form>
            </div>

            {/* RIGHT */}
            <div className="p-6">
              <div className="text-base font-semibold text-foreground">Equipped Badges</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Showcase up to three achievements on your profile.
              </p>

              <div className="mt-5 grid grid-cols-3 gap-3">
                {EQUIPPED.map((b) => {
                  const Icon = b.icon;
                  return (
                    <div
                      key={b.label}
                      className="group flex cursor-pointer flex-col items-center rounded-xl border border-border bg-card p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${b.tone} text-white shadow-inner`}
                      >
                        <Icon className="h-7 w-7" />
                      </div>
                      <div className="mt-2 text-center text-[11px] font-medium text-foreground">
                        {b.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setGallery(true)}
                className="mt-5 cursor-pointer text-sm font-medium text-[#01304a] underline-offset-4 hover:underline"
              >
                View all achievements →
              </button>



              <div className="mt-6 rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Show on leaderboard as
                </div>
                <div className="mt-3 space-y-2">
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm">
                    <input
                      type="radio"
                      name="lb-mode"
                      className="mt-0.5"
                      checked={lbMode === "real"}
                      onChange={() => {
                        setLbMode("real");
                        setLeaderboardIdentity(user.id, { mode: "real", nickname: lbNickname });
                      }}
                    />
                    <span className="font-medium text-foreground">My name and photo</span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm">
                    <input
                      type="radio"
                      name="lb-mode"
                      className="mt-0.5"
                      checked={lbMode === "nickname"}
                      onChange={() => {
                        setLbMode("nickname");
                        setLeaderboardIdentity(user.id, { mode: "nickname", nickname: lbNickname });
                      }}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Custom nickname</div>
                      {lbMode === "nickname" && (
                        <input
                          type="text"
                          value={lbNickname}
                          placeholder="Nickname"
                          onChange={(e) => {
                            const v = e.target.value;
                            setLbNickname(v);
                            setLeaderboardIdentity(user.id, { mode: "nickname", nickname: v });
                          }}
                          className="mt-2 w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>


              <div className="mt-8 rounded-xl border border-dashed border-border bg-secondary/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Profile Stats
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Level</div>
                    <div className="font-semibold text-foreground">{user.current_level ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Attendance</div>
                    <div className="font-semibold text-foreground">{user.attendance_percentage ?? 0}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AchievementsGallery open={gallery} onOpenChange={setGallery} />
    </>
  );
}

function AchievementsGallery({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle className="text-lg font-semibold text-foreground">
          Verbo Achievements & Badges Gallery
        </DialogTitle>
        <p className="text-xs text-muted-foreground">
          Hover over any badge to see how to unlock it.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {CATALOG.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.key} className="group relative">
                <div className="flex cursor-pointer flex-col items-center rounded-xl border border-border bg-secondary/30 p-5 transition-all hover:border-[#f38934]/40 hover:shadow-md">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-zinc-200 to-zinc-400 text-zinc-600 grayscale">
                    <Icon className="h-8 w-8" />
                    <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-zinc-700 text-white">
                      <Lock className="h-3 w-3" />
                    </div>
                  </div>
                  <div className="mt-3 text-center text-sm font-semibold text-foreground">
                    {b.title}
                  </div>
                  <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                    Locked
                  </div>
                </div>

                {/* Speech bubble tooltip */}
                <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-60 -translate-x-1/2 scale-95 rounded-lg bg-[#01304a] px-3 py-2 text-xs text-white opacity-0 shadow-xl transition-all group-hover:scale-100 group-hover:opacity-100">
                  <div className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-[#01304a]" />
                  {b.unlock}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
