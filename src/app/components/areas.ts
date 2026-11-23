import { ChartColumn, Frame, Paintbrush, PencilRuler, Settings, Sparkles } from "lucide-react";

/** Each area's icon, the one source for its Nav Item in the Sidebar
 * (2218:588) and the icon that leads its Page Header (4015:764). A page one
 * level down takes its parent area's icon. */
export const AREA_ICON = {
  brandTemplates: Paintbrush,
  generate: Sparkles,
  templateBuilder: Frame,
  insights: ChartColumn,
  brandStudio: PencilRuler,
  settings: Settings,
} as const;

export type Area = keyof typeof AREA_ICON;
