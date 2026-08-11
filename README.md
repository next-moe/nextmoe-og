# nextmoe-og

NextMoe 生态统一的 **Open Graph 分享图渲染服务**。给定模板名与一组字段，返回一张 1200×630 的社交分享图；缓存优先，无浏览器。

> **状态:M0 选型验证过关,M1 服务骨架可跑。** 现在有一个能起、能签名、能出图、能缓存的服务,接了 `work` 一个模板。剩下七个模板与预览页是 M2。决策记录见 [PLAN.md](./PLAN.md)。

## 一句话

分享图要在多个站上长成同一副样子,而这些站跑在不同的渲染模型上(Nuxt SSR 与纯 SPA)——所以渲染这件事集中做一次,而不是在每个站里各写一份。

## 边界(最重要的一条)

**本服务不碰任何数据库。** 它是一个纯函数:

```
{ template, fields, images } -> image bytes
```

标题、封面、作者、条目类型全部由**调用方**提供。catalog 数据住在 infra、论坛话题住在 forum 库、patch 住在 moyu 库——一个跨库取数的渲染器会立刻长成第二个数据聚合层,那是别人的地盘。各站自己最清楚自己的页面在讲什么,由各站喂进来。

## 技术选型

| 层 | 选型 |
|---|---|
| 渲染 | [takumi](https://github.com/kane50613/takumi)(Rust 引擎,JSX/HTML+CSS → 图,**无 headless 浏览器**) |
| 运行时 | Node + TypeScript,`takumi-js`(Node 上自动走 native `@takumi-rs/core`) |
| HTTP | Hono + `@hono/node-server` |
| 缓存 | 磁盘(图片字节)+ Redis(元数据 / LRU) |
| 鉴权 | `Authorization: Bearer <key>`,per-site key |

骨架照抄兄弟仓 `kun-website-screenshot` 的形状(同类服务、已在产),但**不共用镜像**:那个仓的基底是 `mcr.microsoft.com/playwright`(带 Chromium,~1.5G),而 takumi 的全部卖点就是不要浏览器。

## 谁会用它

**当前范围就是这四个,不多做。**

| 栈 | 站点 |
|---|---|
| Nuxt4 SSR | patch、letmoe、infra 管理控制台 |
| Vue + Vite SPA | kungal 论坛 |

其余站点是否接入,等这四个跑稳之后再单独议——不预设、不预留。

## 本地跑一次

```bash
pnpm install
pnpm fonts                       # 拉 28 MiB Noto 字体到 assets/fonts/,不入库
cp .env.example .env             # 至少改掉 OG_SITE_KEYS
pnpm dev
```

Redis 不是必需的:`REDIS_URL` 留空就只走磁盘层,本地不用起 Redis。

调一次(签名 URL 就是各站写进 `<meta>` 的那条):

```bash
URL=$(pnpm -s sign work devsecret '{"title":"素晴らしき日々〜不連続存在〜","originalName":"Subarashiki Hibi","cover":"https://example.com/cover.webp","label":"ケロQ","releaseDate":"2010-03-26","badges":["ADV","18+"]}')
curl -s -o card.webp -D - "$URL"     # 首次 X-Cache: MISS,再来一次 HIT
```

预热 / 本地预览走 POST(Bearer 就是同一把 per-site key):

```bash
curl -X POST -H 'authorization: Bearer devsecret' -H 'content-type: application/json' \
  -d '{"title":"終ノ空","badges":["ADV"]}' \
  http://127.0.0.1:3300/v1/og/work -o card.webp
```

`GET /health` 报渲染器、Redis、队列深度与在飞数。

## 相关

- 计划与决策记录:[PLAN.md](./PLAN.md)
- 同类服务先例:`kun-website-screenshot`(自托管截图,Playwright)
- 图床服务契约:infra 仓 `docs/image_service/`
