import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CharacterPicker } from "@/components/CharacterPicker";
import { supabase } from "@/integrations/supabase/client";
import {
  encodeRoomPlayer,
  createRoomTurn,
  initialBoard,
  generateRoomCode,
  getOrCreatePlayerId,
  type PlayerCharacter,
} from "@/lib/matunga";
import { toast } from "sonner";

export const Route = createFileRoute("/play/online/")({
  head: () => ({
    meta: [
      { title: "Matunga — Jogar online" },
      { name: "description", content: "Crie uma sala ou entre com um código para jogar Matunga online." },
    ],
  }),
  component: OnlineLobby,
});

function OnlineLobby() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [character, setCharacter] = useState<PlayerCharacter>("white_horse");
  const [creating, setCreating] = useState(false);

  const createRoom = async () => {
    setCreating(true);
    try {
      const playerId = getOrCreatePlayerId();
      let newCode = generateRoomCode();
      let created = false;

      for (let attempt = 0; attempt < 4 && !created; attempt++) {
        const { error } = await supabase.from("matunga_rooms").insert({
          code: newCode,
          board: initialBoard() as any,
          turn: createRoomTurn(),
          player_white: encodeRoomPlayer(playerId, character),
        });

        if (!error) {
          created = true;
          break;
        }

        if (String(error.message).toLowerCase().includes("duplicate")) {
          newCode = generateRoomCode();
          continue;
        }

        throw error;
      }

      if (!created) throw new Error("room_code_collision");
      navigate({ to: "/play/online/$code", params: { code: newCode } });
    } catch (e: any) {
      toast.error("Não consegui criar a sala. Tente novamente.");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <GameLayout title="Jogar online" subtitle="Escolha seu personagem antes de gerar o código da sala">
      <div className="space-y-4 max-w-3xl mx-auto">
        <Card className="p-5 bg-card/95">
          <h2 className="font-bold text-xl mb-3">Saguão do jogador 1</h2>
          <CharacterPicker value={character} onChange={setCharacter} />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 bg-card/95">
          <h2 className="font-bold text-xl mb-3">🎲 Criar uma sala</h2>
          <p className="text-sm text-muted-foreground mb-4">
            O código será criado com seu personagem já reservado nesta sala.
          </p>
          <Button onClick={createRoom} disabled={creating} className="w-full" size="lg">
            {creating ? "Criando…" : "Criar sala"}
          </Button>
        </Card>

        <Card className="p-6 bg-card/95">
          <h2 className="font-bold text-xl mb-3">🔑 Entrar com código</h2>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim())
                navigate({ to: "/play/online/$code", params: { code: code.trim().toUpperCase() } });
            }}
          >
            <Input
              placeholder="CÓDIGO"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="uppercase tracking-widest font-bold text-center text-xl"
            />
            <Button type="submit" className="w-full" size="lg">Entrar na sala</Button>
          </form>
        </Card>
        </div>
      </div>
    </GameLayout>
  );
}
