import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ProceduralFieldBackground } from "@/components/ProceduralFieldBackground";
import horseWhite from "@/assets/horse-white.png";
import horseBlack from "@/assets/horse-black.png";

export function GameLayout({
  title,
  subtitle,
  children,
  showHome = true,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  showHome?: boolean;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#a9d875]">
      <ProceduralFieldBackground />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(255,246,189,0.24),transparent_42%)] pointer-events-none" />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 sm:py-10">
        <header className="flex items-center justify-between mb-6">
          <Link to="/" className="flex items-center gap-2 hover-scale">
            <img src={horseWhite} alt="" width={40} height={40} className="drop-shadow" loading="lazy" />
            <img src={horseBlack} alt="" width={40} height={40} className="drop-shadow -ml-3" loading="lazy" />
            <span className="text-2xl font-bold text-foreground">Matunga</span>
          </Link>
          {showHome && (
            <Button asChild variant="secondary" size="sm">
              <Link to="/">Menu</Link>
            </Button>
          )}
        </header>

        {title && (
          <div className="text-center mb-6 animate-float-in">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-muted-foreground">{subtitle}</p>
            )}
          </div>
        )}

        <main>{children}</main>
      </div>
    </div>
  );
}
