/**
 * ============================================================
 *  🔧 全局配置（必改！）
 * ============================================================
 * 这里放的是「占位配置」。部署前必须替换成你自己的 Supabase 项目信息。
 *
 * 获取步骤（详见 README.md）：
 *   1. 登录 Supabase 控制台（或国产兼容平台 MemFire Cloud）
 *   2. 新建项目
 *   3. 打开 Project Settings → API
 *   4. 复制 Project URL  → 填入下方 projectUrl
 *   5. 复制 anon public key → 填入下方 anonKey
 *
 * 注意：anonKey 是「公开的浏览器端密钥」，可以放在前端；
 *       service_role key 是服务端密钥，绝不能放进前端代码。
 * ============================================================
 */
window.App = window.App || {};

App.config = {
  // 👇👇👇 把下面两项替换成你自己的 Supabase 项目信息 👇👇👇
  SUPABASE: {
    // 例如：https://abcdefghijklm.supabase.co
    projectUrl: "https://xnjqecepvaaxvouapblh.supabase.co",

    // 例如：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx
    anonKey: "sb_publishable_f-4lW45y8tXNmc59JjVhRw_NW-0cbGX"
  },

  // 图片存储桶名称（与 setup.sql 中创建的桶保持一致，一般不用改）
  STORAGE_BUCKET: "love_photos",

  // 本地存储键：记住当前房间和我的设备身份，一般不用改
  LS_USER_ID: "couple_love_user_id",      // 设备匿名身份 userId
  LS_ROOM_ID: "couple_love_room_id",      // 当前房间数据库内部 id
  LS_ROOM_KEY: "couple_love_room_code",   // 当前房间 6 位密钥
  LS_PROFILE: "couple_love_profile"       // 我的昵称等资料
};