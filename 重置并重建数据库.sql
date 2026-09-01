-- ============================================================
--  一键重置：删除旧表（会清空表内数据），再重建正确结构
--  使用方法：Supabase → SQL Editor → New query → 全选粘贴 → Run
--  本项目目前还没正式数据，可放心执行；如有数据请先备份。
-- ============================================================

drop table if exists public.love_messages cascade;
drop table if exists public.love_photos cascade;
drop table if exists public.love_anniversaries cascade;
drop table if exists public.love_diary cascade;
drop table if exists public.love_members cascade;
drop table if exists public.love_rooms cascade;

drop policy if exists "love_photos_storage_read" on storage.objects;
drop policy if exists "love_photos_storage_insert" on storage.objects;
drop policy if exists "love_photos_storage_update" on storage.objects;
drop policy if exists "love_photos_storage_delete" on storage.objects;

-- ============================================================
--  下面是完整的建表 + RLS + Realtime + Storage
-- ============================================================
-- ============================================================
--  💕 我们的恋爱小屋 —— Supabase 建表 + RLS + Realtime + Storage
-- ============================================================
-- 使用方式：登录 Supabase 控制台 → SQL Editor → 新建查询 →
--           把本文件全部内容粘贴进去 → Run（可整段执行，可重复执行）。
--
-- 安全说明：
--   本应用不登录账号，用 localStorage 的 userId 模拟匿名身份。
--   因此 RLS 采用「匿名可读写」策略：房间 6 位密钥就是访问凭证。
--   ⚠️ 密钥等同权限，不要发到公开群/朋友圈等任何公开场合。
-- ============================================================

-- ------------------------------------------------------------
-- 1. 业务表
-- ------------------------------------------------------------

-- 房间：6 位密钥
create table if not exists public.love_rooms (
  id          uuid primary key default gen_random_uuid(),
  room_code   text not null unique,          -- 6 位数字密钥
  room_name   text,
  start_date  text,                          -- 在一起的日子 YYYY-MM-DD
  created_at  timestamptz not null default now()
);

-- 房间成员
create table if not exists public.love_members (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.love_rooms(id) on delete cascade,
  user_id     text not null,                 -- 设备匿名 userId
  nickname    text not null,
  color       text,
  created_at  timestamptz not null default now(),
  unique (room_id, user_id)
);

-- 恋爱日记
create table if not exists public.love_diary (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.love_rooms(id) on delete cascade,
  user_id      text,
  author_name  text,
  author_color text,
  content      text not null,                -- 日记正文
  mood         text,                         -- 心情 emoji
  created_at   timestamptz not null default now()
);

-- 纪念日
create table if not exists public.love_anniversaries (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.love_rooms(id) on delete cascade,
  user_id      text,
  author_name  text,
  author_color text,
  title        text not null,
  happen_date  text,                         -- 发生日期 YYYY-MM-DD
  note         text,
  created_at   timestamptz not null default now()
);

-- 相册照片（photo_url 指向 Storage 图片）
create table if not exists public.love_photos (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.love_rooms(id) on delete cascade,
  user_id      text,
  author_name  text,
  author_color text,
  photo_url    text not null,                -- Storage 公开图片 URL
  note         text,                         -- 照片说明
  created_at   timestamptz not null default now()
);

-- 留言板
create table if not exists public.love_messages (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.love_rooms(id) on delete cascade,
  user_id      text,
  author_name  text,
  author_color text,
  text         text not null,
  anon         boolean not null default false,  -- 是否匿名留言
  created_at   timestamptz not null default now()
);

-- 常用外键查询加索引
create index if not exists idx_members_room on public.love_members(room_id);
create index if not exists idx_diary_room on public.love_diary(room_id, created_at desc);
create index if not exists idx_anniversaries_room on public.love_anniversaries(room_id, created_at desc);
create index if not exists idx_photos_room on public.love_photos(room_id, created_at desc);
create index if not exists idx_messages_room on public.love_messages(room_id, created_at desc);

