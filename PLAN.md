# nextmoe-og 计划书

写于 2026-08-11,动工前。本文件是决策记录 + 路线图;开工后**就地更新**,不写流水日记(流水在 git log 里)。

---

## 1. 范围,以及为什么集中

**范围(2026-08-11 定,四个站,不多做):**

| 栈 | 站点 |
|---|---|
| Nuxt4 SSR | `kun-galgame-patch`、`kun-letmoe-community`、`kun-galgame-infra/apps/web` |
| Vue + Vite SPA(无 Nuxt) | `kun-galgame-forum/apps/web` |

其余站点一律**不在范围内**,也不为它们预留抽象。将来要加,那时再议。

**为什么不是每站各写一份:**

1. **两种渲染模型,不是一种。** 论坛是纯 SPA——meta 标签只能由后端注入,跟 Nuxt SSR 的做法完全不同。每站一份等于把同一套版式在两种模型里各实现一遍,而模板迭代是这类东西的日常。
2. **视觉一致性会分叉,而且有先例。** infra 的 `image_presets.yaml` 里 `galgame_screenshot` 那段注释记录着 kungal 与 moyu 各自复用了不同 preset、随即漂移的事故。分享图是对外的品牌门面,分叉代价比缩略图大得多。
3. **共享库省不掉分叉。** 就算每站都装 takumi,共享的是**库**,不是**模板与字体资产**——而后者才是会漂的东西。字体那几十 MB 更不该在四个仓里各带一份。

## 2. 边界

**渲染器不碰数据库、不回调各站 API。** 纯函数:`{template, fields, images} -> bytes`。

理由:数据分属不同库与不同轨(catalog 在 infra、论坛在 forum、patch 在 moyu)。跨库取数的渲染器 = 第二个数据聚合层,既越界又会把本服务的可用性绑死在三个上游上。

推论:**调用方负责数据正确性**,本服务只负责"给什么画什么"和"画得一致"。

## 3. 架构

```
站点 SSR/后端                     nextmoe-og                       爬虫
  |                                  |                              |
  |-- 构造签名 URL 写进 <meta> -->    |                              |
                                     |  <---- GET /v1/og/...  ------|
                                     |
                                     |-- 命中磁盘缓存 -> 直接返回字节
                                     |-- 未命中 -> takumi 渲染 -> 落盘 -> 返回
```

### 3.1 URL 形态:签名参数,自包含

爬虫只会 GET 一个 meta 标签里的 URL,所以数据必须**要么在 URL 里,要么服务能自己取**。既然 §2 定死了不回调,那就走**签名参数**:

```
GET /v1/og/<template>?d=<base64url(json)>&sig=<hmac>
```

- `d` = 字段 JSON(标题、副标题、图片 URL、类型徽章……)
- `sig` = HMAC-SHA256(site_key_secret, d),防止任意第三方拿我们的渲染器画任意内容
- 缓存 key = `template + d` 的哈希——**天然幂等**:同样的数据永远同一张图,同样的 URL
- 失效由**调用方**掌握:条目标题变了,`d` 就变了,URL 就变了,缓存自动绕开。服务侧不需要任何失效协议

代价:URL 长(估计 300–600 字符)。可接受——meta 标签不面向人类阅读,各大爬虫对 URL 长度也没有实际限制。

`POST /v1/og/<template>`(Bearer key,body 直接给 JSON)同时提供,用于预热与本地预览。

### 3.2 缓存

- **磁盘**存图片字节,**Redis** 存元数据 / LRU / 计数(照抄 `kun-website-screenshot` 的分层)
- 命中直接 `sendfile`,毫秒级
- 响应带长 `Cache-Control`(URL 幂等,可以放心 `public, max-age=31536000, immutable`)
- 单飞(single-flight):同一 key 并发只渲染一次

### 3.3 不入 image 服务

OG 卡片是**可再生的派生物**。进 infra 的 `image_service` 意味着要占一个 preset、进 `imagerefs` 全集、被 `catalog-image-refping` 每天喂一遍才不被 GC 吃掉——用永久字节存储装一个随时能重算的东西,还把 GC 全集撑大。自带缓存即可。

## 4. 已知风险与待验事项(M0 实测结论,2026-08-11)

**M0 结论:选型过关。** 样张零豆腐块,冷启动 34 ms,暖渲染 7–14 ms。样张见 `samples/`,复现脚本 `scripts/m0-bench.ts`(`pnpm fonts && pnpm bench`)。

### 4.1 CJK 字体 —— 已定档

takumi **从不读系统字体**,`@takumi-rs/core` 只内置 Geist(Latin,400–800),缺字形直接渲染成豆腐块。字体字节要我们自己带。

定下来的方案:**Google Fonts 上游的三个可变字重字体(variable `wght`),全量不子集化。**

