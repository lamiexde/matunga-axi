// Matunga game logic — knight-movement strategy
export type Player = "white" | "black";
export type PlayerCharacter = "white_horse" | "black_horse" | "grandma";
export type Cell = Player | null;
export type Board = Cell[][]; // 6x6 [row][col]

const ROOM_PLAYER_SEPARATOR = "::character::";
const ROOM_TURN_PREFIX = "matunga-turn:";
const PLAYER_CHARACTERS: PlayerCharacter[] = ["white_horse", "black_horse", "grandma"];
export const MOVE_TIME_LIMIT_MS = 3 * 60 * 1000;

export interface RoomTurnState {
  player: Player;
  score: Record<Player, number>;
  deadlineAt: number | null;
}

export const encodeRoomPlayer = (playerId: string, character: PlayerCharacter) =>
  `${playerId}${ROOM_PLAYER_SEPARATOR}${character}`;

export const decodeRoomPlayer = (
  value: string | null | undefined,
): {
  playerId: string | null;
  character: PlayerCharacter | null;
} => {
  if (!value) return { playerId: null, character: null };
  const [playerId, character] = value.split(ROOM_PLAYER_SEPARATOR);
  if (playerId && PLAYER_CHARACTERS.includes(character as PlayerCharacter)) {
    return { playerId, character: character as PlayerCharacter };
  }
  return { playerId: value, character: null };
};

export const roomPlayerMatches = (value: string | null | undefined, playerId: string) =>
  decodeRoomPlayer(value).playerId === playerId;

export const otherPlayer = (player: Player): Player => (player === "white" ? "black" : "white");

export const randomPlayer = (): Player => (Math.random() < 0.5 ? "white" : "black");

export const encodeRoomTurn = (state: RoomTurnState) =>
  `${ROOM_TURN_PREFIX}${JSON.stringify(state)}`;

export const decodeRoomTurn = (value: string | null | undefined): RoomTurnState => {
  if (value === "black" || value === "white") {
    return { player: value, score: { white: 0, black: 0 }, deadlineAt: null };
  }

  if (value?.startsWith(ROOM_TURN_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(ROOM_TURN_PREFIX.length)) as Partial<RoomTurnState>;
      const player = parsed.player === "black" ? "black" : "white";
      return {
        player,
        score: {
          white: Number(parsed.score?.white ?? 0),
          black: Number(parsed.score?.black ?? 0),
        },
        deadlineAt: typeof parsed.deadlineAt === "number" ? parsed.deadlineAt : null,
      };
    } catch {
      return { player: "white", score: { white: 0, black: 0 }, deadlineAt: null };
    }
  }

  return { player: "white", score: { white: 0, black: 0 }, deadlineAt: null };
};

export const createRoomTurn = (
  player: Player = randomPlayer(),
  score?: Record<Player, number>,
  deadlineAt?: number | null,
) =>
  encodeRoomTurn({
    player,
    score: score ?? { white: 0, black: 0 },
    deadlineAt: deadlineAt ?? null,
  });

export const BOARD_SIZE = 6;

export const initialBoard = (): Board => {
  // Pieces alternate on left and right edges
  const b: Board = Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(null));
  for (let r = 0; r < BOARD_SIZE; r++) {
    if (r % 2 === 0) {
      b[r][0] = "white";
      b[r][BOARD_SIZE - 1] = "black";
    } else {
      b[r][0] = "black";
      b[r][BOARD_SIZE - 1] = "white";
    }
  }
  return b;
};

const KNIGHT_OFFSETS: Array<[number, number]> = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

export const inBounds = (r: number, c: number) =>
  r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;

export const knightMoves = (board: Board, r: number, c: number) => {
  const moves: Array<[number, number]> = [];
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const nr = r + dr;
    const nc = c + dc;
    if (inBounds(nr, nc) && board[nr][nc] === null) moves.push([nr, nc]);
  }
  return moves;
};

export const cloneBoard = (b: Board): Board => b.map((row) => [...row]);

export const applyMove = (b: Board, from: [number, number], to: [number, number]): Board => {
  const nb = cloneBoard(b);
  nb[to[0]][to[1]] = nb[from[0]][from[1]];
  nb[from[0]][from[1]] = null;
  return nb;
};

