import horseWhite from "@/assets/horse-white.png";
import horseBlack from "@/assets/horse-black.png";
import grandmaHorse from "@/assets/grandma-horse.png";
import type { Player, PlayerCharacter } from "@/lib/matunga";
import { cn } from "@/lib/utils";

interface Props {
  player: Player;
  selected?: boolean;
  shake?: boolean;
  celebrate?: boolean;
  size?: number;
  character?: PlayerCharacter | null;
}

const CHARACTER_ASSETS: Record<PlayerCharacter, { src: string; alt: string }> = {
  white_horse: { src: horseWhite, alt: "Cavalo branco" },
  black_horse: { src: horseBlack, alt: "Cavalo preto" },
  grandma: { src: grandmaHorse, alt: "Vovó cavalo" },
};

export function HorsePiece({ player, selected, shake, celebrate, size = 56, character }: Props) {
  const fallbackCharacter: PlayerCharacter = player === "white" ? "white_horse" : "black_horse";
  const piece = CHARACTER_ASSETS[character ?? fallbackCharacter];
  const displaySize = character === "grandma" ? Math.round(size * 1.1) : size;

  return (
    <img
      key={piece.src}
      src={piece.src}
      alt={piece.alt}
      width={displaySize}
      height={displaySize}
      draggable={false}
      loading="lazy"
      className={cn(
        "select-none transition-transform duration-200 pointer-events-none object-contain",
        selected && "piece-selected",
        shake && "animate-shake",
        celebrate && "animate-celebrate",
      )}
      style={{ width: displaySize, height: displaySize }}
    />
  );
}
