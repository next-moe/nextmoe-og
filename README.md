# nextmoe-og

NextMoe 生态统一的 **Open Graph 分享图渲染服务**。给定模板名与一组字段，返回一张 1200×630 的社交分享图；缓存优先，无浏览器。

> **状态:未动工。** 本仓目前只有设计与计划(见 [PLAN.md](./PLAN.md))。代码尚未开始。

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

## 相关

- 计划与决策记录:[PLAN.md](./PLAN.md)
- 同类服务先例:`kun-website-screenshot`(自托管截图,Playwright)
- 图床服务契约:infra 仓 `docs/image_service/`