| 文件 | 体积 | 家族名 |
|---|---|---|
| `NotoSans[wdth,wght].ttf` | 2.0 MiB | `NextMoe Sans`(拉丁/希腊/西里尔) |
| `NotoSansJP[wght].ttf` | 9.1 MiB | `NextMoe JP` |
| `NotoSansSC[wght].ttf` | 16.9 MiB | `NextMoe SC` |
| 合计 | **28.0 MiB** | |

实测要点:

- **可变字重可用**。三个文件各只 `registerFont` 一次(声明 `weight: 400`),CSS 里写 `font-weight: 700` 引擎会走 `wght` 轴,真出粗体——不需要为每个字重单独带一个静态字重文件。这直接砍掉一半体积。
- **不子集化**。28 MiB 全量的冷启动是 34 ms、RSS 189 MiB;子集化省下的那点内存不值得引入"某个冷门异体字没在子集里 → 线上豆腐块"的长尾故障。子集化留给内存吃紧时再谈。
- **日中字形靠 font-family 顺序分流,不靠码位**。字体栈是有序 fallback:日文原名用 `'NextMoe Sans','NextMoe JP','NextMoe SC'`,中文标题用 `'NextMoe Sans','NextMoe SC','NextMoe JP'`。同码位不同字形的取舍因此是**模板按字段决定**的,不是全局一刀切。
- **emoji 用 `emoji: 'from-font'`**。takumi 默认 `emoji: 'twemoji'`,会把 emoji 抠出来去 CDN 拉 PNG——等于给每次渲染加一个外网依赖。`♥ ★ ☆ ♪ ※ → Ⅰ–Ⅴ` 这些符号 Noto 自带,不需要 Noto Color Emoji。真要彩色 emoji 再单独议。
- 字体不入库(28 MiB),`.gitignore` 挡掉 `assets/fonts/*.ttf`,`pnpm fonts` 从 `google/fonts` 仓拉。

**样张 `samples/m0-dirty-data.png` 零豆腐块**:「白昼夢の青写真」「サクラノ詩 −櫻ノ森ノ上ヲ舞フ−」「終ノ空」、简繁同句对照、`Ⅰ Ⅱ Ⅲ Ⅳ Ⅴ ♥ ★ ☆ ♪ ※ →`、`(全角)「引用」【标签】〜〜` 全部正常。

### 4.2 CSS 是子集,不是浏览器

takumi 支持 Grid/Flex/block/inline/float、`::before`/`::after`、mask/clip-path、blend mode、`background-clip: text`、锥形渐变,以及 **Tailwind v4 工具类**;但整体仍"比 Chrome 少"。

**KunUI 组件不能直接复用**——模板是手写受限 CSS。这条要提前对齐预期,不然会有"用 KunUI 拼一下就行"的误判。

> 生态铁律照旧适用:**任何 UI 不得使用渐变背景**,颜色只用项目色板。卡片模板同样受此约束(锥形渐变支持与否不影响这条——我们本来就不用)。

### 4.3 远程图片 —— 引擎会自己拉,但**必须夺回来自己拉**

实测:`takumi-js` 的 `render()` 走 `prepareImages()`,**自己扫节点树里的 `<img src="http…">` 并用 `globalThis.fetch` 拉字节**,调用方什么都不用做。远程封面确实画进去了(`samples/m0-work-remote-cover.png`)。

但这条路对生产不能用,原因是**失败行为**:

- `render()` 内部调 `prepareImages` 时**没有把 `throwOnError` 透出来**,而它默认是 `true`。所以封面 404 / DNS 挂 / CDN 超时 = **整张渲染抛异常**(实测抛 `fetch failed`),正好踩中 §4.3 最想避免的那件事。
- 那次远程拉图给首帧加了 **7.0 s**(picsum 慢),而渲染本身只要 7 ms。图片 I/O 必须在我们自己的超时控制下。

所以定成:**调用方(本服务)预取封面字节,把 `images: [{src, data}]` 喂给渲染器**,渲染器只做排版。降级路径两级:

1. 预取失败 → 模板不生成 `<img>`,直接换成纯文字占位块(`samples/m0-work-text-only.png`)。
2. 万一漏网(节点里留了个拉不到的 `src`)→ 实测 takumi 不报错,画一个空盒子(`samples/m0-work-cover-failed.png`)。丑,但不炸。

**整张渲染永远不因为图片失败而失败。**

### 4.4 性能与并发 —— 实测

机器:本地开发机,Node 24,`@takumi-rs/core` 2.7.1 native(linux-x64-gnu)。

