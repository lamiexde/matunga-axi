import { chooseAIMove, type AIDifficulty, type Board, type Player } from "../lib/matunga";

type AIWorkerRequest = {
  id: number;
  board: Board;
  player: Player;
  difficulty: AIDifficulty;
};

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<AIWorkerRequest>) => {
  const { id, board, player, difficulty } = event.data;
  const move = chooseAIMove(board, player, difficulty);
  ctx.postMessage({ id, move });
};

export {};
