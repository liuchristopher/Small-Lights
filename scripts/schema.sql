-- small lights: schema + seed
-- Run with: psql $DATABASE_URL -f scripts/schema.sql
-- Idempotent: safe to re-run.

create extension if not exists pgcrypto;

create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,
  text text not null,
  -- status: 'live' visible, 'hidden' past flag threshold, 'removed' admin-removed, 'rejected' moderation-rejected (kept for rate-limit)
  status text not null default 'live',
  moderation_decision text,
  moderation_reason text,
  flag_count int not null default 0,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists moments_status_idx on moments(status);
create index if not exists moments_short_id_idx on moments(short_id);
create index if not exists moments_ip_hash_idx on moments(ip_hash, created_at desc);

create table if not exists flags (
  moment_id uuid references moments(id) on delete cascade,
  flagger_hash text not null,
  created_at timestamptz not null default now(),
  primary key (moment_id, flagger_hash)
);

-- Keep flag_count on moments in sync; auto-hide at 3 flags.
create or replace function update_flag_count() returns trigger as $$
declare
  new_count int;
begin
  select count(*) into new_count from flags where moment_id = new.moment_id;
  update moments
  set
    flag_count = new_count,
    status = case
      when new_count >= 3 and status = 'live' then 'hidden'
      else status
    end
  where id = new.moment_id;
  return new;
end
$$ language plpgsql;

drop trigger if exists flag_count_trigger on flags;
create trigger flag_count_trigger after insert on flags
  for each row execute function update_flag_count();

-- Seed moments (idempotent via short_id unique constraint)
insert into moments (short_id, text, status, moderation_decision) values
('seed00001a', $m$She didn't mind the shells.$m$, 'live', 'seed'),
('seed00002b', $m$We drove back from the hospital with the baby in the back. My wife kept turning around to look at her. I drove thirty the whole way home and nobody behind us honked once, which in this city is its own kind of miracle. I remember thinking, so this is the rest of our life.$m$, 'live', 'seed'),
('seed00003c', $m$He asked if he could hold my hand. I was sixty-two.$m$, 'live', 'seed'),
('seed00004d', $m$My dad learned to text this year and now he sends me pictures of clouds. Just clouds. No caption. Sometimes two or three in a row. I didn't understand it at first and then one afternoon I looked up from my desk at the sky outside my window and I got it.$m$, 'live', 'seed'),
('seed00005e', $m$My brother called. We talked about nothing for an hour.$m$, 'live', 'seed'),
('seed00006f', $m$I laughed so hard at something my coworker said in the break room that I had to go sit in my car. I cannot for the life of me remember what it was.$m$, 'live', 'seed'),
('seed00007g', $m$The cashier at the grocery store remembered my name and I don't know why that wrecked me a little.$m$, 'live', 'seed'),
('seed00008h', $m$My kid asked if I was happy and I realized I was.$m$, 'live', 'seed'),
('seed00009j', $m$Fell asleep on the couch. Woke up under a blanket.$m$, 'live', 'seed'),
('seed00010k', $m$The dog does this thing where she leans her whole weight against my leg when I'm sad. I've never figured out how she knows. My husband thinks it's coincidence but it isn't, it really isn't. Last month I got bad news on a phone call and before I'd even hung up she was there, pressed against my shin like she was trying to hold me up.$m$, 'live', 'seed'),
('seed00011m', $m$Got the job. Sat in the car a long time before I could drive home.$m$, 'live', 'seed'),
('seed00012n', $m$My sister sent me a picture of her new apartment with nothing in it yet — just her standing in the middle of an empty living room, arms out, grinning like an idiot.$m$, 'live', 'seed'),
('seed00013p', $m$Nobody needed anything from me for three hours on Saturday. That was the whole thing.$m$, 'live', 'seed'),
('seed00014q', $m$My mom called to ask what I was having for dinner. I told her. That was the whole call.$m$, 'live', 'seed'),
('seed00015r', $m$I was going through the worst stretch of my life and a friend showed up at my door with a rotisserie chicken. She didn't say anything about it, didn't ask how I was, didn't try to hug me. Just handed me the chicken, still warm through the plastic, and said she'd call me tomorrow, and left. I ate half of it standing at the kitchen counter. I'm still not over it.$m$, 'live', 'seed'),
('seed00016s', $m$I was nineteen and broke and I bought myself flowers anyway. Kept them until they were all the way dead.$m$, 'live', 'seed'),
('seed00017t', $m$Finished the book. Cat on my feet. Didn't get up.$m$, 'live', 'seed'),
('seed00018u', $m$My wife hums when she makes coffee. I don't think she knows.$m$, 'live', 'seed'),
('seed00019v', $m$I was crying in the pharmacy for completely unrelated reasons and an old man patted me on the shoulder and said "chin up, kid." I'm forty-three.$m$, 'live', 'seed'),
('seed00020w', $m$Got the MRI results back. It's nothing. I went and got a sandwich.$m$, 'live', 'seed'),
('seed00021x', $m$My grandma called me by my mother's name, then laughed at herself, and I laughed too, and for a second it was like my mom was in the room with us.$m$, 'live', 'seed'),
('seed00022y', $m$I was at a dive bar after work, just wanted a beer, and a guy I'd never seen before bought a round for the whole place because it was his last day of chemo. Everyone cheered. The bartender was crying. I was crying and I didn't even know the guy. Walked home in the rain afterward feeling weirdly light.$m$, 'live', 'seed'),
('seed00023z', $m$Walked home and someone upstairs was playing piano. Stood out there a while before going in.$m$, 'live', 'seed'),
('seed00024b', $m$The day I decided not to do it, I went and got pancakes. The waitress called me honey. I'm still here four years later. I've never told anyone that, about the pancakes. It's the part I come back to.$m$, 'live', 'seed'),
('seed00025c', $m$Ran into a friend I hadn't seen in ten years. Same coffee shop. No time had passed.$m$, 'live', 'seed')
on conflict (short_id) do nothing;
