# 仓库定位、发布与故障处理

站点是纯静态的：**提交 = 部署**。GitHub Actions 在 push 到 `main` 后自动构建 `dist/` 并发布到 GitHub Pages。

---

## 一、定位用户仓库

默认仓库名 `Thinking`（与项目同名）。owner **永远是当前登录账号**（`gh api user --jq .login` 现场取），不承认写死的账号名——用户报出第三方账号的仓库时，把它当权限问题处理，而不是当目标。如果用户项目另有名字，以用户说的为准，并在对话中确认一次。

```bash
gh auth status || gh auth login          # 未登录先登录（会走浏览器/设备码流程）
owner="$(gh api user --jq .login)"       # 当前登录的账号；永不写死第三方账号
repo="$owner/Thinking"

if gh api "repos/$repo" --jq .permissions.push | grep -q true; then
  echo "已存在且可推送：$repo"
  if [ -d .git ] && git remote get-url origin 2>/dev/null | grep -q "Thinking"; then
    git pull --rebase
  else
    gh repo clone "$repo" && cd Thinking
  fi
elif gh repo view "$repo" >/dev/null 2>&1; then
  # 公开仓库 gh repo view 总能成功，不能当权限凭证
  echo "仓库存在但当前账号没有推送权限（403）：$repo"
  echo "两条路：gh auth login 切到对的账号；或由所有者把当前账号加为协作者。拿到授权前不动工。"
  exit 1
else
  echo "不存在，创建：$repo"
  gh repo create Thinking --public --description "箴言卡片站 · 一天一张十来字的卡片" --clone
  cd Thinking
fi
```

**判断清单**
- 用户已经站在仓库里（存在 `content/cards/` 与 `scripts/validate.mjs`）→ 直接就地工作，先 `git pull --rebase`。
- 只有 gh，本地无克隆 → `gh repo clone`。
- 仓库不存在 → 建站（下一节）。
- 仓库存在但 `.permissions.push` 为 false → **停止**，向用户报告 403 与两条出路（切账号 / 加协作者）。拿到授权前不动工，不要反复重试推送。
- 完全没有 gh / 未登录 → **停止**，请用户执行 `gh auth login` 或提供已登录环境。不要伪造凭证。

---

## 二、从零建站（仓库不存在时）

站点只需要一个 Node ≥ 18 的运行时，没有任何依赖。把以下骨架放进新仓库后推送即可：

```
content/site.json          # 站点标题、作者、仓库 owner/name
content/cards/*.md         # 卡片（本 skill 的产物）
scripts/validate.mjs       # 内容校验（--strict 用于 CI）
scripts/new-card.mjs       # 卡片脚手架
scripts/lib/*.mjs          # front-matter / markdown / 卡片加载
src/template.html          # 首页模板
src/card.template.html     # 单卡模板
src/styles.css  src/app.js # 样式与交互
build/build.mjs            # 静态生成器（node build/build.mjs）
.github/workflows/deploy.yml
```

若用户是**从本项目的 GitHub 模板/fork** 起点，这些文件已经齐备，直接跳到第三节。
若用户仓库是空的：从上游仓库取骨架（`gh repo clone <原仓库> .` 或下载 tarball），把 `content/site.json` 里的 `repo.owner/name` 改成用户自己的，然后：

```bash
node scripts/validate.mjs --strict
node build/build.mjs
git add -A && git commit -m "chore: bootstrap notebook" && git push -u origin main
```

**启用 Pages**（只需一次）：工作流里的 `actions/configure-pages@v5` 带 `enablement: true`，第一次运行会自动开启 Pages（需要 workflow 有 `pages: write` 权限，仓库设置里 Actions 权限用默认即可）。
若第一次运行报 Pages 未启用，也可以手动：

```bash
gh api -X POST "repos/$owner/Thinking/pages" -f build_type=workflow || \
gh api -X PUT  "repos/$owner/Thinking/pages" -f build_type=workflow
```

站点地址：`https://<owner>.github.io/Thinking/`（仓库名 `<owner>.github.io` 时则为 `https://<owner>.github.io/`）。

---

## 三、发布一张卡片

```bash
git pull --rebase                                  # 先同步
node scripts/new-card.mjs --slug <slug> --title "<箴言>" --mode <模式> --tags a,b --seed "<起点>"
$EDITOR content/cards/<slug>.md                    # 写完
node scripts/validate.mjs --strict                 # 必须通过
git add content/cards/<slug>.md
git commit -m "card: <slug> — <箴言>"
git push
```

提交信息约定（便于回溯）：

| 类型 | 格式 | 例 |
| --- | --- | --- |
| 新卡片 | `card: <slug> — <箴言>` | `card: delete-needs-courage — 删除比添加更需要勇气` |
| 修订卡片 | `revise: <slug> — 为什么改` | `revise: delete-needs-courage — 第二段太像总结` |
| 站点改动 | `site: <说明>` | `site: 收紧卡片间距` |
| 建站 | `chore: <说明>` | `chore: bootstrap notebook` |

**推送后必须验证**

```bash
gh run list --limit 1                       # 看工作流是否在跑
gh run watch                                # 跟随这一次运行（可选）
```

`gh run watch` 失败时，把失败日志的**关键几行**贴给用户，不要只说"构建失败"。常见原因：内容没过 `--strict`、Node 版本过低、Pages 未启用。

---

## 四、故障处理

**1. `gh: command not found` / 未登录**
停止并请用户 `gh auth login`（或改用已配置的 SSH 远端 `git@github.com:<owner>/Thinking.git`）。

**2. `push` 被拒（non-fast-forward）**
```bash
git pull --rebase --autostash
node scripts/validate.mjs --strict      # 解决冲突后重新校验
git push
```
绝不使用 `git push -f`。

**2b. `push` 返回 `403 Permission denied`**
这不是网络抖动，重试没有意义：当前账号对目标仓库没有写权限。回到第一节，用
`gh api "repos/$repo" --jq .permissions.push` 验证，然后请用户 `gh auth login` 切换账号，
或由仓库所有者把当前账号加为协作者。**拿到授权之前不动工。**

**3. Actions 构建失败**
```bash
gh run view --log-failed                 # 只看失败步骤的日志
node build/build.mjs                     # 本地先复现
```

**4. 卡片不出现在站点上**
- 检查是否 push 到了 `main`（工作流只监听 `main`）。
- 检查 `content/cards/<slug>.md` 的 front-matter 是否完整（缺 `date` 会被判错）。
- 检查 Actions 是否还在跑（Pages 部署通常 30–90 秒）。

**5. 内容重复被拦**
`validate.mjs` 会报「箴言与 <slug> 重复」。这不是要改措辞绕过，而是提醒你：今天想到的其实是旧卡的另一面——改用 **E · 旧笺重读**模式，与旧卡辩驳，写出真正不同的那一句。

**6. 用户想自定义域名 / 主题**
- 自定义域名：`content/site.json` 不用改，站点是相对路径；在仓库 Settings → Pages 填域名并加 `CNAME`。
- 深浅色与主色：`content/site.json` 的 `"accent"` 改一个十六进制色即可，其余交给 `src/styles.css`。

---

## 五、给用户的收尾话术

推送成功后，汇报三件事：**卡片内容**、**它属于哪种思考模式**、**站点链接**。并提醒：Actions 需要几十秒，刷新即可看到新卡片。不要只说"已完成"。
