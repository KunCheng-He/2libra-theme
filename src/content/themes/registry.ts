import type { ThemePack } from "../../shared/types";
import { wecomTheme } from "../themes/wecom";

const themes: Record<string, ThemePack> = {
  [wecomTheme.id]: wecomTheme,
};

export const registry = {
  get(id: string): ThemePack | null {
    return themes[id] ?? null;
  },
  list(): ThemePack[] {
    return Object.values(themes);
  },
};
