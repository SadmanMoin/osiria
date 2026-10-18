/**
 * Preview-only campaign records for Phase 1 UI.
 *
 * This module is intentionally isolated from any future data layer.
 * Do not import this file from authentication, payments, verification,
 * or API routes. Replace with a database-backed source in a later phase.
 */
export const SAMPLE_DATA_NOTICE =
  "These campaigns are static sample records for UI preview. They are not loaded from a database and cannot be joined or paid out.";

export type CampaignStatus = "open" | "filling" | "ending-soon";
export type SocialPlatform = "x" | "instagram" | "tiktok" | "youtube";

export type SampleCampaign = {
  id: string;
  brand: string;
  title: string;
  description: string;
  platforms: SocialPlatform[];
  rewardLabel: string;
  remainingSlots: number;
  totalSlots: number;
  status: CampaignStatus;
  taskSummary: string;
  category: string;
};

export const sampleCampaigns: SampleCampaign[] = [
  {
    id: "preview-aurora-drop",
    brand: "Aurora Labs",
    title: "Launch week creator posts",
    description:
      "Share a short launch recap and tag the brand on X and Instagram. Sample campaign for layout and copy review only.",
    platforms: ["x", "instagram"],
    rewardLabel: "$18 / completed task",
    remainingSlots: 42,
    totalSlots: 80,
    status: "open",
    taskSummary: "1 original post + 2 replies",
    category: "Product launch",
  },
  {
    id: "preview-harbor-community",
    brand: "Harbor Wallet",
    title: "Community onboarding clips",
    description:
      "Record a 30-second walkthrough of setting up a watch-only portfolio. Preview data only; no live payouts.",
    platforms: ["tiktok", "youtube"],
    rewardLabel: "$35 / completed task",
    remainingSlots: 11,
    totalSlots: 40,
    status: "filling",
    taskSummary: "Short video + branded caption",
    category: "Education",
  },
  {
    id: "preview-linen-lookbook",
    brand: "Linen Studio",
    title: "Spring lookbook mentions",
    description:
      "Post a styled photo using the campaign hashtag. Used here to demonstrate campaign cards, not a live brief.",
    platforms: ["instagram"],
    rewardLabel: "$22 / completed task",
    remainingSlots: 6,
    totalSlots: 25,
    status: "ending-soon",
    taskSummary: "1 photo post",
    category: "Lifestyle",
  },
  {
    id: "preview-northwind-threads",
    brand: "Northwind",
    title: "Thread series on market literacy",
    description:
      "Write a 6-post educational thread using the provided outline. Sample content for the campaigns grid.",
    platforms: ["x"],
    rewardLabel: "$40 / completed task",
    remainingSlots: 18,
    totalSlots: 30,
    status: "open",
    taskSummary: "Thread + quote post",
    category: "Thought leadership",
  },
  {
    id: "preview-pulse-reviews",
    brand: "Pulse Audio",
    title: "Unboxing review round",
    description:
      "Film an honest unboxing with required talking points. Preview-only listing for UI density and filters.",
    platforms: ["youtube", "tiktok"],
    rewardLabel: "$75 / completed task",
    remainingSlots: 9,
    totalSlots: 12,
    status: "filling",
    taskSummary: "Review video + link in bio",
    category: "Reviews",
  },
  {
    id: "preview-cinder-events",
    brand: "Cinder Events",
    title: "City meetup amplification",
    description:
      "Share event details with a local angle. Static sample used to show multi-platform campaigns.",
    platforms: ["x", "instagram", "tiktok"],
    rewardLabel: "$12 / completed task",
    remainingSlots: 120,
    totalSlots: 200,
    status: "open",
    taskSummary: "Story + feed post",
    category: "Events",
  },
];

export const platformLabel: Record<SocialPlatform, string> = {
  x: "X",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const statusLabel: Record<CampaignStatus, string> = {
  open: "Open",
  filling: "Filling fast",
  "ending-soon": "Ending soon",
};