/**
 * Win condition: 4 own pieces forming an "L" via knight-move connectivity.
 * The 4 pieces must form a connected cluster (each connected to at least one
 * other via a knight move) AND visually form an "L" shape (3 in a line +
 * 1 perpendicular at one end).
 *
 * We enumerate L-shapes: 3 collinear cells (orth) + 1 perpendicular at an
 * endpoint, in any orientation/rotation/reflection. Then verify that every
 * piece in the L is reachable from every other by knight moves restricted to
 * those 4 cells (i.e. the 4 cells are knight-connected as a subgraph).
 */
const knightDist = (a: [number, number], b: [number, number]) => {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return (dr === 1 && dc === 2) || (dr === 2 && dc === 1);
};

const isLShape = (cells: Array<[number, number]>) => {
  if (cells.length !== 4) return false;
  // try every cell as "the foot" (the perpendicular one)
  for (let foot = 0; foot < 4; foot++) {
    const others = cells.filter((_, i) => i !== foot);
    // others must be 3 collinear (horiz or vert) and consecutive
    const rows = others.map((c) => c[0]);
    const cols = others.map((c) => c[1]);
    const allSameRow = rows.every((r) => r === rows[0]);
    const allSameCol = cols.every((c) => c === cols[0]);
    let line: Array<[number, number]> | null = null;
    if (allSameRow) {
      const sorted = [...others].sort((a, b) => a[1] - b[1]);
      if (sorted[1][1] - sorted[0][1] === 1 && sorted[2][1] - sorted[1][1] === 1) line = sorted;
    } else if (allSameCol) {
      const sorted = [...others].sort((a, b) => a[0] - b[0]);
      if (sorted[1][0] - sorted[0][0] === 1 && sorted[2][0] - sorted[1][0] === 1) line = sorted;
    }
    if (!line) continue;
    // foot must be adjacent (orthogonally) to one ENDPOINT of line, perpendicular to it
    const f = cells[foot];
    const endpoints = [line[0], line[2]];
    for (const ep of endpoints) {
      const dr = f[0] - ep[0];
      const dc = f[1] - ep[1];
      if (allSameRow) {
        // line horizontal → foot must be vertical neighbor of an endpoint
        if (dc === 0 && Math.abs(dr) === 1) return true;
      } else {
        // line vertical → foot must be horizontal neighbor of an endpoint
        if (dr === 0 && Math.abs(dc) === 1) return true;
      }
    }
  }
  return false;
};

export const checkWinner = (board: Board, player: Player): boolean => {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) if (board[r][c] === player) cells.push([r, c]);

  // Visual L: 3 collinear adjacent cells + 1 perpendicular at an endpoint.
  // (Knight-connectivity intentionally omitted: knight cannot reach an adjacent
  // square in one move, so requiring it would make the game unwinnable.)
  const n = cells.length;
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++) {
          const four = [cells[a], cells[b], cells[c], cells[d]];
          if (isLShape(four)) return true;
        }
  return false;
};

export const allMovesFor = (
  board: Board,
  player: Player,
): Array<{ from: [number, number]; to: [number, number] }> => {
  const moves: Array<{ from: [number, number]; to: [number, number] }> = [];
  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++)
      if (board[r][c] === player) {
        for (const m of knightMoves(board, r, c)) moves.push({ from: [r, c], to: m });
      }
  return moves;
};

// ---------- AI ----------
export type AIDifficulty = "easy" | "medium" | "hard" | "extreme";

type Move = { from: [number, number]; to: [number, number] };

const WIN_SCORE = 1_000_000;
const EXTREME_TIME_LIMIT_MS = 4600;
const EXTREME_MAX_DEPTH = 14;
const EXACT = "exact";
const LOWER = "lower";
const UPPER = "upper";

type TranspositionEntry = {
  depth: number;
  score: number;
  bound: typeof EXACT | typeof LOWER | typeof UPPER;
  bestMove?: Move;
};

type BitMove = { from: number; to: number };

type BitState = {
  white: bigint;
  black: bigint;
};

type BitTranspositionEntry = {
  depth: number;
  score: number;
  bound: typeof EXACT | typeof LOWER | typeof UPPER;
  bestMove?: BitMove;
};

