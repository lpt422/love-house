-- ============================================================
--  双人旅行打卡 · 点亮城市 —— 新增 travel_checkin 表
-- ============================================================
-- 使用方法：Supabase → SQL Editor → New query → 全选粘贴 → Run。
-- 说明：
--   1) 只【新增】travel_checkin 表，不动已有的 6 张表数据；
--   2) 给 love_photos 增加 checkin_id 字段，用于把照片绑定到打卡记录；
--   3) RLS 策略沿用现有风格（匿名可读写，房间密钥即权限）；
--   4) 把 travel_checkin 加入 supabase_realtime 实时发布，实现双端自动同步。
-- ============================================================

-- 1) 新增打卡表
create table if not exists public.travel_checkin (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.love_rooms(id) on delete cascade,
  city_name   text not null,          -- 城市名称
  province    text,                   -- 省份
  country     text,                   -- 国家
  visit_date  text,                   -- 到访日期 YYYY-MM-DD
  companion   text,                   -- 出行同行人备注
  note        text,                   -- 游玩感悟文本
  lon         double precision,       -- 经度（用于地图高亮，可选）
  lat         double precision,       -- 纬度（可选）
  created_by  text,                   -- 创建者 userId
  created_at  timestamptz not null default now()
);

create index if not exists idx_travel_checkin_room
  on public.travel_checkin(room_id, created_at desc);

-- 2) 给 love_photos 增加 checkin_id，照片绑定打卡记录
alter table public.love_photos
  add column if not exists checkin_id uuid
  references public.travel_checkin(id) on delete cascade;

create index if not exists idx_photos_checkin
  on public.love_photos(checkin_id);

-- 3) 权限：anon 浏览器匿名可读写新表
grant all on table public.travel_checkin to anon, authenticated;

-- 4) RLS：沿用现有「匿名可读写」策略
alter table public.travel_checkin enable row level security;

create policy "travel_checkin_read"
  on public.travel_checkin for select using (true);
create policy "travel_checkin_insert"
  on public.travel_checkin for insert with check (true);
create policy "travel_checkin_update"
  on public.travel_checkin for update using (true) with check (true);
create policy "travel_checkin_delete"
  on public.travel_checkin for delete using (true);

-- 5) 加入 Realtime 实时发布（可重复执行）
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'travel_checkin'
  ) then
    alter publication supabase_realtime add table public.travel_checkin;
  end if;
end $$;