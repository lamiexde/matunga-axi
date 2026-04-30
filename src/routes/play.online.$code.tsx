import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { GameBoard } from "@/components/GameBoard";
import {
  CharacterPicker,
  getCharacterImage,
  getCharacterLabel,
} from "@/components/CharacterPicker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import {
  Board,
  Player,
  applyMove,
  checkWinner,
  createRoomTurn,
  decodeRoomPlayer,
  decodeRoomTurn,
  encodeRoomPlayer,
  getOrCreatePlayerId,
  initialBoard,
  MOVE_TIME_LIMIT_MS,
  otherPlayer,
  randomPlayer,
  roomPlayerMatches,
  type PlayerCharacter,
} from "@/lib/matunga";
import { TurnCard } from "./play.local";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { ChatBox } from "@/components/ChatBox";

export const Route = createFileRoute("/play/online/$code")({
  head: ({ params }) => ({
    meta: [
      { title: `Sala ${params.code} — Matunga` },
      { name: "description", content: "Partida online de Matunga." },
    ],
  }),
  component: OnlineRoom,
});

interface RoomRow {
  id: string;
  code: string;
  board: Board;
  turn: string;
  winner: Player | null;
  player_white: string | null;
  player_black: string | null;
}

function OnlineRoom() {
  const { code } = Route.useParams();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<PlayerCharacter>("white_horse");
  const [notFound, setNotFound] = useState(false);
  const playerId = getOrCreatePlayerId();
  const [now, setNow] = useState(Date.now());

  // initial fetch; joining happens after character selection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("matunga_rooms")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        console.error("[matunga] room fetch error", error);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setRoom(data as unknown as RoomRow);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code, playerId]);



  // realtime subscription
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matunga_rooms", filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) setRoom(payload.new as unknown as RoomRow);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id]);

  useEffect(() => {
    if (!room) return;
    const white = decodeRoomPlayer(room.player_white);
    const black = decodeRoomPlayer(room.player_black);
    const unavailable = [
      white.character,
      black.character,
    ].filter(Boolean) as PlayerCharacter[];
    if (!unavailable.includes(selectedCharacter)) return;

    const nextCharacter = (["white_horse", "black_horse", "grandma"] as PlayerCharacter[])
      .find((character) => !unavailable.includes(character));
    if (nextCharacter) setSelectedCharacter(nextCharacter);
  }, [room, selectedCharacter]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const whiteSeat = decodeRoomPlayer(room?.player_white);
  const blackSeat = decodeRoomPlayer(room?.player_black);
  const turnState = decodeRoomTurn(room?.turn);
  const opponentJoined = !!room?.player_white && !!room?.player_black;

  const myColor: Player | null =
    whiteSeat.playerId === playerId ? "white" :
    blackSeat.playerId === playerId ? "black" : null;

  const roomFull = opponentJoined && !myColor;
  const unavailableCharacters = [
    whiteSeat.character,
    blackSeat.character,
  ].filter(Boolean) as PlayerCharacter[];
  const myCharacter =
    myColor === "white" ? whiteSeat.character :
    myColor === "black" ? blackSeat.character : null;

  useEffect(() => {
    if (!room || room.winner || !opponentJoined) return;
    if (turnState.deadlineAt) return;

    const nextTurn = createRoomTurn(turnState.player, turnState.score, Date.now() + MOVE_TIME_LIMIT_MS);
    setRoom((prev) => prev && prev.id === room.id ? { ...prev, turn: nextTurn } : prev);
    supabase
      .from("matunga_rooms")
      .update({ turn: nextTurn, updated_at: new Date().toISOString() })
      .eq("id", room.id)
      .is("winner", null)
      .then(({ error }) => {
        if (error) console.error("[matunga] timer start error", error);
      });
  }, [room?.id, room?.winner, room?.turn, opponentJoined]);

  useEffect(() => {
    if (!room || room.winner || !opponentJoined || !turnState.deadlineAt) return;
    if (now < turnState.deadlineAt) return;

    const winner = otherPlayer(turnState.player);
    const score = {
      ...turnState.score,
      [winner]: turnState.score[winner] + 1,
    };
    const nextTurn = createRoomTurn(turnState.player, score, null);

    setRoom((prev) => prev && prev.id === room.id ? { ...prev, winner, turn: nextTurn } : prev);
    supabase
      .from("matunga_rooms")
      .update({ winner, turn: nextTurn, updated_at: new Date().toISOString() })
      .eq("id", room.id)
      .is("winner", null)
      .then(({ error }) => {
        if (error) console.error("[matunga] timeout winner error", error);
      });
  }, [room?.id, room?.winner, room?.turn, opponentJoined, now]);

  if (loading) return <GameLayout title="Carregando sala…"><div /></GameLayout>;

  if (notFound)
    return (
      <GameLayout title="Sala não encontrada" subtitle={`Código ${code} inválido`}>
        <div className="text-center">
          <Button asChild><Link to="/play/online">Voltar</Link></Button>
        </div>
      </GameLayout>
    );

  if (!room) return null;

  const joinRoom = async () => {
    setJoining(true);
    try {
      const { data: latest, error: fetchError } = await supabase
        .from("matunga_rooms")
        .select("*")
        .eq("id", room.id)
        .single();
      if (fetchError || !latest) throw fetchError ?? new Error("room_fetch_failed");

      const currentRoom = latest as unknown as RoomRow;
      const currentWhite = decodeRoomPlayer(currentRoom.player_white);
      const currentBlack = decodeRoomPlayer(currentRoom.player_black);
      const takenCharacters = [currentWhite.character, currentBlack.character].filter(Boolean);

      if (roomPlayerMatches(currentRoom.player_white, playerId) || roomPlayerMatches(currentRoom.player_black, playerId)) {
        setRoom(currentRoom);
        return;
      }

      if (takenCharacters.includes(selectedCharacter)) {
        toast.error("Esse personagem já foi escolhido.");
        setRoom(currentRoom);
        return;
      }

      const seatValue = encodeRoomPlayer(playerId, selectedCharacter);
      const targetSeat: Player | null = !currentRoom.player_white ? "white" : !currentRoom.player_black ? "black" : null;

      if (!targetSeat) {
        setRoom(currentRoom);
        toast.error("Sala cheia.");
        return;
      }

      const currentTurn = decodeRoomTurn(currentRoom.turn);
      const nextTurn = createRoomTurn(
        currentTurn.player,
        currentTurn.score,
        Date.now() + MOVE_TIME_LIMIT_MS,
      );
      const { data, error } = await supabase
        .from("matunga_rooms")
        .update({
          [targetSeat === "white" ? "player_white" : "player_black"]: seatValue,
          turn: nextTurn,
          updated_at: new Date().toISOString(),
        })
        .eq("id", currentRoom.id)
        .is(targetSeat === "white" ? "player_white" : "player_black", null)
        .select("*")
        .single();

      if (error || !data) throw error ?? new Error("room_join_failed");
      const nextRoom = data as unknown as RoomRow;
      setRoom(nextRoom);
      if (!roomPlayerMatches(nextRoom.player_white, playerId) && !roomPlayerMatches(nextRoom.player_black, playerId)) {
        toast.error("Sala cheia.");
      }
    } catch (e: any) {
      toast.error("Não consegui entrar na sala.");
      console.error(e);
    } finally {
      setJoining(false);
    }
  };

  const onMove = async (
    _from: [number, number],
    _to: [number, number],
    next: Board,
    win: boolean,
  ) => {
    if (!myColor || !room) return;
    const newTurn: Player = otherPlayer(myColor);
    const winner = win ? myColor : null;
    const score = winner
      ? { ...turnState.score, [winner]: turnState.score[winner] + 1 }
      : turnState.score;
    const encodedTurn = createRoomTurn(
      newTurn,
      score,
      winner ? null : Date.now() + MOVE_TIME_LIMIT_MS,
    );
    
    // Optimistic update with version check
    setRoom((prev) => {
      if (!prev || prev.id !== room.id) return prev;
      return { ...prev, board: next, turn: encodedTurn, winner };
    });
    
    // Send update with merge protection
    const { error } = await supabase
      .from("matunga_rooms")
      .update({ 
        board: next as any, 
        turn: encodedTurn, 
        winner, 
        updated_at: new Date().toISOString() 
      })
      .eq("id", room.id);
    
    if (error) {
      toast.error("Erro ao sincronizar a jogada");
      // Revert on error
      setRoom(room);
    }
  };

  const reset = async () => {
    const start = randomPlayer();
    const encodedTurn = createRoomTurn(
      start,
      turnState.score,
      opponentJoined ? Date.now() + MOVE_TIME_LIMIT_MS : null,
    );
    const { error } = await supabase
      .from("matunga_rooms")
      .update({ board: initialBoard() as any, turn: encodedTurn, winner: null, updated_at: new Date().toISOString() })
      .eq("id", room.id);
    if (error) toast.error("Erro ao reiniciar");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };
  const boardForDisplay = opponentJoined
    ? room.board
    : room.board.map((row) => row.map((cell) => (cell === "white" ? cell : null))) as Board;
  const remainingMs = turnState.deadlineAt ? Math.max(0, turnState.deadlineAt - now) : MOVE_TIME_LIMIT_MS;
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const timerLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  return (
    <GameLayout
      title={`Sala ${code}`}
      subtitle={
        myColor
          ? `Você joga com as ${myColor === "white" ? "brancas" : "pretas"} como ${getCharacterLabel(myCharacter)}`
          : roomFull
            ? "Você é espectador (sala cheia)"
            : "Escolha seu personagem para entrar"
      }
    >
      {(myColor || roomFull) && (
        <TopScoreBoard
          code={code}
          score={turnState.score}
          characters={{ white: whiteSeat.character, black: blackSeat.character }}
        />
      )}

      {!myColor && !roomFull && (
        <Card className="max-w-3xl mx-auto p-5 bg-card/95 mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="font-bold text-xl">Saguão da sala</h2>
              <p className="text-sm text-muted-foreground">
                Escolha um personagem livre. O oponente não pode usar o mesmo.
              </p>
            </div>
            <CharacterPicker
              value={selectedCharacter}
              unavailable={unavailableCharacters}
              onChange={setSelectedCharacter}
            />
            <Button
              onClick={joinRoom}
              disabled={joining || unavailableCharacters.includes(selectedCharacter)}
              size="lg"
              className="self-center min-w-48"
            >
              {joining ? "Entrando…" : "Entrar na sala"}
            </Button>
          </div>
        </Card>
      )}

      {(myColor || roomFull) && (
      <div className="grid md:grid-cols-[1fr_auto] gap-6 items-start justify-items-center">
        <div className="order-2 md:order-1 w-full max-w-xs space-y-3">
          <Card className="p-3 bg-card/95 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Código da sala</p>
              <p className="font-bold text-2xl tracking-widest">{code}</p>
            </div>
            <Button onClick={copyCode} size="icon" variant="secondary">
              <Copy className="h-4 w-4" />
            </Button>
          </Card>

          <PlayerRoster room={room} playerId={playerId} />

          {opponentJoined && !room.winner && (
            <Card className="p-3 bg-card/95 text-center">
              <p className="text-xs text-muted-foreground">Tempo da jogada</p>
              <p className="text-2xl font-bold tabular-nums">{timerLabel}</p>
            </Card>
          )}

          <TurnCard
            turn={turnState.player}
            winner={room.winner}
            characters={{
              white: whiteSeat.character,
              black: blackSeat.character,
            }}
          />

          <ChatBox
            roomId={room.id}
            myColor={myColor}
            myPlayerId={playerId}
            characters={{
              white: whiteSeat.character,
              black: blackSeat.character,
            }}
          />

          {myColor && (
            <Button onClick={reset} variant="secondary" className="w-full">
              Reiniciar partida
            </Button>
          )}
        </div>

        <div className="order-1 md:order-2">
          <GameBoard
            board={boardForDisplay}
            turn={turnState.player}
            winner={room.winner}
            controls={myColor ? [myColor] : null}
            locked={!opponentJoined}
            characters={{
              white: whiteSeat.character,
              black: blackSeat.character,
            }}
            onMove={onMove}
          />
        </div>
      </div>
      )}
    </GameLayout>
  );
}

function PlayerRoster({ room, playerId }: { room: RoomRow; playerId: string }) {
  const players = [
    {
      color: "white" as Player,
      player: room.player_white,
      character: decodeRoomPlayer(room.player_white).character,
      playerId: decodeRoomPlayer(room.player_white).playerId,
      label: "Jogador 1",
    },
    {
      color: "black" as Player,
      player: room.player_black,
      character: decodeRoomPlayer(room.player_black).character,
      playerId: decodeRoomPlayer(room.player_black).playerId,
      label: "Jogador 2",
    },
  ];

  return (
    <Card className="p-3 bg-card/95 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Jogadores</p>
      {players.map((seat) => (
        <div
          key={seat.color}
          className={`flex items-center gap-3 rounded-lg p-2 ${
            seat.player ? "bg-muted/45" : "bg-accent/40 animate-pulse"
          }`}
        >
          {seat.character ? (
            <img
              src={getCharacterImage(seat.character)}
              alt={getCharacterLabel(seat.character)}
              width={44}
              height={44}
              loading="lazy"
              className="h-11 w-11 rounded-full object-cover bg-accent/30"
            />
          ) : (
            <div className="h-11 w-11 rounded-full bg-background/70" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold">{seat.label}</p>
            <p className="text-xs text-muted-foreground">
              {seat.player
                ? `${getCharacterLabel(seat.character)}${seat.playerId === playerId ? " (você)" : ""}`
                : "Aguardando"}
            </p>
          </div>
        </div>
      ))}
    </Card>
  );
}

function TopScoreBoard({
  code,
  score,
  characters,
}: {
  code: string;
  score: Record<Player, number>;
  characters: Partial<Record<Player, PlayerCharacter | null>>;
}) {
  return (
    <div className="-mt-2 mb-6 flex justify-center">
      <div className="rounded-2xl border-2 border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur max-w-md w-full">
        <div className="flex items-center justify-center gap-3 text-center">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Jogador 1</p>
            <p className="truncate text-sm font-bold">{getCharacterLabel(characters.white)}</p>
          </div>
          <div className="rounded-xl bg-accent/35 px-4 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sala {code}</p>
            <p className="text-3xl font-black leading-none tabular-nums">
              {score.white}<span className="mx-2 text-muted-foreground">:</span>{score.black}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Jogador 2</p>
            <p className="truncate text-sm font-bold">{getCharacterLabel(characters.black)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
