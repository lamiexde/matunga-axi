alter table public.matunga_rooms
  add column if not exists player_white_character text,
  add column if not exists player_black_character text;

alter table public.matunga_rooms
  drop constraint if exists matunga_rooms_player_white_character_check,
  drop constraint if exists matunga_rooms_player_black_character_check;

alter table public.matunga_rooms
  add constraint matunga_rooms_player_white_character_check
    check (player_white_character is null or player_white_character in ('white_horse', 'black_horse', 'grandma')),
  add constraint matunga_rooms_player_black_character_check
    check (player_black_character is null or player_black_character in ('white_horse', 'black_horse', 'grandma'));

CREATE OR REPLACE FUNCTION public.join_matunga_room(
  _code text,
  _player_id text,
  _character text
)
RETURNS public.matunga_rooms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.matunga_rooms;
BEGIN
  IF _character NOT IN ('white_horse', 'black_horse', 'grandma') THEN
    RAISE EXCEPTION 'invalid_character';
  END IF;

  SELECT * INTO r FROM public.matunga_rooms WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'room_not_found';
  END IF;

  -- already in the room; keep the character unique if a legacy room has no choice yet
  IF r.player_white = _player_id THEN
    IF r.player_black_character = _character THEN
      RAISE EXCEPTION 'character_taken';
    END IF;

    UPDATE public.matunga_rooms
       SET player_white_character = coalesce(player_white_character, _character),
           updated_at = now()
     WHERE id = r.id
     RETURNING * INTO r;
    RETURN r;
  END IF;

  IF r.player_black = _player_id THEN
    IF r.player_white_character = _character THEN
      RAISE EXCEPTION 'character_taken';
    END IF;

    UPDATE public.matunga_rooms
       SET player_black_character = coalesce(player_black_character, _character),
           updated_at = now()
     WHERE id = r.id
     RETURNING * INTO r;
    RETURN r;
  END IF;

  IF r.player_white IS NULL THEN
    IF r.player_black_character = _character THEN
      RAISE EXCEPTION 'character_taken';
    END IF;

    UPDATE public.matunga_rooms
       SET player_white = _player_id,
           player_white_character = _character,
           updated_at = now()
     WHERE id = r.id AND player_white IS NULL
     RETURNING * INTO r;
    IF FOUND THEN RETURN r; END IF;
  END IF;

  IF r.player_black IS NULL THEN
    IF r.player_white_character = _character THEN
      RAISE EXCEPTION 'character_taken';
    END IF;

    UPDATE public.matunga_rooms
       SET player_black = _player_id,
           player_black_character = _character,
           updated_at = now()
     WHERE id = r.id AND player_black IS NULL
     RETURNING * INTO r;
    IF FOUND THEN RETURN r; END IF;
  END IF;

  SELECT * INTO r FROM public.matunga_rooms WHERE code = _code;
  RETURN r;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_matunga_room(text, text, text) TO anon, authenticated;
