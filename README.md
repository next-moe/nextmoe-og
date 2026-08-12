# nextmoe-og

NextMoe 生态统一的 **Open Graph 分享图渲染服务**。给定模板名与一组字段，返回一张 1200×630 的社交分享图；缓存优先，无浏览器。

> **状态:M0 / M1 / M2 完成,M4 就绪待部署。** 服务能起、能签名、能出图、能缓存,七个模板全在,带一个 `/preview` 开发页;镜像、compose、CI 与 SSRF 防护已就位,域名定为 `og.nextmoe.dev`。剩下接入四站(M3)。决策记录见 [PLAN.md](./PLAN.md)。

## 一句话

分享图要在多个站上长成同一副样子,而这些站跑在不同的渲染模型上(Nuxt SSR 与纯 SPA)——所以渲染这件事集中做一次,而不是在每个站里各写一份。

## 边界(最重要的一条)

**本服务不碰任何数据库。** 它是一个纯函数:

```
{ template, fields, images } -> image bytes
```

标题、封面、作者、条目类型全部由**调用方**提供。catalog 数据住在 infra、论坛话题住在 forum 库、patch 住在 moyu 库——一个跨库取数的渲染器会立刻长成第二个数据聚合层,那是别人的地盘。各站自己最清楚自己的页面在讲什么,由各站喂进来。

## 技术选型

