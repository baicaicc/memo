# memo 交付手册

## 0. 新会话入职

```bash
export PATH="$HOME/.nvm/versions/node/v20.18.1/bin:$PATH"   # 系统 node 太旧，必须用 nvm 的 v20
corepack pnpm install        # corepack 提供 pnpm
corepack pnpm dev            # 本地开发，手机同 Wi-Fi 可开 http://<本机IP>:5173
```

必读：`AGENTS.md`（强制规则）→ 本文件 → `docs/ROADMAP.md`。

## 1. 需求登记

- 仓库 Issues，回执编号 `MEMO-<n>`；建卡前先搜索去重。
- 可验收的变化（新玩法、新系统、部署/规约变更）都建卡；会话内一次性探索不建。

## 2. 理解任务

- 小修（文案/样式/bug）：PR 里写清意图 + 验证即可。
- 新游戏 / 新系统 / 引入后端或 AI：Issue 里先给方案（玩法规则、难度旋钮、计分、契约影响），再动手。

## 3. 分支与 worktree

```bash
git worktree add ~/worktrees/memo/<branch> -b <type>/<slug> origin/main
# 例：git worktree add ~/worktrees/memo/feat-nback -b feat/nback origin/main
```

多会话并行开发时必须用 worktree 隔离；合入后 `git worktree remove` + 删分支。

## 4. 实现与本地验证

验证阶梯：`corepack pnpm test` → `corepack pnpm build` → `corepack pnpm dev` 手动过一遍核心链路（玩一局 → 结算 → 档案页）。改动 challenge/种子相关逻辑时，额外验证同种子同题。

## 5. PR 与合入

门禁（宪法 §5 最小集）：`pnpm test` 与 `pnpm build` 全绿（CI 会跑）、无 secrets、rng/契约变更同步所有游戏、验证证据写进 PR 描述。

```text
技术接受 MEMO-<n>
- 检查：<跑了什么命令，结果>
- 契约：<rng/staircase/session 是否涉及，怎么同步>
- 风险与回滚：<...>
- 决定：合入 / 不合入（理由）
```

门禁全过 → squash merge（`gh pr merge --squash --delete-branch`）。

## 6. 发布

合入 main 即自动发布（Actions → EdgeOne Pages）。发布后验证：

```bash
curl -s -o /dev/null -w "%{http_code}" https://memo.sesamebox.cn   # 期望 200
```

回滚：`git revert` 合入的提交并 push（CI 自动重新部署）；或在 EdgeOne 控制台对项目 memo 的部署记录里回滚到上一 deployment。

## 7. 常见故障路由

- CI 红：`~/bin/gh run list` → `gh run view <id> --log-failed`。
- 线上白屏/404：EdgeOne 控制台 → edgeone/makers → 项目 memo → 构建部署/域名管理。
- 本地构建过但 CI 挂：优先怀疑依赖未进 `package.json`（本地 node_modules 有残留）。
