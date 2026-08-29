# GL 层群宇宙 · 内容目录

本目录存放作者通过「创作端口」（`gl-universe/editor/`）提交的内容与站点数据。

## 目录结构

```
content/
├── site-config.json   # 站点配置（站点名/开放注册/设立密钥/写入令牌）
├── users.json         # 账号数据（加盐哈希，经 GitHub API 读写）
├── archives/          # 档案卡片（结构化 JSON）
│   └── GL-LVL-001.json
└── docs/              # 长文档（Markdown + front-matter）
    └── GL-DOC-001.md
```

独立页面生成于 `gl-universe/w/<标题>.html`，如：
`https://sh.vvplan.cn/gerenzhuye/gl-universe/w/莱特宁湖.html`

## 协作流程（Wikidot 式）

1. **注册**：作者在创作端口注册账号（用户名 + 密码 + 昵称），密码加盐哈希后存入 `users.json`。
2. **审核**：注册后状态为 `pending`，站长在管理后台批准后成为 `author`。
3. **创作**：作者新建档案卡片或长文档，保存时自动生成独立页面 `w/<标题>.html` 及页面索引。
4. **管理**：站长可审批注册、调整权限、重置密码、删除账号、修改站点配置。

## 账号格式（users.json）

```json
{
  "version": 1,
  "users": [
    {
      "u": "shuijing",
      "salt": "随机盐",
      "hash": "sha256(盐::密码)",
      "display": "静水",
      "bio": "简介",
      "role": "admin | author | pending",
      "joined": "2026-08-29"
    }
  ]
}
```

## 站点配置（site-config.json）

```json
{
  "version": 1,
  "site": { "name": "GL 层群宇宙", "allowRegister": true },
  "setupKey": "站长设立密钥（创建首个站长账号用，用后清空）",
  "token": "写入令牌（仅 content/ 目录读写权限的 GitHub Token）"
}
```

## 首次初始化（站长必做）

1. 打开创作端口，在「站长初始化」区填写：设立密钥 + 写入令牌 + 站长账号。
2. 令牌建议用 GitHub **Fine-grained token**：仅选本站仓库，Permissions → Contents: **Read and write**，路径限定 `gerenzhuye/gl-universe/content`（避免令牌可改站点代码）。
3. 之后其他作者注册 → 你在管理后台批准 → 作者开始创作。

## 安全说明

- 账号校验在浏览器本地完成（纯前端），适合小圈子协作站点；令牌仅能读写 `content/` 目录，无法修改站点代码。
- 密码以「盐 + SHA-256」哈希存储，与明文无关。
- 提交记录（commit message）即归档日志，含档案编号与作者名。