const CENTER_WEIGHTS = [
  [0, 1, 2, 2, 1, 0],
  [1, 3, 5, 5, 3, 1],
  [2, 5, 8, 8, 5, 2],
  [2, 5, 8, 8, 5, 2],
  [1, 3, 5, 5, 3, 1],
  [0, 1, 2, 2, 1, 0],
];

const OPEN_SHAPE_WEIGHTS = [0, 14, 95, 1500, WIN_SCORE];
const OPPONENT_SHAPE_WEIGHTS = [0, 16, 120, 2200, WIN_SCORE];

const L_SHAPES: Array<Array<[number, number]>> = (() => {
  const shapes = new Map<string, Array<[number, number]>>();
  const addShape = (cells: Array<[number, number]>) => {
    if (!cells.every(([r, c]) => inBounds(r, c))) return;
    const sorted = [...cells].sort((a, b) => a[0] * BOARD_SIZE + a[1] - (b[0] * BOARD_SIZE + b[1]));
    const key = sorted.map(([r, c]) => `${r}-${c}`).join("|");
    shapes.set(key, sorted);
  };

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c <= BOARD_SIZE - 3; c++) {
      const line: Array<[number, number]> = [
        [r, c],
        [r, c + 1],
        [r, c + 2],
      ];
      for (const endpoint of [line[0], line[2]]) {
        addShape([...line, [endpoint[0] - 1, endpoint[1]]]);
        addShape([...line, [endpoint[0] + 1, endpoint[1]]]);
      }
    }
  }

  for (let r = 0; r <= BOARD_SIZE - 3; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const line: Array<[number, number]> = [
        [r, c],
        [r + 1, c],
        [r + 2, c],
      ];
      for (const endpoint of [line[0], line[2]]) {
        addShape([...line, [endpoint[0], endpoint[1] - 1]]);
        addShape([...line, [endpoint[0], endpoint[1] + 1]]);
      }
    }
  }

  return [...shapes.values()];
})();

const INDEX_BITS = Array.from(
  { length: BOARD_SIZE * BOARD_SIZE },
  (_, index) => 1n << BigInt(index),
);

const CENTER_INDEX_WEIGHTS = CENTER_WEIGHTS.flat();

const KNIGHT_INDEX_MOVES = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
  const r = Math.floor(index / BOARD_SIZE);
  const c = index % BOARD_SIZE;
  return KNIGHT_OFFSETS.map(([dr, dc]) => [r + dr, c + dc] as [number, number])
    .filter(([nr, nc]) => inBounds(nr, nc))
    .map(([nr, nc]) => nr * BOARD_SIZE + nc);
});

const L_MASKS = L_SHAPES.map((shape) =>
  shape.reduce((mask, [r, c]) => mask | INDEX_BITS[r * BOARD_SIZE + c], 0n),
);

const moveKey = (move: Move) => `${move.from[0]},${move.from[1]}>${move.to[0]},${move.to[1]}`;

const bitMoveKey = (move: BitMove) => move.from * BOARD_SIZE * BOARD_SIZE + move.to;

const boardKey = (board: Board, player: Player) => {
  let key = player === "white" ? "w" : "b";
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      key += board[r][c] === null ? "0" : board[r][c] === "white" ? "1" : "2";
    }
  }
  return key;
};

const countWinningMovesFor = (board: Board, player: Player, limit = 4) => {
  let count = 0;
  for (const move of allMovesFor(board, player)) {
    if (checkWinner(applyMove(board, move.from, move.to), player)) {
      count++;
      if (count >= limit) return count;
    }
  }
  return count;
};

const hasBit = (mask: bigint, index: number) => (mask & INDEX_BITS[index]) !== 0n;

const bitCount = (mask: bigint) => {
  let count = 0;
  let value = mask;
  while (value) {
    value &= value - 1n;
    count++;
  }
  return count;
};

const hasWinnerMask = (mask: bigint) => L_MASKS.some((shape) => (mask & shape) === shape);

const boardToBitState = (board: Board): BitState => {
  let white = 0n;
  let black = 0n;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const bit = INDEX_BITS[r * BOARD_SIZE + c];
      if (board[r][c] === "white") white |= bit;
      else if (board[r][c] === "black") black |= bit;
    }
  }

  return { white, black };
};

const bitPlayerMask = (state: BitState, player: Player) =>
  player === "white" ? state.white : state.black;

