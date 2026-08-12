# 接入指南(下游站点读这一份)

面向 **patch / letmoe / forum / infra 控制台** 四个站。读完这份就能把分享图接上,不需要再读源码。

服务地址:`https://og.nextmoe.dev`
接入前先确认它活着:

```bash
curl -s https://og.nextmoe.dev/health
# {"status":"ok","renderer":"ready","sites":4,...}
```

`status` 不是 `ok` 就别接,先在群里说一声。

---

## 0. 三十秒版本

1. 找 infra 要你这个站的 `OG_SITE_KEY`(一串密钥,**只能待在服务端**)。
2. 抄下面的 `buildOgUrl()`。
3. 在页面的 `<head>` 里把它的返回值写进 `og:image`。

```html
<meta property="og:image" content="https://og.nextmoe.dev/v1/og/work?d=eyJ0aXRsZ...&sig=Xq3..." />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

没有 SDK,也不会有。就是一个字符串拼接,不值得为它引一个包。

---

## 1. 边界:数据全部由你提供

这个服务**不碰任何数据库**,它是一个纯函数:

```
{ template, fields, images } -> image bytes
```

标题、封面、作者、条目类型,统统是你传进来的。它不会回头来你的站上取数,也不会去别的库里拼数据。**字段内容对不对是调用方的责任**——传错了它就照着错的画。

反过来说,你不用担心它读到脏数据、不用给它开库权限、也不存在缓存和你的数据不一致的问题:数据变了 = URL 变了 = 另一张图(见 §4)。

---

## 2. URL 契约

```
GET /v1/og/<template>?d=<base64url(JSON.stringify(fields))>&sig=<HMAC-SHA256>
```

签名覆盖的是 **`<template>` + `\n` + `d` 这一整串**,不是 `d` 本身。

```ts
import { createHmac } from 'node:crypto';

const OG_BASE = 'https://og.nextmoe.dev';
const OG_SECRET = process.env.OG_SITE_KEY!; // 服务端环境变量,不要进客户端 bundle

