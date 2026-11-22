-- Points only: points have no monetary value and are never paid out or redeemed.
-- The ten members with the most points are shown on the public leaderboard (home page and /me).
-- Point values and the ledger are unchanged (0015 / 0019).

-- Video call to action: "earn rewards" → "earn points". Only touches the line if it still has
-- the original wording, so a version you've edited in the Voice tab is left alone.
update settings
set custom_lines = (
  select jsonb_agg(
    case
      when x->>'id' = 'rewards-cta'
       and x->>'text' = 'Want to know what''s in your food? Scan your pantry at fooddiescanner.com. Join, scan, and earn rewards.'
      then jsonb_set(x, '{text}', to_jsonb('Want to know what''s in your food? Scan your pantry at fooddiescanner.com. Join, scan, earn points, and climb the leaderboard.'::text))
      else x
    end
    order by ord
  )
  from jsonb_array_elements(custom_lines) with ordinality as t(x, ord)
)
where id = 1
  and exists (select 1 from jsonb_array_elements(custom_lines) x where x->>'id' = 'rewards-cta');