const bitOpponentMask = (state: BitState, player: Player) =>
  player === "white" ? state.black : state.white;

const bitStateKey = (state: BitState, current: Player) =>
  `${current}:${state.white.toString(36)}:${state.black.toString(36)}`;

const generateBitMoves = (state: BitState, player: Player): BitMove[] => {
  const occupied = state.white | state.black;
  const pieces = bitPlayerMask(state, player);
  const moves: BitMove[] = [];

  for (let from = 0; from < BOARD_SIZE * BOARD_SIZE; from++) {
    if (!hasBit(pieces, from)) continue;
    for (const to of KNIGHT_INDEX_MOVES[from]) {
      if (!hasBit(occupied, to)) moves.push({ from, to });
    }
  }

  return moves;
};

const applyBitMove = (state: BitState, player: Player, move: BitMove): BitState => {
  const fromBit = INDEX_BITS[move.from];
  const toBit = INDEX_BITS[move.to];

  if (player === "white") {
    return {
      white: (state.white ^ fromBit) | toBit,
      black: state.black,
    };
  }

  return {
    white: state.white,
    black: (state.black ^ fromBit) | toBit,
  };
};

const bitMoveToMove = (move: BitMove): Move => ({
  from: [Math.floor(move.from / BOARD_SIZE), move.from % BOARD_SIZE],
  to: [Math.floor(move.to / BOARD_SIZE), move.to % BOARD_SIZE],
});

const countBitWinningMoves = (state: BitState, player: Player, limit = 4) => {
  let count = 0;
  for (const move of generateBitMoves(state, player)) {
    const next = applyBitMove(state, player, move);
    if (hasWinnerMask(bitPlayerMask(next, player))) {
      count++;
      if (count >= limit) return count;
    }
  }
  return count;
};

const findBitWinningMove = (state: BitState, player: Player) => {
  for (const move of generateBitMoves(state, player)) {
    const next = applyBitMove(state, player, move);
    if (hasWinnerMask(bitPlayerMask(next, player))) return move;
  }
  return null;
};

const bitStaticScore = (state: BitState, player: Player): number => {
  const opponent = otherPlayer(player);
  const ownMask = bitPlayerMask(state, player);
  const opponentMask = bitOpponentMask(state, player);

  if (hasWinnerMask(ownMask)) return WIN_SCORE;
  if (hasWinnerMask(opponentMask)) return -WIN_SCORE;

  let shapeScore = 0;
  let ownThreats = 0;
  let opponentThreats = 0;
  let ownAlmostThreats = 0;
  let opponentAlmostThreats = 0;

  for (const shape of L_MASKS) {
    const ownCount = bitCount(shape & ownMask);
    const opponentCount = bitCount(shape & opponentMask);

    if (ownCount > 0 && opponentCount > 0) continue;

    if (opponentCount === 0) {
      shapeScore += OPEN_SHAPE_WEIGHTS[ownCount];
      if (ownCount === 3) ownThreats++;
      else if (ownCount === 2) ownAlmostThreats++;
    } else {
      shapeScore -= OPPONENT_SHAPE_WEIGHTS[opponentCount];
      if (opponentCount === 3) opponentThreats++;
      else if (opponentCount === 2) opponentAlmostThreats++;
    }
  }

  let placement = 0;
  let ownKnightLinks = 0;
  let opponentKnightLinks = 0;

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index++) {
    if (hasBit(ownMask, index)) {
      placement += CENTER_INDEX_WEIGHTS[index];
      for (const to of KNIGHT_INDEX_MOVES[index])
        if (to > index && hasBit(ownMask, to)) ownKnightLinks++;
    } else if (hasBit(opponentMask, index)) {
      placement -= CENTER_INDEX_WEIGHTS[index];
      for (const to of KNIGHT_INDEX_MOVES[index]) {
        if (to > index && hasBit(opponentMask, to)) opponentKnightLinks++;
      }
    }
  }

  const ownImmediateWins = countBitWinningMoves(state, player);
  const opponentImmediateWins = countBitWinningMoves(state, opponent);
  const mobility =
    generateBitMoves(state, player).length - generateBitMoves(state, opponent).length;

  return (
    shapeScore +
    ownImmediateWins * 26000 -
    opponentImmediateWins * 32000 +
    (ownImmediateWins >= 2 ? 180000 : 0) -
    (opponentImmediateWins >= 2 ? 220000 : 0) +
    (ownThreats * ownThreats - opponentThreats * opponentThreats * 1.55) * 1200 +
    (ownAlmostThreats - opponentAlmostThreats * 1.25) * 120 +
    (ownKnightLinks - opponentKnightLinks * 1.1) * 30 +
    mobility * 10 +
    placement * 7
  );
};

