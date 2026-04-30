import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameLayout } from "@/components/GameLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CharacterPicker } from "@/components/CharacterPicker";
import { supabase } from "@/integrations/supabase/client";
import { initialBoard, generateRoomCode, getOrCreatePlayerId, type PlayerCharacter } from "@/lib/matunga";
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
      const newCode = generateRoomCode();
      const { error } = await supabase.from("matunga_rooms").insert({
        code: newCode,
        board: initialBoard() as any,
        turn: "white",
        player_white: playerId,
        player_white_character: character,
      });
      if (error) throw error;
      navigate({ to: "/play/online/$code", params: { code: newCode } });
    } catch (e: any) {
      toast.error("Não consegui criar a sala. Tente novamente.");
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  return (
    <GameLayout title="Jogar online" subtitle="Compartilhe um código com seu oponente">
      <div className="space-y-4 max-w-3xl mx-auto">
        <Card className="p-5 bg-card/95">
          <h2 className="font-bold text-xl mb-3">Escolha seu personagem</h2>
          <CharacterPicker value={character} onChange={setCharacter} />
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
        <Card className="p-6 bg-card/95">
          <h2 className="font-bold text-xl mb-3">🎲 Criar uma sala</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Você entra como primeiro jogador. Compartilhe o código para seu oponente escolher outro personagem.
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
