import { useState, useEffect, useRef, memo, useCallback, useMemo } from "react";
import {
  Board,
  Player,
  PlayerCharacter,
  knightMoves,
  applyMove,
  checkWinner,
  initialBoard,
} from "@/lib/matunga";
import { HorsePiece } from "./HorsePiece";
import { playPlock, playInvalid, playApplause } from "@/lib/sounds";
import { cn } from "@/lib/utils";

interface Props {
  board: Board;
  turn: Player;
  winner: Player | null;
  /** Returns true if move was applied. */
  onMove: (from: [number, number], to: [number, number], next: Board, win: boolean) => void;
  /** Which player(s) the local user controls. null = spectator. */
  controls: Player[] | null;
  /** Disable interaction (e.g. waiting for opponent / AI thinking). */
  locked?: boolean;
  characters?: Partial<Record<Player, PlayerCharacter | null>>;
}

interface CellProps {
  r: number;
  c: number;
  cell: Player | null;
  selected: boolean;
  isHint: boolean;
  isShaking: boolean;
  canControlTurn: boolean;
  turn: Player;
  winner: Player | null;
  character?: PlayerCharacter | null;
  onCellClick: (r: number, c: number) => void;
}

const BoardCell = memo(
  ({
    r,
    c,
    cell,
    selected,
    isHint,
    isShaking,
    canControlTurn,
    turn,
    winner,
    character,
    onCellClick,
  }: CellProps) => {
    const isLight = (r + c) % 2 === 0;

    return (
      <button
        key={`${r}-${c}`}
        onClick={() => onCellClick(r, c)}
        className={cn(
          "relative aspect-square w-12 sm:w-16 md:w-20 flex items-center justify-center transition-colors",
          isLight ? "bg-[var(--color-board-light)]" : "bg-[var(--color-board-dark)]",
          selected && "bg-[var(--color-board-selected)]",
          isHint && "bg-[var(--color-board-highlight)]",
          canControlTurn && cell === turn && "cursor-pointer hover:brightness-110",
        )}
        aria-label={`linha ${r + 1}, coluna ${c + 1}`}
      >
        {cell && (
          <HorsePiece
            player={cell}
            selected={selected}
            shake={isShaking}
            celebrate={!!winner && cell === winner}
            size={48}
            character={character}
          />
        )}
        {isHint && !cell && (
          <span className="absolute inset-0 m-auto h-3 w-3 rounded-full bg-foreground/40" />
        )}
      </button>
    );
  },
  (prev, next) => {
    return (
      prev.cell === next.cell &&
      prev.selected === next.selected &&
      prev.isHint === next.isHint &&
      prev.isShaking === next.isShaking &&
      prev.canControlTurn === next.canControlTurn &&
      prev.turn === next.turn &&
      prev.winner === next.winner &&
      prev.character === next.character &&
      prev.onCellClick === next.onCellClick
    );
  },
);

BoardCell.displayName = "BoardCell";

export function GameBoard({ board, turn, winner, onMove, controls, locked, characters }: Props) {
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [shake, setShake] = useState<[number, number] | null>(null);
  const lastWinner = useRef<Player | null>(null);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => {
    if (winner && lastWinner.current !== winner) {
      lastWinner.current = winner;
      playApplause();
    }
    if (!winner) lastWinner.current = null;
  }, [winner]);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
    };
  }, []);

  const validMoves = useMemo(
    () => (selected ? knightMoves(board, selected[0], selected[1]) : []),
    [board, selected],
  );
  const validMoveKeys = useMemo(
    () => new Set(validMoves.map(([r, c]) => `${r}-${c}`)),
    [validMoves],
  );

  const canControlTurn = !winner && !locked && controls !== null && controls.includes(turn);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (winner) return;
      const cell = board[r][c];

      if (selected) {
        const [sr, sc] = selected;
        if (sr === r && sc === c) {
          setSelected(null);
          return;
        }
        const isValid = validMoveKeys.has(`${r}-${c}`);
        if (isValid) {
          const next = applyMove(board, selected, [r, c]);
          const piece = board[sr][sc] as Player;
          const win = checkWinner(next, piece);
          playPlock();
          onMove(selected, [r, c], next, win);
          setSelected(null);
          return;
        }
        playInvalid();
        setShake(selected);
        if (shakeTimer.current) window.clearTimeout(shakeTimer.current);
        shakeTimer.current = window.setTimeout(() => setShake(null), 500);
        return;
      }

      if (!canControlTurn) return;
      if (cell === turn) setSelected([r, c]);
    },
    [board, canControlTurn, onMove, selected, turn, validMoveKeys, winner],
  );

  return (
    <div className="board-yard inline-block">
      <div className="cartoon-fence cartoon-fence-top" aria-hidden="true" />
      <div className="cartoon-fence cartoon-fence-right" aria-hidden="true" />
      <div className="cartoon-fence cartoon-fence-bottom" aria-hidden="true" />
      <div className="cartoon-fence cartoon-fence-left" aria-hidden="true" />
      <div className="board-grass-ring" aria-hidden="true" />
      <div className="relative z-10 grid grid-cols-6 gap-0 rounded-md overflow-hidden shadow-inner board-grid">
        {board.map((row, r) =>
          row.map((cell, c) => {
            const isSelected = selected?.[0] === r && selected?.[1] === c;
            const isHint = !!selected && validMoveKeys.has(`${r}-${c}`);
            const isShaking = shake?.[0] === r && shake?.[1] === c;

            return (
              <BoardCell
                key={`${r}-${c}`}
                r={r}
                c={c}
                cell={cell}
                selected={isSelected}
                isHint={isHint}
                isShaking={isShaking}
                canControlTurn={canControlTurn}
                turn={turn}
                winner={winner}
                character={cell ? characters?.[cell] : null}
                onCellClick={handleCellClick}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

export const newBoard = initialBoard;