export const buildOgUrl = (template: string, fields: Record<string, unknown>): string => {
  const d = Buffer.from(JSON.stringify(fields), 'utf8').toString('base64url');
  const sig = createHmac('sha256', OG_SECRET).update(`${template}\n${d}`).digest('base64url');
  return `${OG_BASE}/v1/og/${template}?d=${d}&sig=${sig}`;
};
```

用法:

```ts
const url = buildOgUrl('work', {
  title: '素晴らしき日々〜不連続存在〜',
  originalName: 'Subarashiki Hibi ~Furenzoku Sonzai~',
  cover: 'https://img.nextmoe.dev/covers/subahibi.webp',
  label: 'ケロQ',
  releaseDate: '2010-03-26',
  badges: ['ADV', '18+'],
});
```

**这个格式是冻结的。** 已经写进各站 HTML 的 URL 没有失效协议,改签名格式会让它们一起变成 403。要动格式必须四个站一起协调。

### 密钥不能进浏览器

签名只能在服务端算。Nuxt SSR 三站直接在 `server/` 或 `useAsyncData` 的服务端分支里调;**forum 是 Vue + Vite 的 SPA,浏览器里根本没有安全的地方放这把密钥**,而且爬虫也读不到 SPA 运行时塞的 `<meta>`——所以 forum 的 OG 标签必须由它的后端在返回 HTML 时吐出来,签名跟着一起在那儿算。如果 forum 侧没有这条链路,先在群里提,别把密钥搬进前端。

---

## 3. 模板与字段

七个模板,全部输出 1200×630 WebP。**除了下表里标"必填"的,其余字段都可以不给**——少给就少画一块,不会报错。

### `work` — catalog 作品条目

| 字段           | 类型     | 约束               | 说明                     |
| -------------- | -------- | ------------------ | ------------------------ |
| `title`        | string   | **必填**,1–200     | 主标题                   |
| `originalName` | string   | ≤200               | 原名 / 罗马字,小字副标题 |
| `cover`        | url      | ≤1000              | 封面,左侧竖图            |
| `label`        | string   | ≤80                | 会社,底部 meta 栏        |
| `releaseDate`  | string   | ≤40                | 发售日,底部 meta 栏      |
| `badges`       | string[] | 最多 4 条,每条 ≤24 | 顶部标签                 |

### `character` — 角色

| 字段           | 类型     | 约束           | 说明                |
| -------------- | -------- | -------------- | ------------------- |
| `name`         | string   | **必填**,1–120 | 角色名(走日文字形)  |
| `originalName` | string   | ≤120           | 罗马字              |
| `portrait`     | url      | ≤1000          | 立绘,`contain` 不裁 |
| `work`         | string   | ≤200           | 所属作品            |
| `voice`        | string   | ≤80            | CV                  |
| `badges`       | string[] | 最多 4 条      |                     |

### `label` — 会社 / 社团

| 字段           | 类型     | 约束           | 说明                    |
| -------------- | -------- | -------------- | ----------------------- |
| `name`         | string   | **必填**,1–120 |                         |
| `originalName` | string   | ≤120           |                         |
| `logo`         | url      | ≤1000          | `contain` 不裁          |
| `workCount`    | int      | 0–99999        | 画成大号数字 + "部作品" |
| `founded`      | string   | ≤40            | 成立年份                |
| `badges`       | string[] | 最多 4 条      |                         |

### `person` — 人物(剧本 / 原画 / 声优 …)

| 字段           | 类型     | 约束                | 说明            |
| -------------- | -------- | ------------------- | --------------- |
| `name`         | string   | **必填**,1–120      |                 |
| `originalName` | string   | ≤120                |                 |
| `photo`        | url      | ≤1000               |                 |
| `works`        | string[] | 最多 3 条,每条 ≤120 | 代表作,带点列表 |
| `badges`       | string[] | 最多 4 条           | 职能,如 `剧本`  |

### `topic` — 论坛话题

| 字段           | 类型   | 约束           | 说明            |
| -------------- | ------ | -------------- | --------------- |
| `title`        | string | **必填**,1–200 | 最多显示 3 行   |
| `excerpt`      | string | ≤300           | 摘要,最多 2 行  |
| `section`      | string | ≤40            | 板块,顶部单标签 |
| `author`       | string | ≤80            |                 |
| `authorAvatar` | url    | ≤1000          | 圆形头像        |
| `replies`      | int    | 0–999999       | 回复数          |
| `likes`        | int    | 0–999999       | 推数            |

### `patch` — patch 资源

| 字段           | 类型     | 约束           | 说明             |
| -------------- | -------- | -------------- | ---------------- |
| `title`        | string   | **必填**,1–200 |                  |
| `originalName` | string   | ≤200           |                  |
| `cover`        | url      | ≤1000          |                  |
| `platforms`    | string[] | 最多 4 条      | 顶部标签         |
| `language`     | string   | ≤40            | 底部 meta 栏     |
| `size`         | string   | ≤40            | 体积,如 `4.2 GB` |

### `site` — 取不到实体时的兜底

| 字段     | 类型   | 约束          | 说明         |
| -------- | ------ | ------------- | ------------ |
| `name`   | string | **必填**,1–80 | 居中大字     |
| `slogan` | string | ≤160          | 副标题       |
| `logo`   | url    | ≤1000         | 顶部 140×140 |

> 首页、列表页、搜索页这类没有单一实体的页面,用 `site` + 站名,别硬套 `work`。

### 传字段的几条注意

- **超长自己先截断。** 超过上限是 400,不是自动截。渲染层有 `line-clamp`,你给到上限内的完整文本就行。
- **不要传模板没声明的字段。** 会被丢掉,但它进了 `d`,白白换出一条新 URL、多一次渲染。
- **`undefined` / 空串直接删掉键**,别塞进 JSON。

```ts
const clean = <T extends object>(o: T) =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
```

---

## 4. 缓存:URL 即身份

缓存键 = `sha256(template + payload + format)`,**`d` 是逐字节参与的**。所以:

- 同样的字段、同样的键顺序 → 同一条 URL → 命中缓存,几毫秒返回(`X-Cache: HIT`)。
- 字段变了(改了标题、换了封面)→ 另一条 URL → 另一张图。
- **`JSON.stringify` 的键顺序会影响 URL。** 用一个固定的构造函数产出 fields 对象,别今天 `{title, cover}` 明天 `{cover, title}`,否则同一个页面会反复生成新图,缓存全废。

**没有失效协议,也不要来要。** 数据变了 = URL 变了,这是设计,不是缺陷。命中的响应带 `Cache-Control: immutable`,一年。

一个例外:如果封面图当时没拉下来(CDN 抽风、URL 挂了),那张卡会退化成字母块,这种响应只缓存 5 分钟且不写盘,过一会儿自己会好。

---

## 5. 封面图的硬要求

**只签你自己 CDN 白名单内的图片 URL。**

`cover` / `avatar` / `logo` 这些字段给什么服务端就去拉什么。如果你把终端用户填的地址原样签进去,等于把 SSRF 面开放给用户——服务端有 SSRF 校验兜底(私有段 / 回环 / 链路本地全拒,重定向逐跳复查),但那是最后一道防线,不是给你当过滤器用的。

图片拉不到不会让渲染失败:那一块退成字母块,卡片照出。所以你不会因为图挂了而丢掉整张分享图。

---

## 6. 预热(会火的页面建议做)

`RENDER_CONCURRENCY` 只有 4。新帖发布、新条目上线这种"一瞬间很多爬虫同时来"的场景,提前打一发 POST 把图渲好:

```bash
curl -X POST https://og.nextmoe.dev/v1/og/topic \
  -H 'authorization: Bearer <你的 OG_SITE_KEY>' \
  -H 'content-type: application/json' \
  -d '{"d":"<和 GET 里一模一样的那个 d>"}' \
  -o /dev/null
