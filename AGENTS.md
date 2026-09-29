跨项目协作遵循 [dev-conventions 当前有效主分支](https://github.com/baicaicc/dev-conventions/blob/main/CONSTITUTION.md)。本机正本为 `/Users/kidsbox/workspace/dev-conventions/CONSTITUTION.md`；先读该正本，并按其入口读取同仓 `ADAPTATIONS.md`。本项目例外见文末。

# memo 工程宪法

个人记忆训练 H5 小游戏合集：微信内打开即玩，单局 60–90 秒、阶梯难度、本地纪录。当前为纯前端自用项目，长期会演进出服务端（成绩/反馈记录）与 AI 教练（题目分析、难度建议）。仓库公开，不存放任何凭据与私人数据。

## 先读顺序

1. 本文件（强制规则）。
2. `HANDBOOK.md`（一次迭代的完整流程）。
3. `docs/ROADMAP.md`（方向，不记状态）。

## 项目边界

- **管**：四个记忆游戏（matrix/corsi/digit/stroop）与后续新游戏、阶梯难度引擎、本地档案（雷达图/每日任务/streak）、挑战链接、部署流水线。
- **不管**：umbrella 外壳（未接入，需要时单独立卡评估）、其他产品项目。
- 需求账本 = 本仓 GitHub Issues，编号回执 `MEMO-<n>`。

## 活跃主线

- `src/games/<id>/`：每游戏一个目录，组件 + 纯逻辑分离；**出题的一切随机必须走 `core/rng.ts` 的 `createRng(seed)`**（挑战链接靠种子复现同题，这是契约）。
- `src/core/`：rng / staircase / timer / session，游戏共用的纯 TS 层，改它等于改所有游戏的契约。
- 计时一律 `performance.now()` 时间差（`core/timer.ts`），禁用定时器累加；切后台经 `onVisibilityChange` 暂停。

## 验证命令

- `corepack pnpm test`（Vitest，纯逻辑单测）
- `corepack pnpm build`（vue-tsc 类型检查 + vite 构建）
- Node 用 nvm 的 v20：`export PATH="$HOME/.nvm/versions/node/v20.18.1/bin:$PATH"`

## 部署档位

T1 云产品（轻量变体）：GitHub Actions CI/CD + EdgeOne Pages 单环境。合入 main 即自动发布到 `https://memo.sesamebox.cn`，合入与发布均 Agent 自主。发布凭证只存 GitHub Secrets，不进库。

## 项目特有规则

1. 游戏逻辑与视图分离：`games/*/logic.ts` 为纯函数并配单测；新游戏必须带同种子复现测试。
2. 无后端阶段，所有状态存 localStorage；引入服务端/AI 能力前先在 Issue 里过方案。
3. 面向大众用户：玩法零文字门槛，新游戏须评估 18–60 岁全年龄可玩性。

## 例外清单

| 宪法条款 | 本项目例外 | 理由 |
| --- | --- | --- |
| 6.1 单一运行时副本 | 不适用 | 纯静态托管（EdgeOne Pages），无本机运行时与常驻进程；部署 = CI 自动完成 |
| 第 6 节 T1 双环境 | 单环境 | 自用项目，无 dev/prod 分离需求；需要时升级 |
