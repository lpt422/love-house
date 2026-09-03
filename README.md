# 🧭 我们的旅行地图（双人旅行打卡 · 点亮城市）

纯静态 H5 应用：HTML + TailwindCSS + 原生 JavaScript，无 Vue/React、无构建步骤，用本地 HTTP 服务器即可打开（不要 file:// 直接打开）。

后端使用 **Supabase**（PostgreSQL + Realtime + Storage）。

## 功能

- 💕 情侣天数卡片：相恋总天数、起始日期、可点击切换的情话
- 🗺️ 城市点亮地图：按「城市名」去重点亮，同城多个打卡点合并为一个城市
- 📍 旅行打卡：新增 / 编辑 / 删除打卡，同一城市多条记录进入「城市目录」
- 📷 旅行相册：按城市筛选、统计照片数量
- 📔 日记 · 留言：旅行日记 + 留言板合并入口
- 🎀 纪念日：添加 / 编辑 / 删除，自动计算还有几天
- 🔑 双人配对：创建房间生成 6 位数字密钥，另一方输入密钥加入，无需手机号注册
- ⚡ 双人实时同步：任一方增删改，另一方页面自动刷新（基于 Supabase Realtime）

## 技术栈

- HTML + TailwindCSS（CDN）
- 原生 JavaScript
- Supabase JS SDK v2（CDN）
- Supabase PostgreSQL + Realtime + Storage

## 目录结构

```
couple-love-supabase/
├── index.html              # 页面骨架 + CDN 引入
├── setup.sql               # 基础建表 + RLS + Realtime + Storage
├── travel_checkin.sql      # 新增旅行打卡表 travel_checkin
├── README.md
├── css/
│   └── style.css
└── js/
    ├── config.js           # 🔧 Supabase 配置（必改）
    ├── utils.js            # 工具函数
    ├── cityData.js         # 常见城市 / 省份 / 经纬度数据
    ├── chinaMap.js         # 中国地图 SVG 数据（自动生成）
    ├── supabase.js         # Supabase 客户端初始化
    ├── store.js            # 数据中枢 + Realtime 实时同步（核心）
    ├── router.js           # 页面路由（支持手机返回手势）
    ├── pairing.js          # 创建 / 加入 / 退出房间
    ├── app.js              # 启动 + 头部
    └── pages/
        ├── home.js
        ├── checkin.js
        ├── checkin-detail.js
        ├── city.js
        ├── travel-album.js
        ├── anniversary.js
        └── notes.js
```

## 一、Supabase 后台配置

> 国内访问慢可改用国产兼容平台 **MemFire Cloud**（Supabase 同款 API），步骤一致，只需替换 `projectUrl` / `anonKey`。

1. 打开 [Supabase 控制台](https://supabase.com/dashboard)，注册登录。
2. 点 **New project**，填项目名和数据库密码，选择地域。
3. 打开 **Project Settings → API**，复制：
   - **Project URL**
   - **anon public**（公开密钥）
4. 打开 **SQL Editor → New query**，先粘贴执行 `setup.sql`，再粘贴执行 `travel_checkin.sql`。
   - `setup.sql`：创建 6 张基础表、RLS、Realtime、`love_photos` 图片桶。
   - `travel_checkin.sql`：新增 `travel_checkin` 表，并给 `love_photos` 加 `checkin_id` 字段。
5. 修改 `js/config.js`：
   ```js
   SUPABASE: {
     projectUrl: "https://你的项目.supabase.co",
     anonKey: "你的 anon public key"
   }
   ```
6. 按下面「本地调试」启动。

## 二、数据表清单

| 表 | 说明 | 关键字段 |
|---|---|---|
| love_rooms | 房间 | id、room_code(6位密钥)、room_name、start_date |
| love_members | 房间成员 | room_id、user_id、nickname、color |
| travel_checkin | 旅行打卡 | room_id、city_name、province、country、visit_date、note、lon、lat |
| love_photos | 旅行照片 | room_id、photo_url、checkin_id |
| love_diary | 旅行日记 | room_id、content、mood |
| love_anniversaries | 纪念日 | room_id、title、happen_date、note |
| love_messages | 留言板 | room_id、text、anon |

## 三、图片存储

照片先压缩成 JPEG（最长边 900px、质量 0.75），再上传到公开桶 `love_photos`，数据库只存图片 URL；照片通过 `checkin_id` 绑定到打卡记录。

## 四、本地调试（不要 file:// 打开）

```bash
python -m http.server 8080
# 或
npx serve .
```

浏览器打开：<http://localhost:8080>

## 五、上线部署

把整个目录上传到任意静态托管：Vercel / Netlify / GitHub Pages / Gitee Pages / 腾讯云 COS / 阿里云 OSS 等。

部署后可把 `https://` 域名填到 Supabase **Authentication → URL Configuration → Site URL**（更稳，非必做）。

## 六、双人实时同步原理

1. 进入房间后，`store.js` 先 `select` 拉取一次历史数据。
2. 再通过 `supabase.channel(...).on('postgres_changes', ...)` 订阅所有表。
3. 任一方增删改，PostgreSQL 触发变更，Supabase Realtime 通过 WebSocket 推给另一端。
4. `store.js` 更新内存 state 并 `emit`，各页面自动重渲染，无需手动刷新。

## 七、安全提示

- ⚠️ **6 位房间密钥等同权限**：知道密钥就能加入房间并读写数据，只私发给 TA。
- 本项目为情侣个人使用场景，RLS 采用「匿名可读写」；公开产品应接入 Supabase Auth 收紧权限。
- `anonKey` 可公开；**service_role key 绝不能放进前端**。

## 八、常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| 提示未配置 Supabase | config.js 还是占位符 | 填 projectUrl / anonKey |
| 创建房间失败 | SQL 没执行 | 依次执行 setup.sql、travel_checkin.sql |
| 打卡/照片不实时同步 | Realtime 未开启 | 确认相关表已加入 `supabase_realtime` publication |
| 权限报错 | RLS 缺失 | 重新执行两个 SQL |
| 图片上传失败 | 没有 `love_photos` 桶或策略 | 执行 setup.sql 第 5 段 |
| 页面样式乱 | Tailwind CDN 没加载 | 换网络或本地化 Tailwind |