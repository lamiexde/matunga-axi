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
  getOrCreatePlayerId,
  initialBoard,
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
  turn: Player;
  winner: Player | null;
  player_white: string | null;
  player_black: string | null;
  player_white_character: PlayerCharacter | null;
  player_black_character: PlayerCharacter | null;
}

function OnlineRoom() {
  const { code } = Route.useParams();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<PlayerCharacter>("white_horse");
  const [notFound, setNotFound] = useState(false);
  const playerId = getOrCreatePlayerId();

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
    const unavailable = [
      room.player_white_character,
      room.player_black_character,
    ].filter(Boolean) as PlayerCharacter[];
    if (!unavailable.includes(selectedCharacter)) return;

    const nextCharacter = (["white_horse", "black_horse", "grandma"] as PlayerCharacter[])
      .find((character) => !unavailable.includes(character));
    if (nextCharacter) setSelectedCharacter(nextCharacter);
  }, [room, selectedCharacter]);

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

  const myColor: Player | null =
    room.player_white === playerId ? "white" :
    room.player_black === playerId ? "black" : null;

  const opponentJoined = !!room.player_white && !!room.player_black;
  const roomFull = opponentJoined && !myColor;
  const unavailableCharacters = [
    room.player_white_character,
    room.player_black_character,
  ].filter(Boolean) as PlayerCharacter[];
  const myCharacter =
    myColor === "white" ? room.player_white_character :
    myColor === "black" ? room.player_black_character : null;

  const joinRoom = async () => {
    setJoining(true);
    try {
      const { data, error } = await supabase.rpc("join_matunga_room", {
        _code: code,
        _player_id: playerId,
        _character: selectedCharacter,
      });
      if (error || !data) throw error ?? new Error("room_join_failed");
      const nextRoom = (Array.isArray(data) ? data[0] : data) as RoomRow;
      setRoom(nextRoom);
      if (nextRoom.player_white !== playerId && nextRoom.player_black !== playerId) {
        toast.error("Sala cheia.");
      }
    } catch (e: any) {
      if (String(e?.message ?? "").includes("character_taken")) {
        toast.error("Esse personagem já foi escolhido.");
      } else {
        toast.error("Não consegui entrar na sala.");
      }
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
    const newTurn: Player = myColor === "white" ? "black" : "white";
    const winner = win ? myColor : null;
    
    // Optimistic update with version check
    setRoom((prev) => {
      if (!prev || prev.id !== room.id) return prev;
      return { ...prev, board: next, turn: newTurn, winner };
    });
    
    // Send update with merge protection
    const { error } = await supabase
      .from("matunga_rooms")
      .update({ 
        board: next as any, 
        turn: newTurn, 
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
    const { error } = await supabase
      .from("matunga_rooms")
      .update({ board: initialBoard() as any, turn: "white", winner: null })
      .eq("id", room.id);
    if (error) toast.error("Erro ao reiniciar");
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

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

          {!opponentJoined && (
            <Card className="p-4 bg-accent/40 text-center text-sm animate-pulse">
              Aguardando oponente entrar com o código…
            </Card>
          )}

          <PlayerRoster room={room} playerId={playerId} />

          <TurnCard turn={room.turn} winner={room.winner} />

          <ChatBox roomId={room.id} myColor={myColor} myPlayerId={playerId} />

          {myColor && (
            <Button onClick={reset} variant="secondary" className="w-full">
              Reiniciar partida
            </Button>
          )}
        </div>

        <div className="order-1 md:order-2">
          <GameBoard
            board={room.board}
            turn={room.turn}
            winner={room.winner}
            controls={myColor ? [myColor] : null}
            locked={!opponentJoined}
            characters={{
              white: room.player_white_character,
              black: room.player_black_character,
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
      character: room.player_white_character,
      label: "Brancas",
    },
    {
      color: "black" as Player,
      player: room.player_black,
      character: room.player_black_character,
      label: "Pretas",
    },
  ];

  return (
    <Card className="p-3 bg-card/95 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Jogadores</p>
      {players.map((seat) => (
        <div key={seat.color} className="flex items-center gap-3 rounded-lg bg-muted/45 p-2">
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
                ? `${getCharacterLabel(seat.character)}${seat.player === playerId ? " (você)" : ""}`
                : "Aguardando"}
            </p>
          </div>
        </div>
      ))}
    </Card>
  );
}
