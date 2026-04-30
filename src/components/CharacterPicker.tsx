import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PlayerCharacter } from "@/lib/matunga";
import horseWhite from "@/assets/horse-white.png";
import horseBlack from "@/assets/horse-black.png";
import grandmaHorse from "@/assets/grandma-horse.png";

export const CHARACTER_OPTIONS: Array<{
  id: PlayerCharacter;
  name: string;
  description: string;
  image: string;
}> = [
  {
    id: "white_horse",
    name: "Cavalo branco",
    description: "Fofo, clássico e confiante.",
    image: horseWhite,
  },
  {
    id: "black_horse",
    name: "Cavalo preto",
    description: "Esperto, dramático e veloz.",
    image: horseBlack,
  },
  {
    id: "grandma",
    name: "Vovó cavalo",
    description: "Sábia, tranquila e perigosa no tabuleiro.",
    image: grandmaHorse,
  },
];

export function getCharacterLabel(character: PlayerCharacter | null | undefined) {
  return CHARACTER_OPTIONS.find((option) => option.id === character)?.name ?? "Personagem";
}

export function getCharacterImage(character: PlayerCharacter | null | undefined) {
  return CHARACTER_OPTIONS.find((option) => option.id === character)?.image ?? horseWhite;
}

interface Props {
  value: PlayerCharacter;
  unavailable?: PlayerCharacter[];
  onChange: (character: PlayerCharacter) => void;
}

export function CharacterPicker({ value, unavailable = [], onChange }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {CHARACTER_OPTIONS.map((option) => {
        const disabled = unavailable.includes(option.id);
        const selected = value === option.id;

        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              "group text-left transition-all",
              disabled ? "cursor-not-allowed opacity-45 grayscale" : "hover:-translate-y-1",
            )}
          >
            <Card
              className={cn(
                "h-full p-3 bg-card/95 border-2 transition-all",
                selected ? "border-primary shadow-lg scale-[1.02]" : "border-border",
                !disabled && "group-hover:border-primary/70",
              )}
            >
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2 h-24 w-24 overflow-hidden rounded-full bg-accent/20 shadow-inner">
                  <img
                    src={option.image}
                    alt={option.name}
                    width={96}
                    height={96}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="font-bold text-foreground">{option.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{disabled ? "Já escolhido" : option.description}</p>
              </div>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