```

**一定要传 `{"d": "..."}`,不要传裸的 fields 对象**——裸对象会在服务端重新编码一次,键顺序稍有出入就落到另一个缓存键上,预热白做。

POST 用 Bearer(就是同一把 key),不需要签名。

---

## 7. 错误码

| 状态 | body                                      | 含义与处理                                     |
| ---- | ----------------------------------------- | ---------------------------------------------- |
| 400  | `{"error":"invalid_params"}`              | `d` 不是合法 base64url / JSON,或超过 8000 字符 |
| 400  | `{"error":"invalid_fields","detail":[…]}` | schema 不过,`detail` 是 zod 的 issue 列表      |
| 403  | `{"error":"bad_signature"}`               | 签错了。九成是签了 `d` 而没带 `${template}\n`  |
| 404  | `{"error":"unknown_template"}`            | 模板名拼错                                     |
| 429  | `{"error":"busy"}` + `Retry-After: 2`     | 队列满。爬虫会重试,不用你处理                  |
| 500  | `{"error":"render_failed"}`               | 渲染炸了。**请反馈**,带上那条 URL              |
| 503  | `{"error":"service_unconfigured"}`        | 服务端没配 key。找 infra                       |

自测时把 URL 直接 `curl -D -` 一下比在推特上试快得多。

---

## 8. 卡片长什么样,是你说了算

**理想状态是绝大多数卡片由下游自定义。** 这个服务只拥有机器部分——签名、缓存、队列、字体、远程图预取——以及共享骨架、配色和角标。**卡上写什么、带哪些字段、大体长什么样,是接入站的决定。**

所以:

- 现有模板不合适,**不要迁就它**。提一个新模板,或者把你那个模板改成你想要的样子。
- 不存在"必须和别的站长一样"这条规矩。

只有三条不能动:不许渐变背景;角标恒为 `NextMoe·未萌`;服务永远不碰数据库。

---

## 9. 请及时反馈

**这个服务还很年轻,四个站是它的第一批真实用户。任何觉得可以更好的地方,都请立刻提出来,不要自己在下游绕过去。**

特别希望听到这些:

- 字段不够用 / 字段限制太紧(比如 `badges` 只能 4 条不够、标题 200 字不够)。
- 某个模板的排版在真实数据下崩了、截断得难看、CJK 字形不对。
- 想要新的模板,或者现有模板想要另一种版式。
- 想要方图 / 竖图(微信、QQ 的分享位不是 1200×630)——**这一条目前还没做,有需求就说,有人要才排期**。
- WebP 在某个平台的爬虫上不显示(全局可以切成 PNG)。
- 出现 429 / 500,或者哪张卡渲得特别慢。
- 这份文档哪里没写清楚、照着做做不通。

反馈渠道:`nextmoe-og` 仓库开 issue,或者直接在群里 @ 一下,带上**那条完整的签名 URL**(它自包含,拿到就能复现)。

绕过去的做法——在下游自己截图、自己拼图、把服务当图床用——都会让这个服务停在"够用但不好用"的状态,请不要那么做。

---

## 10. 本地怎么试

不想为了调一张卡去起整个服务的话,签名 URL 直接打生产就行(你有 key)。要在本地起:

```bash
pnpm install && pnpm fonts && cp .env.example .env
pnpm dev                                    # :3300
pnpm sign work devsecret '{"title":"終ノ空"}'   # 打印一条可直接 curl 的签名 URL
```

`pnpm dev` 起来后 <http://127.0.0.1:3300/preview> 是一个开发预览页:选模板、改 JSON、⌘/Ctrl+Enter 重渲,**不校验签名**,只在非 production 挂载。想比对几种字段组合的效果,这页最快。
