import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { GameBoard } from "@/components/GameBoard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { initialBoard, Board, Player, randomPlayer, type PlayerCharacter } from "@/lib/matunga";
import { HorsePiece } from "@/components/HorsePiece";
import { CharacterPicker, getCharacterLabel } from "@/components/CharacterPicker";

export const Route = createFileRoute("/play/local")({
  head: () => ({
    meta: [
      { title: "Matunga — 2 jogadores local" },
      { name: "description", content: "Jogue Matunga com um amigo no mesmo dispositivo." },
    ],
  }),
  component: LocalGame,
});

function LocalGame() {
  const [started, setStarted] = useState(false);
  const [playerOneCharacter, setPlayerOneCharacter] = useState<PlayerCharacter>("white_horse");
  const [playerTwoCharacter, setPlayerTwoCharacter] = useState<PlayerCharacter>("black_horse");
  const [board, setBoard] = useState<Board>(initialBoard());
  const [turn, setTurn] = useState<Player>(randomPlayer);
  const [winner, setWinner] = useState<Player | null>(null);
  const characters = {
    white: playerOneCharacter,
    black: playerTwoCharacter,
  };

  const reset = () => {
    setBoard(initialBoard());
    setTurn(randomPlayer());
    setWinner(null);
  };

  if (!started) {
    return (
      <GameLayout title="Modo local" subtitle="Escolha os personagens">
        <Card className="max-w-3xl mx-auto p-5 bg-card/95">
          <div className="grid gap-6">
            <div>
              <h2 className="font-bold text-xl mb-3">Jogador 1</h2>
              <CharacterPicker
                value={playerOneCharacter}
                unavailable={[playerTwoCharacter]}
                onChange={setPlayerOneCharacter}
              />
            </div>
            <div>
              <h2 className="font-bold text-xl mb-3">Jogador 2</h2>
              <CharacterPicker
                value={playerTwoCharacter}
                unavailable={[playerOneCharacter]}
                onChange={setPlayerTwoCharacter}
              />
            </div>
            <Button
              onClick={() => {
                reset();
                setStarted(true);
              }}
              size="lg"
              className="justify-self-center min-w-48"
            >
              Começar partida
            </Button>
          </div>
        </Card>
      </GameLayout>
    );
  }

  return (
    <GameLayout title="Modo local" subtitle="Os dois jogadores se alternam neste dispositivo">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start justify-items-center">
        <div className="order-2 md:order-1 w-full max-w-xs space-y-3">
          <TurnCard turn={turn} winner={winner} characters={characters} />
          <Button onClick={reset} variant="secondary" className="w-full">Reiniciar partida</Button>
          <Button onClick={() => setStarted(false)} variant="outline" className="w-full">Trocar personagens</Button>
        </div>
        <div className="order-1 md:order-2">
          <GameBoard
            board={board}
            turn={turn}
            winner={winner}
            controls={["white", "black"]}
            characters={characters}
            onMove={(_from, _to, next, win) => {
              setBoard(next);
              if (win) setWinner(turn);
              else setTurn(turn === "white" ? "black" : "white");
            }}
          />
        </div>
      </div>
    </GameLayout>
  );
}

export function TurnCard({
  turn,
  winner,
  characters,
}: {
  turn: Player;
  winner: Player | null;
  characters?: Partial<Record<Player, PlayerCharacter | null>>;
}) {
  if (winner) {
    const winnerName = characters?.[winner] ? getCharacterLabel(characters[winner]) : winner === "white" ? "Brancas" : "Pretas";

    return (
      <Card className="p-4 bg-accent text-accent-foreground text-center animate-float-in">
        <div className="flex justify-center mb-2">
          <HorsePiece player={winner} character={characters?.[winner]} celebrate size={64} />
        </div>
        <p className="font-bold text-xl">
          {winnerName} venceu! 🎉
        </p>
      </Card>
    );
  }

  const turnName = characters?.[turn] ? getCharacterLabel(characters[turn]) : turn === "white" ? "Brancas" : "Pretas";

  return (
    <Card className="p-4 bg-card/95 text-center">
      <p className="text-sm text-muted-foreground mb-2">É a vez de</p>
      <div className="flex justify-center mb-2">
        <HorsePiece player={turn} character={characters?.[turn]} size={56} />
      </div>
      <p className="font-bold text-lg">{turnName}</p>
    </Card>
  );
}
