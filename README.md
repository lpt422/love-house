# 💕 我们的恋爱旅行小屋（Supabase 版）

纯静态 H5 情侣恋爱记录应用：HTML + TailwindCSS + 原生 JavaScript，无 Vue/React，无构建步骤，浏览器直接打开即可用（需用 http 服务器，不要 file:// 直接打开）。

后端使用 **Supabase**（PostgreSQL + Realtime + Storage）。

## 功能

- 🏡 恋爱首页：相恋总天数、随机情话、点亮城市
- 📖 恋爱日记：心情 + 正文
- 🎀 纪念日：新增 / 编辑 / 删除，自动计算还有几天
- 💌 留言板：可匿名留言
- 🔑 双人配对：创建房间生成 **6 位数字密钥**，另一方输入密钥加入，无需手机号注册
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
├── setup.sql               # 建表 + RLS + Realtime + Storage（一次性粘贴执行）
├── README.md
├── css/
│   └── style.css
└── js/
    ├── config.js           # 🔧 Supabase 配置（必改）
    ├── utils.js            # 工具函数（userId / 房间密钥 / 日期等）
    ├── supabase.js         # Supabase 客户端初始化
    ├── store.js            # 数据中枢 + Realtime 实时同步（核心）
    ├── router.js           # 页面路由
    ├── pairing.js          # 创建 / 加入 / 退出房间
    ├── app.js              # 启动 + 头部
    └── pages/
        ├── home.js
        ├── countdown.js
        ├── diary.js
        ├── photos.js
        ├── anniversary.js
        └── message.js
```

## 一、Supabase 后台配置（约 5 分钟）

> 国内访问慢可改用国产兼容平台 **MemFire Cloud**（Supabase 同款 API，SDK 通用），步骤完全一样，只需把 `projectUrl` / `anonKey` 换成 MemFire 项目里的地址即可。

1. 打开 [Supabase 控制台](https://supabase.com/dashboard)，注册并登录。
2. 点击 **New project**，填项目名，设置数据库密码，选择离你近的地域（海外地域即可，SDK 走 HTTPS）。
3. 项目创建完成后，打开左侧 **Project Settings → API**，复制两样东西：
   - **Project URL**
   - **anon public**（公开密钥）
4. 打开左侧 **SQL Editor → New query**，把 `setup.sql` 的**全部内容**粘贴进去，点 **Run**。
   - 这一步会创建 6 张表、RLS 权限、开启 Realtime、创建 `love_photos` 图片桶。
5. 打开本项目 `js/config.js`，替换占位配置：
   ```js
   SUPABASE: {
     projectUrl: "https://你的项目.supabase.co",
     anonKey: "你的 anon public key"
   }
   ```
6. 配置完成后，用下面「本地调试」方式启动即可。

## 二、数据表清单（setup.sql 会自动创建）

| 表 | 说明 | 关键字段 |
|---|---|---|
| love_rooms | 情侣房间 | id、room_code(6位密钥)、room_name、start_date |
| love_members | 房间成员 | room_id、user_id、nickname、color |
| love_diary | 恋爱日记 | room_id、content、mood |
| love_anniversaries | 纪念日 | room_id、title、happen_date、note |
| love_photos | 相册照片 | room_id、photo_url、note |
| love_messages | 留言板 | room_id、text、anon |

## 三、图片存储

照片先在前端压缩成 JPEG（最长边 900px、质量 0.75），再上传到 **Storage 的公开桶 `love_photos`**，数据库只保存图片 URL，不存 base64。

`setup.sql` 里已创建 `love_photos` 桶并写好上传 / 读取 / 删除策略。

## 四、本地调试（重要：不要 file:// 打开）

Supabase Realtime 需要 WebSocket，`file://` 协议下会有跨域 / 权限问题，必须用本地 HTTP 服务器。

在项目根目录执行任意一种：

```bash
# 方式一：Python（推荐，最简单）
python -m http.server 8080

# 方式二：Node.js（若无 Python）
npx serve .
```

然后浏览器打开：<http://localhost:8080>

## 五、上线部署

把整个 `couple-love-supabase` 目录（静态文件）上传到任意静态托管即可：

- Vercel / Netlify：直接拖入目录或连接仓库。
- GitHub Pages / Gitee Pages：推送仓库后开启 Pages。
- 腾讯云 COS / 阿里云 OSS 静态网站托管：上传文件并配置静态网站。

部署后把得到的 `https://` 域名在 Supabase **Authentication → URL Configuration** 的 Site URL 中填一下（本项目虽不登录，但部分平台会做来源校验，填上更稳）。

## 六、双人实时同步原理

1. 进入房间后，`store.js` 先用 `select` 拉取一次历史数据。
2. 再通过 `supabase.channel(...).on('postgres_changes', ...)` 订阅 6 张表。
3. 任一方 `insert / update / delete`，PostgreSQL 触发变更，Supabase Realtime 通过 WebSocket 推给房间内其它页面。
4. `store.js` 收到事件后更新内存 state，并 `emit` 通知各页面重新渲染——无需手动刷新。

## 七、安全提示

- ⚠️ **房间 6 位密钥等同权限**：知道密钥就能加入房间并读写数据，请只私发给 TA，不要发到公开群、朋友圈等场合。
- 本项目为情侣个人使用场景，RLS 采用「匿名可读写」策略以做到免注册；若要做公开产品，请接入 Supabase Auth 并改成按 `auth.uid()` 的成员权限策略。
- `anonKey` 可公开，但 **service_role key 绝不能放进前端**。

## 八、常见问题排错

| 现象 | 可能原因 | 解决 |
|---|---|---|
| 配对页提示未配置 | config.js 还是 `YOUR_` 占位 | 替换 projectUrl / anonKey |
| 创建房间报错 / 无反应 | setup.sql 没执行 | 去 SQL Editor 重新 Run 一遍 |
| 能写但另一台不自动刷新 | Realtime 没开启 | setup.sql 第 4 段要执行；或到 Database → Replication 确认 6 张表已加进 publication |
| 权限报错 `permission denied` | RLS 策略缺失 | 重新执行 setup.sql 的 RLS 部分 |
| 图片上传失败 | Storage 桶 / 策略缺失 | 确认存在 `love_photos` 桶，并执行 setup.sql 第 5 段 |
| 打开页面样式错乱 | Tailwind CDN 没加载 | 换网络，或把 Tailwind 改成本地文件 |
| 复制密钥失败 | 非 https 环境 | 用 `localhost` 或部署到 https 域名 |
