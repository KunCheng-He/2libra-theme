# 2libra.com 内部接口逆向记录（M0 产出）

> 2026-08 抓包分析结论。数据层（`src/content/data/`）基于本文档实现。

## 通用约定

- **Base**: `https://2libra.com`，响应为统一信封：
  ```json
  { "c": 0, "m": "请求成功", "d": { ... }, "t": 1787885920596 }
  ```
  `c === 0` 成功；非 0 为业务错误，`m` 为可展示文案。
- **认证**：Bearer token（`localStorage.access_token`），同时存在同名 Cookie。
  扩展内 same-origin `fetch(..., {credentials:'include'})` + `Authorization: Bearer <token>`（读自 localStorage）即可携带登录态。
- **分页**：`{ posts | items, total, page, limit, total_pages }`。

## 端点

| 方法 | 路径 | 参数/Body | 说明 |
|---|---|---|---|
| GET | `/api/nodes` | - | 节点树（含 children / post_count / dimensions） |
| GET | `/api/posts/latest/list` | `page, limit` | 最新帖子（首页流，匿名可用） |
| GET | `/api/posts/hot/list` | - | 热帖 |
| GET | `/api/posts/list` | `page, limit, node_id?, parent_slug?, sort?, rss?, dimensions?, tag?` | 节点过滤列表（**必须带** `node_id` 或 `parent_slug`，否则匿名空结果） |
| GET | `/api/posts/{short_id}` | - | 帖子详情：`content`(markdown) + `content_html`(不可靠) + `postscripts`(后记) + `vote/reactions` 等。表态相关：`reactions_summary`(`[{emoji,count}]`)、`my_reactions`(string[])、`rewards`(打赏记录)、`is_anonymous_author`；`node.main_emojis`/`node.sub_emojis` 为该节点可用表情 |
| GET | `/api/comments/list` | `post_short_id, page, limit` | **嵌套**评论树：`items[]`，每项含 `children[]`、`parent`、`floor`，且带 `reactions_summary`/`my_reactions`/`rewards`/`reward_pool_rewards`(金币池中奖) |
| POST | `/api/comments` | `{ postId, content, parentId, level, replyCommentId, is_anonymous, useFlatComment, aliasId? }` | 发表评论/回复。回复顶层楼层：`parentId=floorId, level=0, replyCommentId=floorId`；回复嵌套楼层：`parentId=顶层floorId, level=3, replyCommentId=嵌套id`（与站点前端行为一致） |
| POST | `/api/post-reactions/{postId}` | `{ postId, emoji, recUserId, path, postTitle, nodeId }` | **帖子表情表态（官方接口，金币扣用）**。body 需含 `postId`（服务端从 body 校验 ID，仅 URL 传参会 400「ID必须是字符串」）。成功：`{c:0,d:{type:"add"}}`（`d.type` 非空即成功）。❤️/👍 表态他人帖子扣 45 金币（对方 +24），其余表情扣 20。匿名帖不可表态。站点行为：已表态不可重复/撤销 |
| POST | `/api/comment-reactions/{commentId}` | `{ commentId, emoji, recUserId, path, comment, locatedFloor, nodeId }` | **评论表情表态**。`comment`=评论前 100 字（通知预览）；`locatedFloor`=定位楼层（站点公式 `parent.parent.floor || parent.floor || floor || 0`）。❤️/👍 扣 35（对方 +16），其余扣 20 |
| POST | `/api/rewards` | `{ type, amount, post_id, comment_id?, path }` | **打赏**（100–500 金币，步进 50；`type`: `post`/`comment`；`path` 评论时为 `/post/{slug}/{sid}?commentId={id}`）。成功 `d:"ok"` |
| POST | `/api/posts` | `{ title, content, node_id, title_prefix?, ... }` | 发帖，最小 `{title, content, node_id}` |
| GET | `/api/search` | `q` | 站内搜索（匿名返回 `d:null`，需登录） |
| GET | `/api/users/info` | - | 当前用户信息 |
| GET | `/api/notifications/unread-count` | - | 未读数（需登录）。返回 `{ unread_count, badge_unread_count, follow_unread_count, watch_content_count, home_unread_count, community_unread_count }` |
| GET | `/api/notifications/list` | `page, type?` | 通知列表（需登录）。`d = { list: NotificationItem[], total, page, limit, total_pages }`。`type` 可选：reply/reply_mention/reaction/mention/system/pandora/level_up/get_reward/favorite/content_check/badge_unlocked/follow |
| POST | `/api/notifications/mark-as-read` | `{ id: string[] }` | 批量标记通知已读（需登录） |