-- ------------------------------------------------------------
-- 2. 权限：让 anon（浏览器匿名）能通过 API 读写这些表
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

-- ------------------------------------------------------------
-- 3. RLS 行级安全策略（匿名可读写，房间密钥即权限）
-- ------------------------------------------------------------
alter table public.love_rooms enable row level security;
alter table public.love_members enable row level security;
alter table public.love_diary enable row level security;
alter table public.love_anniversaries enable row level security;
alter table public.love_photos enable row level security;
alter table public.love_messages enable row level security;

-- love_rooms
create policy "love_rooms_read"  on public.love_rooms  for select using (true);
create policy "love_rooms_insert" on public.love_rooms  for insert with check (true);
create policy "love_rooms_update" on public.love_rooms  for update using (true) with check (true);
create policy "love_rooms_delete" on public.love_rooms  for delete using (true);

-- love_members
create policy "love_members_read"  on public.love_members  for select using (true);
create policy "love_members_insert" on public.love_members  for insert with check (true);
create policy "love_members_update" on public.love_members  for update using (true) with check (true);
create policy "love_members_delete" on public.love_members  for delete using (true);

-- love_diary
create policy "love_diary_read"  on public.love_diary  for select using (true);
create policy "love_diary_insert" on public.love_diary  for insert with check (true);
create policy "love_diary_update" on public.love_diary  for update using (true) with check (true);
create policy "love_diary_delete" on public.love_diary  for delete using (true);

-- love_anniversaries
create policy "love_anniversaries_read"  on public.love_anniversaries  for select using (true);
create policy "love_anniversaries_insert" on public.love_anniversaries  for insert with check (true);
create policy "love_anniversaries_update" on public.love_anniversaries  for update using (true) with check (true);
create policy "love_anniversaries_delete" on public.love_anniversaries  for delete using (true);

-- love_photos
create policy "love_photos_read"  on public.love_photos  for select using (true);
create policy "love_photos_insert" on public.love_photos  for insert with check (true);
create policy "love_photos_update" on public.love_photos  for update using (true) with check (true);
create policy "love_photos_delete" on public.love_photos  for delete using (true);

-- love_messages
create policy "love_messages_read"  on public.love_messages  for select using (true);
create policy "love_messages_insert" on public.love_messages  for insert with check (true);
create policy "love_messages_update" on public.love_messages  for update using (true) with check (true);
create policy "love_messages_delete" on public.love_messages  for delete using (true);

-- ------------------------------------------------------------
-- 4. 开启 Realtime（实时推送）—— 双人实时同步的关键
-- ------------------------------------------------------------
begin;
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.love_rooms;
alter publication supabase_realtime add table public.love_members;
alter publication supabase_realtime add table public.love_diary;
alter publication supabase_realtime add table public.love_anniversaries;
alter publication supabase_realtime add table public.love_photos;
alter publication supabase_realtime add table public.love_messages;

-- ------------------------------------------------------------
-- 5. Storage：创建公开图片桶 + 上传/读取/删除策略
-- ------------------------------------------------------------
grant usage on schema storage to anon, authenticated;
grant all on storage.objects to anon, authenticated;
grant all on storage.buckets to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('love_photos', 'love_photos', true)
on conflict (id) do nothing;

create policy "love_photos_storage_read"
  on storage.objects for select using (bucket_id = 'love_photos');
create policy "love_photos_storage_insert"
  on storage.objects for insert with check (bucket_id = 'love_photos');
create policy "love_photos_storage_update"
  on storage.objects for update using (bucket_id = 'love_photos') with check (bucket_id = 'love_photos');
create policy "love_photos_storage_delete"
  on storage.objects for delete using (bucket_id = 'love_photos');

-- 完成后刷新一下，回到控制台可看到 6 张业务表 + love_photos 桶