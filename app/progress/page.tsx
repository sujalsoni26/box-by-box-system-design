import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/account-panel";
import { ProfileForm } from "@/components/account/profile-form";
import { CompanionSettingsPanel } from "@/components/companion/companion-settings-panel";
import { BookmarkList, RecentlyStudied, ReviewList } from "@/components/learning/dashboard-widgets";
import { GeneralSettings, ProgressOverview } from "@/components/learning/progress-overview";
import { caseStudies } from "@/lib/case-studies";
import { cloudEnabled } from "@/lib/cloud/config";

export const metadata: Metadata = { title: "Progress", description: "Lessons learned, topics marked for review, quiz results, bookmarks and settings." };

export default function ProgressPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-10 sm:px-6">
      <header className="animate-rise">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">Progress</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-tight tracking-[-0.03em] text-ink">
          How far you have come
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-2">
          {cloudEnabled
            ? "Everything is saved in this browser. Sign in (optional) to keep it in your account and use it on any device."
            : "Everything is saved in this browser and survives restarts. Nothing is sent anywhere."}
        </p>
      </header>
      <AccountPanel />
      <ProgressOverview afterSummary={<ReviewList practiceSlugs={caseStudies.map((c) => c.slug)} />} />
      <div className="grid gap-6 md:grid-cols-2">
        <RecentlyStudied />
        <BookmarkList />
      </div>
      <section id="profile" aria-labelledby="profile-h" className="scroll-mt-24 rounded-2xl border border-line bg-surface p-5">
        <h2 id="profile-h" className="font-display text-2xl font-bold text-ink">
          Your profile
        </h2>
        <p className="mb-4 mt-1 text-ink-2">
          {cloudEnabled
            ? "Optional, and nothing sensitive. Kept with your settings, so it follows your account when you sign in."
            : "Optional, and nothing sensitive. Kept in this browser with your settings."}
        </p>
        <ProfileForm />
      </section>
      <GeneralSettings />
      <section aria-labelledby="companion-settings-h">
        <h2 id="companion-settings-h" className="mb-4 font-display text-2xl font-bold text-ink">
          Companion settings
        </h2>
        <CompanionSettingsPanel />
      </section>
    </div>
  );
}
