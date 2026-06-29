create or replace function get_ratings_count_by_match()
returns table (match_id uuid, cnt bigint)
language sql stable
as $$
  select match_id, count(*) from cdm_player_ratings group by match_id;
$$;
