import type { LucideIcon } from "lucide-react";
import { Building2, Camera, Users, Boxes, Car, PartyPopper, LayoutGrid } from "lucide-react";

/**
 * Cosmetic-only mapping from a Category.slug to an icon + gradient tint.
 * Used to give listings without photos a distinct, on-brand placeholder
 * instead of a blank box, and to give category chips a consistent icon.
 * Falls back to a generic icon/tint for any slug not listed here so new
 * categories never render broken.
 */
export const CATEGORY_ICON: Record<string, LucideIcon> = {
  spaces: Building2,
  equipment: Camera,
  people: Users,
  capacity: Boxes,
  mobility: Car,
  events: PartyPopper,
};

export const CATEGORY_TINT: Record<string, string> = {
  spaces: "from-violet-500 to-indigo-500",
  equipment: "from-orange-500 to-amber-500",
  people: "from-blue-500 to-cyan-500",
  capacity: "from-emerald-500 to-teal-500",
  mobility: "from-pink-500 to-rose-500",
  events: "from-amber-500 to-orange-600",
};

export const DEFAULT_CATEGORY_ICON: LucideIcon = LayoutGrid;
export const DEFAULT_CATEGORY_TINT = "from-violet-500 to-indigo-500";
