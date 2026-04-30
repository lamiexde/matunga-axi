import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { GameBoard } from "@/components/GameBoard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CharacterPicker } from "@/components/CharacterPicker";
import {
  initialBoard,
  Board,
  Player,
  type AIDifficulty,
  type PlayerCharacter,
  applyMove,
  checkWinner,
  chooseAIMove,
  randomPlayer,
} from "@/lib/matunga";
import { TurnCard } from "./play.local";

type Difficulty = AIDifficulty;
type AIMove = { from: [number, number]; to: [number, number] } | null;
type AIWorkerResponse = { id: number; move: AIMove };

const DIFFICULTY_OPTIONS: Array<{
  id: Difficulty;
  icon: string;
  title: string;
  description: string;
}> = [
  {
    id: "easy",
    icon: "🌱",
    title: "Fácil",
    description: "Movimentos aleatórios",
  },
  {
    id: "medium",
    icon: "🌿",
    title: "Médio",
    description: "Olha 1 jogada à frente",
  },
  {
    id: "hard",
    icon: "🌳",
    title: "Difícil",
    description: "Olha 2 jogadas à frente",
  },
  {
    id: "extreme",
    icon: "♞",
    title: "Extremo",
    description: "Busca profunda com poda e memória",
  },
];

const getDifficultyTitle = (difficulty: Difficulty) =>
  DIFFICULTY_OPTIONS.find((option) => option.id === difficulty)?.title ?? "IA";

export const Route = createFileRoute("/play/ai")({
  head: () => ({
    meta: [
      { title: "Matunga — Contra a IA" },
      { name: "description", content: "Jogue Matunga contra a IA com 4 níveis de dificuldade." },
    ],
  }),
  component: AIGame,
});

function AIGame() {
  const [charactersChosen, setCharactersChosen] = useState(false);
  const [humanCharacter, setHumanCharacter] = useState<PlayerCharacter>("white_horse");
  const [aiCharacter, setAiCharacter] = useState<PlayerCharacter>("black_horse");
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [humanColor, setHumanColor] = useState<Player>("white");
  const [board, setBoard] = useState<Board>(initialBoard());
  const [turn, setTurn] = useState<Player>(randomPlayer);
  const [winner, setWinner] = useState<Player | null>(null);
  const [thinking, setThinking] = useState(false);

  const aiColor: Player = humanColor === "white" ? "black" : "white";
  const characters = {
    [humanColor]: humanCharacter,
    [aiColor]: aiCharacter,
  } as Partial<Record<Player, PlayerCharacter>>;

  // AI move trigger
  useEffect(() => {
    if (!difficulty || winner) return;
    if (turn !== aiColor) return;
    let worker: Worker | null = null;
    let workerTimeout = 0;
    setThinking(true);

    const finishMove = (move: AIMove) => {
      if (!move) {
        setThinking(false);
        return;
      }

      const next = applyMove(board, move.from, move.to);
      const win = checkWinner(next, aiColor);
      setBoard(next);
      if (win) setWinner(aiColor);
      else setTurn(humanColor);
      setThinking(false);
    };

    const t = setTimeout(
      () => {
        if (difficulty === "extreme" && typeof Worker !== "undefined") {
          const requestId = Date.now();
          worker = new Worker(new URL("../workers/ai-worker.ts", import.meta.url), {
            type: "module",
          });

          worker.onmessage = (event: MessageEvent<AIWorkerResponse>) => {
            if (event.data.id !== requestId) return;
            window.clearTimeout(workerTimeout);
            worker?.terminate();
            worker = null;
            finishMove(event.data.move);
          };

          worker.onerror = () => {
            window.clearTimeout(workerTimeout);
            worker?.terminate();
            worker = null;
            finishMove(chooseAIMove(board, aiColor, "easy"));
          };

          workerTimeout = window.setTimeout(() => {
            worker?.terminate();
            worker = null;
            finishMove(chooseAIMove(board, aiColor, "easy"));
          }, 5000);

          worker.postMessage({
            id: requestId,
            board,
            player: aiColor,
            difficulty,
          });
          return;
        }

        finishMove(chooseAIMove(board, aiColor, difficulty));
      },
      difficulty === "extreme" ? 150 : 600,
    );

    return () => {
      clearTimeout(t);
      window.clearTimeout(workerTimeout);
      worker?.terminate();
    };
  }, [turn, board, difficulty, aiColor, humanColor, winner]);

  const reset = (color: Player = humanColor) => {
    setBoard(initialBoard());
    setTurn(randomPlayer());
    setWinner(null);
    setHumanColor(color);
  };

  if (!charactersChosen) {
    return (
      <GameLayout title="Contra a IA" subtitle="Escolha os personagens">
        <Card className="max-w-3xl mx-auto p-5 bg-card/95">
          <div className="grid gap-6">
            <div>
              <h2 className="font-bold text-xl mb-3">Você</h2>
              <CharacterPicker
                value={humanCharacter}
                unavailable={[aiCharacter]}
                onChange={setHumanCharacter}
              />
            </div>
            <div>
              <h2 className="font-bold text-xl mb-3">IA</h2>
              <CharacterPicker
                value={aiCharacter}
                unavailable={[humanCharacter]}
                onChange={setAiCharacter}
              />
            </div>
            <Button
              onClick={() => setCharactersChosen(true)}
              size="lg"
              className="justify-self-center min-w-48"
            >
              Continuar
            </Button>
          </div>
        </Card>
      </GameLayout>
    );
  }

  if (!difficulty) {
    return (
      <GameLayout title="Contra a IA" subtitle="Escolha a dificuldade">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {DIFFICULTY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => setDifficulty(option.id)}
              className="bg-card/95 rounded-2xl p-6 shadow-lg border-2 border-border hover-scale hover:border-primary text-center"
            >
              <div className="text-4xl mb-2">{option.icon}</div>
              <h3 className="font-bold text-xl">{option.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
            </button>
          ))}
        </div>
        <div className="text-center mt-4">
          <Button onClick={() => setCharactersChosen(false)} variant="outline">
            Trocar personagens
          </Button>
        </div>
      </GameLayout>
    );
  }

  return (
    <GameLayout
      title={`IA — ${getDifficultyTitle(difficulty)}`}
      subtitle={`Você joga com as ${humanColor === "white" ? "brancas" : "pretas"}`}
    >
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start justify-items-center">
        <div className="order-2 md:order-1 w-full max-w-xs space-y-3">
          <TurnCard turn={turn} winner={winner} characters={characters} />
          {thinking && (
            <p className="text-center text-sm text-muted-foreground animate-pulse">IA pensando…</p>
          )}
          <Button
            onClick={() => reset(humanColor === "white" ? "black" : "white")}
            variant="secondary"
            className="w-full"
          >
            Trocar de cor e reiniciar
          </Button>
          <Button onClick={() => reset()} variant="secondary" className="w-full">
            Reiniciar
          </Button>
          <Button onClick={() => setDifficulty(null)} variant="outline" className="w-full">
            Mudar dificuldade
          </Button>
          <Button
            onClick={() => {
              setDifficulty(null);
              setCharactersChosen(false);
              reset("white");
            }}
            variant="outline"
            className="w-full"
          >
            Trocar personagens
          </Button>
        </div>
        <div className="order-1 md:order-2">
          <GameBoard
            board={board}
            turn={turn}
            winner={winner}
            controls={[humanColor]}
            locked={thinking}
            characters={characters}
            onMove={(_f, _t, next, win) => {
              setBoard(next);
              if (win) setWinner(humanColor);
              else setTurn(aiColor);
            }}
          />
        </div>
      </div>
    </GameLayout>
  );
}
