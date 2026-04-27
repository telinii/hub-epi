import { useTheme, THEMES, ThemeId } from "@/hooks/useTheme";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Check, Palette, RotateCcw } from "lucide-react";

export function ThemesTab() {
  const {
    themeId,
    translucent,
    surfaceOpacity,
    blur,
    wallpaperOpacity,
    setThemeId,
    setTranslucent,
    setSurfaceOpacity,
    setBlur,
    setWallpaperOpacity,
    reset,
  } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground uppercase tracking-tight flex items-center gap-3">
          <Palette className="h-7 w-7 text-primary" />
          Temas & Papel de Parede
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={reset}
          className="uppercase tracking-widest text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          Restaurar Padrão
        </Button>
      </div>

      {/* Theme grid */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
          [01] Selecione um tema
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const active = t.id === themeId;
            return (
              <button
                key={t.id}
                onClick={() => setThemeId(t.id as ThemeId)}
                className={`relative text-left border transition-all overflow-hidden group ${
                  active
                    ? "border-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.3)]"
                    : "border-border hover:border-muted-foreground"
                }`}
                style={{
                  backgroundColor: `hsl(${t.bgHsl})`,
                }}
              >
                <div
                  className="h-24 w-full relative"
                  style={{
                    backgroundImage: t.wallpaper ? `url(${t.wallpaper})` : undefined,
                    backgroundRepeat: "repeat",
                    backgroundSize: "120px auto",
                    opacity: t.wallpaper ? Math.max(t.wallpaperOpacity * 4, 0.3) : 1,
                  }}
                />
                <div className="p-3 border-t border-border bg-secondary/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm uppercase tracking-wider text-foreground">
                      {t.label}
                    </span>
                    {active && (
                      <span className="bg-primary text-primary-foreground p-0.5">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    {t.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Wallpaper opacity */}
      <section className="bg-secondary border border-border p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
            [02] Intensidade do papel de parede
          </h3>
          <span className="text-xs font-mono text-primary tabular-nums">
            {Math.round(wallpaperOpacity * 100)}%
          </span>
        </div>
        <Slider
          value={[wallpaperOpacity * 100]}
          min={0}
          max={50}
          step={1}
          onValueChange={([v]) => setWallpaperOpacity(v / 100)}
        />
        <p className="text-[10px] text-muted-foreground tracking-wider">
          Controla quão visível o padrão do tema fica no fundo (0% = invisível, 50% = bem destacado).
        </p>
      </section>

      {/* Translucent */}
      <section className="bg-secondary border border-border p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
              [03] Modo translúcido
            </h3>
            <p className="text-[10px] text-muted-foreground/80 mt-1 tracking-wider">
              Deixa cards e painéis transparentes, com blur opcional.
            </p>
          </div>
          <Switch checked={translucent} onCheckedChange={setTranslucent} />
        </div>

        <div className={`flex flex-col gap-5 transition-opacity ${translucent ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-foreground">
                Opacidade das superfícies
              </span>
              <span className="text-xs font-mono text-primary tabular-nums">
                {Math.round(surfaceOpacity * 100)}%
              </span>
            </div>
            <Slider
              value={[surfaceOpacity * 100]}
              min={20}
              max={100}
              step={1}
              onValueChange={([v]) => setSurfaceOpacity(v / 100)}
            />
            <p className="text-[10px] text-muted-foreground tracking-wider">
              20% = quase invisível · 100% = totalmente sólido.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-foreground">
                Intensidade do blur
              </span>
              <span className="text-xs font-mono text-primary tabular-nums">
                {blur}px
              </span>
            </div>
            <Slider
              value={[blur]}
              min={0}
              max={30}
              step={1}
              onValueChange={([v]) => setBlur(v)}
            />
            <p className="text-[10px] text-muted-foreground tracking-wider">
              0px = transparência crua · 30px = vidro fosco intenso.
            </p>
          </div>
        </div>
      </section>

      {/* Preview */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
          [04] Pré-visualização
        </h3>
        <div className="surface-translucent border border-border p-6 flex flex-col gap-2">
          <div className="text-primary font-display font-bold tracking-widest uppercase text-lg">
            Card de exemplo
          </div>
          <p className="text-sm text-muted-foreground">
            Este painel reflete as configurações atuais de transparência e blur.
          </p>
          <div className="flex gap-2 mt-2">
            <Button size="sm">AÇÃO PRIMÁRIA</Button>
            <Button size="sm" variant="outline">SECUNDÁRIA</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