const orderBitMoves = (
  state: BitState,
  current: Player,
  aiPlayer: Player,
  moves: BitMove[],
  preferredMove?: BitMove,
  killerMove?: BitMove,
  history?: Map<number, number>,
) => {
  const opponent = otherPlayer(current);
  const preferredKey = preferredMove ? bitMoveKey(preferredMove) : -1;
  const killerKey = killerMove ? bitMoveKey(killerMove) : -1;

  return moves
    .map((move) => {
      const key = bitMoveKey(move);
      const next = applyBitMove(state, current, move);
      const winsNow = hasWinnerMask(bitPlayerMask(next, current));
      const allowsReplyWin = countBitWinningMoves(next, opponent, 1) > 0;
      const createsFork = countBitWinningMoves(next, current, 2) >= 2;
      const staticScore = bitStaticScore(next, aiPlayer);

      return {
        move,
        score:
          (key === preferredKey ? 5_000_000 : 0) +
          (key === killerKey ? 900_000 : 0) +
          (history?.get(key) ?? 0) +
          (winsNow ? 4_000_000 : 0) +
          (createsFork ? 900_000 : 0) -
          (allowsReplyWin ? 1_800_000 : 0) +
          (current === aiPlayer ? staticScore : -staticScore),
      };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ move }) => move);
};

const scoreBoardFor = (board: Board, player: Player): number => {
  const opponent = otherPlayer(player);
  if (checkWinner(board, player)) return WIN_SCORE;
  if (checkWinner(board, opponent)) return -WIN_SCORE;

  const own: Array<[number, number]> = [];
  const opp: Array<[number, number]> = [];
  let placement = 0;

  for (let r = 0; r < BOARD_SIZE; r++)
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === player) {
        own.push([r, c]);
        placement += CENTER_WEIGHTS[r][c];
      } else if (board[r][c] === opponent) {
        opp.push([r, c]);
        placement -= CENTER_WEIGHTS[r][c];
      }
    }

  const pairs = (arr: Array<[number, number]>) => {
    let count = 0;
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) if (knightDist(arr[i], arr[j])) count++;
    return count;
  };

  let shapeScore = 0;
  let ownThreats = 0;
  let opponentThreats = 0;

  for (const shape of L_SHAPES) {
    let ownCount = 0;
    let opponentCount = 0;

    for (const [r, c] of shape) {
      if (board[r][c] === player) ownCount++;
      else if (board[r][c] === opponent) opponentCount++;
    }

    if (ownCount > 0 && opponentCount > 0) continue;

    if (opponentCount === 0) {
      shapeScore += OPEN_SHAPE_WEIGHTS[ownCount];
      if (ownCount === 3) ownThreats++;
    } else {
      shapeScore -= OPPONENT_SHAPE_WEIGHTS[opponentCount];
      if (opponentCount === 3) opponentThreats++;
    }
  }

  const ownImmediateWins = countWinningMovesFor(board, player);
  const opponentImmediateWins = countWinningMovesFor(board, opponent);
  const mobility = allMovesFor(board, player).length - allMovesFor(board, opponent).length;

  return (
    shapeScore +
    (ownThreats * ownThreats - opponentThreats * opponentThreats * 1.35) * 420 +
    ownImmediateWins * 9500 -
    opponentImmediateWins * 12000 +
    pairs(own) * 28 -
    pairs(opp) * 32 +
    mobility * 8 +
    placement * 5
  );
};

const orderMoves = (
  board: Board,
  current: Player,
  aiPlayer: Player,
  moves: Move[],
  preferredMove?: Move,
) => {
  const preferredKey = preferredMove ? moveKey(preferredMove) : null;

  return moves
    .map((move) => {
      const next = applyMove(board, move.from, move.to);
      return {
        move,
        preferred: preferredKey === moveKey(move),
        score: checkWinner(next, current)
          ? current === aiPlayer
            ? WIN_SCORE
            : -WIN_SCORE
          : scoreBoardFor(next, aiPlayer),
      };
    })
    .sort((a, b) => {
      if (a.preferred !== b.preferred) return a.preferred ? -1 : 1;
      return current === aiPlayer ? b.score - a.score : a.score - b.score;
    })
    .map(({ move }) => move);
};

