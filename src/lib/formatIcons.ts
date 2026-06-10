import {
  Activity,
  Bike,
  Coffee,
  Footprints,
  LucideIcon,
  MoreHorizontal,
  Music,
  Palette,
  Sun,
  Utensils,
  Wine,
} from "lucide-react";

const FORMAT_ICONS: Record<string, LucideIcon> = {
  coffee: Coffee,
  wine: Wine,
  footprints: Footprints,
  utensils: Utensils,
  palette: Palette,
  activity: Activity,
  music: Music,
  sun: Sun,
  bike: Bike,
  "more-horizontal": MoreHorizontal,
};

export function getFormatIcon(iconKey?: string | null) {
  return FORMAT_ICONS[iconKey || ""] || MoreHorizontal;
}
