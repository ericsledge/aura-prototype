// Phase 3 commerce-intent experiment ONLY (per founder direction — no shop yet).
// Curated/mock items, no real links or checkout. The point is purely to measure
// whether users want Aura to show them what to buy when it flags a need — not to
// sell anything yet. See analytics events: shop_recommendations_viewed, product_clicked.

import { AuraCategory } from "@/lib/types/aura";

export interface MockGearItem {
  id: string;
  name: string;
  priceBand: "$" | "$$" | "$$$";
  note: string;
}

export const GEAR_BY_CATEGORY: Partial<Record<AuraCategory, MockGearItem[]>> = {
  style: [
    { id: "structured-overshirt", name: "Structured overshirt", priceBand: "$$", note: "Cleaner shoulder line" },
    { id: "neutral-tee", name: "Fitted neutral tee", priceBand: "$", note: "Versatile base layer" },
    { id: "tapered-trouser", name: "Tapered trouser", priceBand: "$$", note: "Cleaner silhouette" },
  ],
  accessories: [
    { id: "silver-chain", name: "Simple silver chain", priceBand: "$", note: "Low effort, coordinated" },
    { id: "minimal-watch", name: "Minimal watch", priceBand: "$$", note: "Medium impact" },
    { id: "neutral-bracelet", name: "Neutral bracelet", priceBand: "$", note: "Low effort" },
  ],
  facial_hair: [
    { id: "precision-trimmer", name: "Precision trimmer", priceBand: "$$", note: "Clean, symmetric edges" },
    { id: "beard-oil", name: "Beard care oil", priceBand: "$", note: "Maintenance" },
  ],
  skin_grooming: [
    { id: "cleanser", name: "Daily cleanser", priceBand: "$", note: "Grooming routine basics" },
    { id: "moisturizer", name: "Lightweight moisturizer", priceBand: "$", note: "Grooming routine basics" },
  ],
};

export function gearForCategory(category: AuraCategory): MockGearItem[] {
  return GEAR_BY_CATEGORY[category] ?? [];
}
