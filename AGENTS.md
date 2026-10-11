# AGENTS.md

这是一个 **箴言卡片站**（GitHub Pages 静态站）。给卡片加内容的完整流程写在
[`skill/aphorism-notebook/SKILL.md`](skill/aphorism-notebook/SKILL.md) 里——**先读它**。

## 三条最容易被忽略的规矩

1. 一张卡 = 一句 8–16 字的箴言 + 120–900 字、2–6 个 `##` 小节的旅程。不写长文，不写流水账。
2. 提交前必须 `node scripts/validate.mjs --strict` 通过（CI 用的就是它）。
3. 一次只写 1–3 张。写不出好的就别写，空转比烂卡更贵。

## 常用命令

```bash
node scripts/new-card.mjs --slug <kebab-case> --title "<箴言>" --mode <模式> --tags a,b --seed "<起点>"
node scripts/validate.mjs --strict     # 内容质量闸门
node build/build.mjs                   # 生成 dist/
node build/build.mjs --serve           # 本地预览 http://127.0.0.1:4321/
```

## 结构约定

- 卡片：`content/cards/<slug>.md`，**文件名就是地址**，必须 kebab-case。
- 站点配置：`content/site.json`（标题、作者、仓库 owner/name、主色 accent）。
- 构建产物 `dist/` 不入库，由 `.github/workflows/deploy.yml` 在 push 到 `main` 后生成并发布。
- 工具链零依赖（只用 Node 内置模块），不要引入 npm 依赖。