| 指标 | 实测 |
|---|---|
| 冷启动(native 模块 import) | 17.4 ms |
| 冷启动(Renderer + 28 MiB 字体注册) | 16.5 ms |
| **冷启动合计** | **33.9 ms** |
| 单张渲染(纯文字卡,10 张均值) | **7.0 ms** |
| 单张渲染(带已预取封面,10 张均值) | **13.6 ms** |
| **常驻内存 RSS**(字体常驻 + 渲染完成后) | **188.8 MiB** |

对比参照:`kun-website-screenshot` 的 Playwright 基底光镜像就 ~1.5 G,冷启动以秒计。**takumi 的冷启动比它快两个数量级**,这条选型理由成立。

输出格式:同一张卡 PNG 530 KB / WebP q88 **33 KB**。默认出 WebP,PNG 按需。

并发仍用 p-queue 背压,超出直接 429 而不是排队到超时。

### 4.5 CSS 踩过的坑

- `display: -webkit-box` **不支持,直接抛 `InvalidArg`**。多行截断要写标准的 `line-clamp: 2; overflow: hidden; text-overflow: ellipsis`(无前缀,不需要配 `display`),实测正常出省略号。
- 单行截断 `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` 正常。

## 5. 模板清单(首批)

一张 1200×630 打底;方形/竖版(微信、QQ)按需再议。

| 模板 | 用于 | 关键字段 |
|---|---|---|
| `work` | catalog 作品条目页 | 标题、原名、封面、会社、发售日、类型徽章 |
| `character` | 角色页 | 名字、立绘(已去白底,透明)、所属作品 |
| `label` | 会社/社团页 | 名称、logo、作品数 |
| `person` | 人物页 | 名字、照片、代表作 |
| `topic` | kungal 论坛话题 | 标题、作者头像+名、板块、回复数 |
| `patch` | moyu patch 页 | 标题、封面、平台徽章 |
| `site` | 四站首页兜底 | 站名、slogan、站徽 |

前四个是 catalog 实体页(letmoe / 论坛 / infra 控制台都在渲染同一批实体),`topic` 与 `patch` 各归其站,`site` 是任何页面取不到实体时的兜底。

模板之间共享同一套版式骨架(左图右文 / 满幅图 + 底部信息条),差异只在字段与徽章。

## 6. 里程碑

- **M0 — 选型验证** ✅ **过关**(2026-08-11)
  样张零豆腐块,冷启动 33.9 ms,单张 7.0 / 13.6 ms,RSS 188.8 MiB。结论进 §4.1/§4.3/§4.4/§4.5,样张在 `samples/`,复现:`pnpm fonts && pnpm bench`。

- **M1 — 服务骨架** ✅ **可跑**(2026-08-11)
  Hono + per-site key + HMAC 签名校验 + 磁盘/Redis 双层缓存 + single-flight + p-queue 背压 + `/health`,接了 `work` 一个模板。实测:12 个并发打同一个 key 只渲染 1 次;并发 1 / 队列上限 2 下打 40 个不同 key 得到 4×200 + 36×429(不排队到超时)。
  两条落地时改了原计划的地方:
  - **Redis 做成可选**。`REDIS_URL` 留空则只有磁盘层,TTL 退化为看文件 mtime,LRU 记账关掉。本地开发不该被一个 Redis 绑死。
  - **签名 URL 里不带 site id**,校验时对每把 key 各算一次 HMAC(常量时间比较)。站点是个位数,这比把 site id 塞进 URL 契约便宜。同一把 secret 既是 HMAC key 也是 POST 的 Bearer token。

- **M2 — 模板全套 + 预览页**
  §5 七个模板;附一个 `/preview` 开发页(任意填字段实时看图),这是模板迭代效率的关键。

- **M3 — 接入四站**
  letmoe(Nuxt SSR)+ patch(Nuxt SSR)+ kungal 论坛(Vue SPA,meta 需由后端注入——最难的一种形态,先啃)+ infra 管理控制台。各站提供一个 `buildOgUrl()` 小工具函数,不引 SDK。

- **M4 — 部署**
  Dokploy compose、域名(建议 `og.nextmoe.dev`)、per-site key 下发、缓存盘容量与 LRU 上限定档。范围到此为止;是否再接别的站是**另一次决策**,不在本计划内。

## 7. 纪律

沿用生态既有规矩:

1. commit message 全英文。
2. 注释默认没有;只有**已经发生过的错误**才配一条注释,写结论不写机制。
3. 前端/模板不用渐变背景,颜色只用项目色板。
4. 全部箭头函数。
5. 单文件控制在 ~500 行内。
6. push 与部署归用户拍板。
7. 声称"全部/没有"之前,grep 所有兄弟仓再说。

## 8. 待用户拍板

- 域名:`og.nextmoe.dev`?
- 卡片形态:先只做 1200×630,还是同期出方形给微信/QQ?
- 四站的接入顺序(建议 letmoe → patch → 论坛 → infra 控制台)。