| 层     | 选型                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------- |
| 渲染   | [takumi](https://github.com/kane50613/takumi)(Rust 引擎,JSX/HTML+CSS → 图,**无 headless 浏览器**) |
| 运行时 | Node + TypeScript,`takumi-js`(Node 上自动走 native `@takumi-rs/core`)                             |
| HTTP   | Hono + `@hono/node-server`                                                                        |
| 缓存   | 磁盘(图片字节)+ Redis(元数据 / LRU)                                                               |
| 鉴权   | `Authorization: Bearer <key>`,per-site key                                                        |

骨架照抄兄弟仓 `kun-website-screenshot` 的形状(同类服务、已在产),但**不共用镜像**:那个仓的基底是 `mcr.microsoft.com/playwright`(带 Chromium,~1.5G),而 takumi 的全部卖点就是不要浏览器。

## 谁会用它

**当前范围就是这四个,不多做。**

| 栈             | 站点                            |
| -------------- | ------------------------------- |
| Nuxt4 SSR      | patch、letmoe、infra 管理控制台 |
| Vue + Vite SPA | kungal 论坛                     |

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

`GET /health` 报渲染器、Redis、队列深度与在飞数。Redis 挂了不算不健康(磁盘层照样服务),`OG_SITE_KEYS` 为空才算。

## URL 契约(下游按这个写 buildOgUrl)

```
GET /v1/og/<template>?d=<base64url(JSON.stringify(fields))>&sig=<HMAC-SHA256>
```

签名覆盖的是 **`<template>` + `\n` + `d` 这一整串**,不是 `d` 本身——只签 `d` 的话,抓到任意一张卡的 URL 就能把路径换成别的模板照样出图(未知字段会被 zod 丢掉,所以 payload 通常仍然合法)。`\n` 不可能出现在 base64url 里,拼接无歧义。

```ts
const d = Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
const sig = createHmac('sha256', SITE_SECRET).update(`${template}\n${d}`).digest('base64url');
const url = `https://og.nextmoe.dev/v1/og/${template}?d=${d}&sig=${sig}`;
```

`d` 逐字节参与缓存键,所以字段顺序变了就是另一条 URL、另一张图。**改签名格式会让所有已发出去的 URL 一起失效**,而这里没有失效协议(改数据 = 改 URL),所以格式在下游接入前定死。

两条给接入方的硬要求:

- **只签自己 CDN 白名单内的图片 URL。** `cover` / `avatar` 由调用方给,给什么就拉什么;把终端用户填的地址直接签进去,等于把 SSRF 面开放给用户。
- **会火的页面走 POST 预热。** `RENDER_CONCURRENCY` 只有 4,冷启动时突发同 payload 会撞 429。

## 模板与预览页

| 模板        | 用于               | 必填    |
| ----------- | ------------------ | ------- |
| `work`      | catalog 作品条目   | `title` |
| `character` | 角色               | `name`  |
| `label`     | 会社 / 社团        | `name`  |
| `person`    | 人物               | `name`  |
| `topic`     | 论坛话题           | `title` |
| `patch`     | patch 资源         | `title` |
| `site`      | 取不到实体时的兜底 | `name`  |

其余字段全是可选的,少给就少画一块,不会报错;远程图拉不到就退成字母块。每个模板的完整字段与一份样例见 `src/templates/<name>.ts` 里的 `schema` 与 `sample`。

`pnpm dev` 起来后开 <http://127.0.0.1:3300/preview>:选模板、改 JSON、⌘/Ctrl+Enter 重渲。这页**只在 `NODE_ENV !== 'production'` 挂载**,它不校验签名。

卡片长什么样由**接入站决定**——要换样子就加模板或改自己那个模板,不必迁就现有的。约束只有 CLAUDE.md 里那三条铁律。

## 远程图片与 SSRF

封面 URL 由调用方给,所以每一条都要过 `src/security/ssrf.ts`:只放行 http(s),主机名解析后落在私有 / 回环 / 链路本地 / 保留段的一律拒绝,**重定向每一跳都重新检查**(`redirect: 'manual'` 手动跟,最多 3 跳)。拒绝不会让渲染失败——那张图退成字母块,卡片照出。

`ALLOW_PRIVATE_HOSTS=true` 是本地开发才用的逃生门(比如图片服务跑在 localhost),生产永远 false。

预检不能把 socket 真正连上的那个 IP 钉死,所以理论上还留着 DNS rebinding 的窗口。这里不像截图服务那样上 egress proxy:响应字节从不回给调用方,只被画进一张卡,收益配不上那套复杂度。

## 部署

Dokploy,和生态里其它服务一致:CI 出镜像推 GHCR → 把 `docker-compose.prod.yml` 的 tag 钉到这次的 `:<sha>` → 触发 Dokploy 重拉。域名 **`og.nextmoe.dev`**,Traefik 终止 TLS。

```bash
docker compose up -d --build                      # 本地:带一个一次性 Redis
docker compose -f docker-compose.prod.yml pull     # 生产:Dokploy 侧
docker compose -f docker-compose.prod.yml up -d
```

这个服务和截图服务不同,它**必须对公网开放**——URL 写在 `og:image` 里,Facebook / Twitter / Telegram 的爬虫要能 GET 到。挡住乱用的是 HMAC 签名,不是网络。

Dokploy Environment 面板里要设的只有 `OG_SITE_KEYS`(留空则每个签名 GET 都 503),`REDIS_URL` 不设就走同网络的 `redis:6379`。GitHub 侧要一个 `DOKPLOY_WEBHOOK_OG` secret,没有就只推镜像不触发部署。

镜像 694 MB、无浏览器,冷启动到 `/health` 就绪约 1 秒(28 MiB 字体在 build 阶段就烤进去了,启动不联网)。

## 测试

```bash
pnpm test
```

`vitest`,52 条,不起渲染器也不联网:签名(伪造 / 篡改 / 截断)、payload 编解码与缓存 key 稳定性、SSRF 判定(含 `::ffff:` 映射伪装与"多条 A 记录里有一条私有")、以及七个模板各自的 sample 能过 schema、尺寸、角标恰好一次、无渐变、**预取没成功就绝不吐 `<img>`**。

## 相关

- 计划与决策记录:[PLAN.md](./PLAN.md)
- 同类服务先例:`kun-website-screenshot`(自托管截图,Playwright)
- 图床服务契约:infra 仓 `docs/image_service/`
