# 问道长生

Vue 3 + TypeScript + Vite 的增量修仙游戏。

- 线上：https://skyitemchen.github.io/increment-xiuxian-game/
- 玩法与数值：`GAME_NUMBERS.md`
- 架构、存档与工作流：`PROJECT_OVERVIEW.md`
- **AI/新协作者先读：`AGENTS.md`**（目录地图、任务路由、新增内容配方、硬约束）

## 开发

```bash
npm install
npm run dev
npm run build   # 唯一真类型检查 + 生产构建
```

平衡验证脚本在 `sim/`，用真实游戏模块跑：

```bash
node --import ./sim/ts-hook.mjs sim/challenge-check.mjs
```