const chooseExtremeAIMove = (board: Board, player: Player) => {
  const initialState = boardToBitState(board);
  const opponent = otherPlayer(player);
  const startedAt = performance.now();
  const deadline = startedAt + EXTREME_TIME_LIMIT_MS;
  const table = new Map<string, BitTranspositionEntry>();
  const history = new Map<number, number>();
  const killers: Array<BitMove | undefined> = [];
  let timeoutReached = false;
  let bitMoves = generateBitMoves(initialState, player);
  const winningMove = findBitWinningMove(initialState, player);
  if (winningMove) return bitMoveToMove(winningMove);

  const safeMoves = bitMoves.filter((move) => {
    const next = applyBitMove(initialState, player, move);
    return countBitWinningMoves(next, opponent, 1) === 0;
  });
  if (safeMoves.length > 0) bitMoves = safeMoves;

  let bestMove = orderBitMoves(initialState, player, player, bitMoves)[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  const timeIsUp = () => {
    if (performance.now() >= deadline) timeoutReached = true;
    return timeoutReached;
  };

  const search = (
    state: BitState,
    current: Player,
    depth: number,
    ply: number,
    alpha: number,
    beta: number,
  ): number => {
    if (timeIsUp()) return bitStaticScore(state, player);

    const playerMask = bitPlayerMask(state, player);
    const opponentMask = bitOpponentMask(state, player);
    if (hasWinnerMask(playerMask)) return WIN_SCORE - ply;
    if (hasWinnerMask(opponentMask)) return -WIN_SCORE + ply;

    const currentWinningMove = findBitWinningMove(state, current);
    if (currentWinningMove) {
      return current === player ? WIN_SCORE - ply : -WIN_SCORE + ply;
    }

    if (depth === 0) return bitStaticScore(state, player);

    const key = `${bitStateKey(state, current)}:${depth}`;
    const entry = table.get(key);
    const originalAlpha = alpha;
    const originalBeta = beta;

    if (entry && entry.depth >= depth) {
      if (entry.bound === EXACT) return entry.score;
      if (entry.bound === LOWER) alpha = Math.max(alpha, entry.score);
      else if (entry.bound === UPPER) beta = Math.min(beta, entry.score);
      if (alpha >= beta) return entry.score;
    }

    const currentMoves = generateBitMoves(state, current);
    if (currentMoves.length === 0) return bitStaticScore(state, player);

    const maximizing = current === player;
    const orderedMoves = orderBitMoves(
      state,
      current,
      player,
      currentMoves,
      entry?.bestMove,
      killers[ply],
      history,
    );
    let bestLocalMove = orderedMoves[0];
    let evaluatedMove = false;

    if (maximizing) {
      let value = Number.NEGATIVE_INFINITY;
      for (const move of orderedMoves) {
        if (timeIsUp()) break;
        const next = applyBitMove(state, current, move);
        const score = search(next, otherPlayer(current), depth - 1, ply + 1, alpha, beta);
        evaluatedMove = true;
        if (score > value) {
          value = score;
          bestLocalMove = move;
        }
        alpha = Math.max(alpha, value);
        if (alpha >= beta) {
          killers[ply] = move;
          const key = bitMoveKey(move);
          history.set(key, (history.get(key) ?? 0) + depth * depth);
          break;
        }
      }
      if (!evaluatedMove) return bitStaticScore(state, player);

      table.set(key, {
        depth,
        score: value,
        bestMove: bestLocalMove,
        bound: value <= originalAlpha ? UPPER : value >= originalBeta ? LOWER : EXACT,
      });
      return value;
    }

    let value = Number.POSITIVE_INFINITY;
    for (const move of orderedMoves) {
      if (timeIsUp()) break;
      const next = applyBitMove(state, current, move);
      const score = search(next, otherPlayer(current), depth - 1, ply + 1, alpha, beta);
      evaluatedMove = true;
      if (score < value) {
        value = score;
        bestLocalMove = move;
      }
      beta = Math.min(beta, value);
      if (alpha >= beta) {
        killers[ply] = move;
        const key = bitMoveKey(move);
        history.set(key, (history.get(key) ?? 0) + depth * depth);
        break;
      }
    }
    if (!evaluatedMove) return bitStaticScore(state, player);

    table.set(key, {
      depth,
      score: value,
      bestMove: bestLocalMove,
      bound: value <= originalAlpha ? UPPER : value >= originalBeta ? LOWER : EXACT,
    });
    return value;
  };

  for (let depth = 1; depth <= EXTREME_MAX_DEPTH; depth++) {
    const orderedRoot = orderBitMoves(
      initialState,
      player,
      player,
      bitMoves,
      bestMove,
      killers[0],
      history,
    );
    let depthBestMove = bestMove;
    let depthBestScore = Number.NEGATIVE_INFINITY;
    let alpha = Number.NEGATIVE_INFINITY;
    const beta = Number.POSITIVE_INFINITY;

    for (const move of orderedRoot) {
      if (timeIsUp()) break;
      const next = applyBitMove(initialState, player, move);
      const score = hasWinnerMask(bitPlayerMask(next, player))
        ? WIN_SCORE
        : search(next, opponent, depth - 1, 1, alpha, beta);

      if (score > depthBestScore) {
        depthBestScore = score;
        depthBestMove = move;
      }
      alpha = Math.max(alpha, depthBestScore);
    }

    if (timeoutReached) break;
    bestMove = depthBestMove;
    bestScore = depthBestScore;

    if (bestScore >= WIN_SCORE - EXTREME_MAX_DEPTH) break;
  }

  return bitMoveToMove(bestMove);
};

export const chooseAIMove = (
  board: Board,
  player: Player,
  difficulty: AIDifficulty,
): { from: [number, number]; to: [number, number] } | null => {
  const moves = allMovesFor(board, player);
  if (moves.length === 0) return null;

  if (difficulty === "easy") {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  if (difficulty === "extreme") {
    return chooseExtremeAIMove(board, player);
  }

  const opponent = otherPlayer(player);
  const depth = difficulty === "hard" ? 2 : 1;
  const startTime = performance.now();
  const maxTime = 450; // 450ms hard timeout
  let timeoutReached = false;

  const minimax = (
    b: Board,
    d: number,
    maximizing: boolean,
    alpha: number,
    beta: number,
  ): number => {
    if (timeoutReached) return scoreBoardFor(b, player);
    if (performance.now() - startTime > maxTime) {
      timeoutReached = true;
      return scoreBoardFor(b, player);
    }
    if (d === 0 || checkWinner(b, player) || checkWinner(b, opponent))
      return scoreBoardFor(b, player);
    const current: Player = maximizing ? player : opponent;
    const myMoves = allMovesFor(b, current);
    if (myMoves.length === 0) return scoreBoardFor(b, player);
    if (maximizing) {
      let best = -Infinity;
      for (const m of myMoves) {
        const nb = applyMove(b, m.from, m.to);
        best = Math.max(best, minimax(nb, d - 1, false, alpha, beta));
        alpha = Math.max(alpha, best);
        if (beta <= alpha || timeoutReached) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of myMoves) {
        const nb = applyMove(b, m.from, m.to);
        best = Math.min(best, minimax(nb, d - 1, true, alpha, beta));
        beta = Math.min(beta, best);
        if (beta <= alpha || timeoutReached) break;
      }
      return best;
    }
  };

  let bestScore = -Infinity;
  let bestMoves: typeof moves = [];
  for (const m of moves) {
    if (timeoutReached) break;
    const nb = applyMove(board, m.from, m.to);
    const s = minimax(nb, depth - 1, false, -Infinity, Infinity);
    if (s > bestScore) {
      bestScore = s;
      bestMoves = [m];
    } else if (s === bestScore) {
      bestMoves.push(m);
    }
  }
  return bestMoves.length > 0
    ? bestMoves[Math.floor(Math.random() * bestMoves.length)]
    : moves[Math.floor(Math.random() * moves.length)];
};

export const generateRoomCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
};

export const getOrCreatePlayerId = () => {
  if (typeof window === "undefined") return "ssr";
  const KEY = "matunga_player_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
};