### NotificationItem 结构（逆向自站点前端）

```ts
{
  id: string;
  type: string;            // 同上
  is_read: boolean;
  created_at: string;
  from_user?: Author;      // 匿名回复时可能缺失
  related_id?: string;
  payload?: {
    postTitle?: string;    // 帖子标题
    postShortId?: string;  // 帖子 short_id（跳转帖子用）
    postSlug?: string;
    postNodeSlug?: string; // 帖子节点 slug（URL 第一段，缺失时站点用 "_"）
    commentId?: string;
    commentLevel?: number;
    locatedFloor?: number;
    flatFloor?: number;
    alias_id?: string;
    alias_name?: string;   // 匿名用户显示名
  };
}
```

帖子跳转 URL：`/post/{payload.postNodeSlug || "_"}/{payload.postShortId}`。

## 头像 URL 规则

```
https://r2.2libra.com/avatars/{md5(user_id)[0:4]}/{md5(user_id)[4:8]}/{user_id}.{ext}?t={ts}
```
- `ext`/`ts` 取自 `author.avatar_url`（格式 `jpg_1769303620813`，`_` 分隔）。
- 匿名（alias）头像目录为 `avatars/aliases/`。
- 实现在 `src/content/data/api.ts#avatarUrl`（自实现 md5：`src/content/data/md5.ts`）。

## 表态 / 打赏（reactions & rewards）

- **金币成本常量**（站点 `COIN_COST`）：`canGetCoinEmojis = ["👍","❤️"]`；post `{send:-20,get:0}`、comment `{send:-20,get:0}`、specialPost `{send:-45,get:24}`、specialComment `{send:-35,get:16}`（特殊表情仅在表态**他人**内容时对方得金币，自己内容仅扣钱）。
- **成功判定**：`d.type` 非空（如 `{type:"add"}`）；失败 `m` 为可展示文案。
- **匿名帖**：`post.is_anonymous_author` 为真时所有人不可表态/打赏（站点 toast「匿名贴发布者不能对匿名贴发布表情」）。
- **重复表态**：站点前端已表态的 emoji 点击为 no-op（`toggleReaction` 虽可撤销，但 UI 层不触发）。
- **打赏去重**：`rewards` 中已存在本人记录则隐藏打赏入口；给自己内容/自己别名（`localStorage["selected-alias"]`）打赏也被隐藏。
- 展示：`reactions_summary.filter(count>0)` 渲染 chips；打赏 chip 显示打赏者头像（最多 20 个，堆叠）+ 金币总额（金色）；评论 `reward_pool_rewards[0].amount` 渲染 💰 金币池 chip。实现见 `src/content/themes/wecom/components/reactions.ts`。

## 站点技术栈要点

- Next.js App Router（客户端水合 SPA），daisyUI/Tailwind，类名哈希不可依赖。
- RSC payload 可用（请求头 `RSC: 1` → `text/x-component`），本扩展未采用（REST 已覆盖全部需求）。
- 原站路由：`/`、`/post/{parent_slug}/{short_id}`、`/node/{parent}/{child?}`、`/user/{name}/about`、`/post/create`、`/search?q=`、`/login` 等。

## 策略结论（PLAN §4.3）

- **主策略 A（直接调用站点内部接口）完全可行**：读（列表/详情/评论/搜索/节点）+ 写（发帖/回复）均有稳定 REST 端点。
- 策略 B/C 无需启用；改版保护通过 `/api/nodes` 探测 + 错误回退实现。
