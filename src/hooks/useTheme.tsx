import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import safetyWallpaper from "@/assets/safety-wallpaper.png";
import wpSafety from "@/assets/wallpaper-safety.png";
import wpFire from "@/assets/wallpaper-fire.png";
import wpHazard from "@/assets/wallpaper-hazard.png";
import wpPpe from "@/assets/wallpaper-ppe.png";
import wpGrid from "@/assets/wallpaper-grid.png";

export type ThemeId =
  | "default"
  | "safety"
  | "fire"
  | "hazard"
  | "ppe"
  | "grid"
  | "void"
  | "carbon"
  | "midnight";

export interface ThemeDef {
  id: ThemeId;
  label: string;
  description: string;
  wallpaper: string | null;
  bgHsl: string; // hsl values for --background
  accent: "primary" | "destructive" | "warning" | "success";
  wallpaperOpacity: number; // 0-1 base wallpaper opacity
}

export const THEMES: ThemeDef[] = [
  {
    id: "default",
    label: "PADRÃO INDUSTRIAL",
    description: "Capacetes e óculos de proteção sobre fundo escuro.",
    wallpaper: safetyWallpaper,
    bgHsl: "240 6% 3%",
    accent: "primary",
    wallpaperOpacity: 0.05,
  },
  {
    id: "safety",
    label: "SEGURANÇA OPERACIONAL",
    description: "Padrão técnico de EPIs e blueprints.",
    wallpaper: wpSafety,
    bgHsl: "240 6% 4%",
    accent: "primary",
    wallpaperOpacity: 0.08,
  },
  {
    id: "fire",
    label: "BRIGADA DE INCÊNDIO",
    description: "Extintores e símbolos de combate a incêndio.",
    wallpaper: wpFire,
    bgHsl: "0 30% 4%",
    accent: "destructive",
    wallpaperOpacity: 0.07,
  },
  {
    id: "hazard",
    label: "ZONA DE RISCO",
    description: "Faixas de hazard e símbolos de advertência.",
    wallpaper: wpHazard,
    bgHsl: "45 25% 4%",
    accent: "warning",
    wallpaperOpacity: 0.06,
  },
  {
    id: "ppe",
    label: "EPI BLUEPRINT",
    description: "Ícones de equipamentos de proteção em ciano.",
    wallpaper: wpPpe,
    bgHsl: "210 30% 4%",
    accent: "primary",
    wallpaperOpacity: 0.07,
  },
  {
    id: "grid",
    label: "GRID TÉCNICO",
    description: "Esquemáticos de engenharia em verde neon.",
    wallpaper: wpGrid,
    bgHsl: "140 20% 3%",
    accent: "success",
    wallpaperOpacity: 0.08,
  },
  {
    id: "void",
    label: "VOID",
    description: "Preto absoluto, sem papel de parede.",
    wallpaper: null,
    bgHsl: "0 0% 0%",
    accent: "primary",
    wallpaperOpacity: 0,
  },
  {
    id: "carbon",
    label: "CARBONO",
    description: "Cinza grafite uniforme.",
    wallpaper: null,
    bgHsl: "240 4% 10%",
    accent: "primary",
    wallpaperOpacity: 0,
  },
  {
    id: "midnight",
    label: "MIDNIGHT BLUE",
    description: "Azul profundo de turno noturno.",
    wallpaper: null,
    bgHsl: "220 40% 6%",
    accent: "primary",
    wallpaperOpacity: 0,
  },
];

interface ThemeState {
  themeId: ThemeId;
  translucent: boolean;
  surfaceOpacity: number; // 0.2 - 1
  blur: number; // 0 - 30 px
  wallpaperOpacity: number; // 0 - 0.5 override
}

const DEFAULT_STATE: ThemeState = {
  themeId: "default",
  translucent: false,
  surfaceOpacity: 0.85,
  blur: 12,
  wallpaperOpacity: 0.05,
};

const STORAGE_KEY = "epi-sys-theme-v1";

interface ThemeContextValue extends ThemeState {
  theme: ThemeDef;
  setThemeId: (id: ThemeId) => void;
  setTranslucent: (v: boolean) => void;
  setSurfaceOpacity: (v: number) => void;
  setBlur: (v: number) => void;
  setWallpaperOpacity: (v: number) => void;
  reset: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_STATE;
  });

  const theme = THEMES.find((t) => t.id === state.themeId) ?? THEMES[0];

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
    const root = document.documentElement;
    root.style.setProperty("--background", theme.bgHsl);
    root.style.setProperty(
      "--surface-opacity",
      state.translucent ? String(state.surfaceOpacity) : "1",
    );
    root.style.setProperty(
      "--surface-blur",
      state.translucent ? `${state.blur}px` : "0px",
    );
    root.style.setProperty("--wallpaper-opacity", String(state.wallpaperOpacity));
  }, [state, theme]);

  const value: ThemeContextValue = {
    ...state,
    theme,
    setThemeId: (themeId) => {
      const t = THEMES.find((x) => x.id === themeId);
      setState((s) => ({
        ...s,
        themeId,
        wallpaperOpacity: t ? t.wallpaperOpacity : s.wallpaperOpacity,
      }));
    },
    setTranslucent: (translucent) => setState((s) => ({ ...s, translucent })),
    setSurfaceOpacity: (surfaceOpacity) => setState((s) => ({ ...s, surfaceOpacity })),
    setBlur: (blur) => setState((s) => ({ ...s, blur })),
    setWallpaperOpacity: (wallpaperOpacity) =>
      setState((s) => ({ ...s, wallpaperOpacity })),
    reset: () => setState(DEFAULT_STATE),
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
