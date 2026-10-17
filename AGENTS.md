# AGENTS.md — 问道长生 · AI 唯一入口

> 给所有接手这个仓库的 AI：**先读完这一页，再动手**。这里已经写清每个目录/文件的职责、改什么去哪里、新增东西放哪里。不要一上来就全仓搜索。
>
> 阅读顺序：`AGENTS.md`（本页）→ 需要动数值时读 `GAME_NUMBERS.md` → 需要理解架构/存档/坑时读 `PROJECT_OVERVIEW.md`。其余文件按下面的路由表定点打开。

---

## 0. 三十秒定向

- Vue 3 + TypeScript + Vite 的单页增量修仙游戏「问道长生」，无后端、无 vue-router。
- 全部运行时状态只有一个：`src/game/state.ts` 里的 `reactive` 单例 `state`。
- `src/game/*.ts` 放规则、数值表、纯数学；`src/components/*.vue` 只负责显示和交互；`sim/*.mjs` 是 Node 验证脚本，不参与打包。
- 入口链：`index.html` → `src/main.ts` → `src/App.vue`（页面切换 + 主循环 + 成就报条）→ `src/components/GameScreen.vue`（修行主画面）。
- 主循环只挂一次：`App.vue` 里 `bootGameLoop()`。任何页面都不许自己再起定时器算产出。
- 玩家可见文案一律中文大白话；代码注释也用中文，只写“为什么”。

**动手前三个禁止**

1. 不许再开第二份全局状态（不要 Pinia、不要新的 reactive store）。
2. 不许在没被明确要求时把 `src/game/元婴.ts` 接进运行时。
3. 不许自己打开浏览器做验证（内置面板、外部连接器、截图、快照、DOM 检查都算）。**浏览器验证极耗 token，默认交给用户**：AI 只跑 `npm run build` 和受影响的 `sim/`，需要看界面的地方在回复里请用户实点。除非用户当次明确要求，否则不碰浏览器。

> 加成轴没有数量上限：当前是丹、灵气、灵气/秒、废渣、破境点五条，新玩法可以继续加轴，但必须按 §4.2 接入统一聚合。

---

## 1. 目录地图

### 1.1 根目录

| 路径 | 职责 |
|---|---|
| `AGENTS.md` | 本文件。AI 唯一入口与路由规则 |
| `GAME_NUMBERS.md` | 玩法与数值模型：公式、经济锚点、时间线、约束清单。**改任何数值前必读** |
| `PROJECT_OVERVIEW.md` | 架构总览、加成轴与聚合、存档格式、开发工作流、已知陷阱 |
| `README.md` | 人类向的快速说明，指向本文件 |
| `index.html` | HTML 壳，挂载点 `#app` |
| `package.json` | 脚本：`dev` / `build` / `preview`。无测试框架，验证靠 `sim/` |
| `vite.config.ts` | Vite 配置 |
| `tsconfig.json` | solution-style 壳子，只引用下面两个；**所以 `vue-tsc --noEmit` 是空跑** |
| `tsconfig.app.json` / `tsconfig.node.json` | 应用与构建配置 |
| `.github/workflows/deploy.yml` | push `main` → GitHub Actions → GitHub Pages |
| `public/` | 原样拷贝的静态文件（`favicon.svg`、`icons.svg`） |
| `dist/` | 构建产物。**永远不要手改**，由 `npm run build` 生成 |
| `node_modules/` | 依赖，不读不改 |
| `sim/` | 平衡/回归验证脚本，不打包、不发版 |

线上地址：`https://skyitemchen.github.io/increment-xiuxian-game/`（push `main` 即发布）。

### 1.2 `src/` 顶层

| 路径 | 职责 |
|---|---|
| `src/main.ts` | 创建 Vue 应用，挂载 `App.vue` |
| `src/App.vue` | 最外层：开始页/游戏页切换；设置、自动化、成就、日志、测试五个整页；挂 `AchievementToast`；唯一启动主循环 |
| `src/style.css` | 全局设计变量（颜色、字号、面板底色等）与公共样式。对比度、配色改这里 |
| `src/assets/` | 模板遗留图片（`hero.png`、`vite.svg`、`vue.svg`），当前未使用，不要往上加东西 |

### 1.3 `src/game/`（全部游戏逻辑）

| 文件 | 职责 | 关键导出 |
|---|---|---|
| `state.ts` | **运行时核心**：`GameState` 定义、`state` 单例、主循环 `tick`／`bootGameLoop`、所有购买/结算入口、派生加成、成就通知、存档读写与迁移、离线结算、自动化定时器、UI 辅助格式化 | `state`、`recompute`、`activeBonus`、`buyUpgrade`、`buyRebirth`、`buyExplore`、`buyPill`、`pull`、`breakThrough`、`jindanBreak`、`jindanTreeRows`、`buyJindanTree`、`achievementRows`、`saveGame`、`loadGame`、`exportSave`、`importSave`、`settleOffline` |
| `词条与属性.ts` | **内容表与主要常量**：法门、根骨、法宝、鉴宝台、丹炉线、火候、七道精神、挑战、里程碑、丹纹四枝、成就、解锁阈值 | `LIANQI_UPGRADES`、`REBIRTH_TREE`、`EXPLORE_TREE`、`TREASURES`、`RARITY_*`、`PILL_LINES`、`PILL_MODES`、`SPIRITS`、`JINDAN_TREE`、`JINDAN_TREE_PER_LAYER`、`ACHIEVEMENTS`、`CHALLENGES`、`JINDAN_MILESTONES`、`REALM_SEQUENCE`、`Bonus`、各类 `*_UNLOCK_*`／`*_NEED` |
| `upgrades.ts` | 等级制词条的通用数学：成长值、单价、批量价、买得起多少、产出 | `growthAt`、`levelCostLog10`、`bulkCost`、`maxAffordable`、`productionOf`、`LEVEL_CEILING` |
| `rebirth.ts` | 筑基点/转生数学：一世能换多少点、根骨单价、循环回响 | `pointsForLoop`、`rebirthCost`、`POINTS_PER_DECADE`、`LOOP_ECHO`、`growthCutOf` |
| `explore.ts` | 探索纯数学：抽数、稀有度权重与概率、凡品保底、已收满档位关闭、溢出改档、押注换见识、鉴宝台解锁与单价 | `rollExplore`、`rarityWeights`、`rarityOdds`、`openRarities`、`FAN_FLOOR`、`drawCount`、`insightOfStake`、`exploreCost`、`nextRoll` |
| `金丹丹炉.ts` | 丹炉链：出丹速率、单价、批量/最大、结丹回溯倍率 | `pillRate`、`pillCost`、`pillBulkCostLog10`、`pillMaxLevels`、`jindanReturnMult`、`FURNACE_ID` |
| `凝练.ts` | 凝练转盘：抽价、roll、七道精神的当前效果、炸炉与废渣倍率、自动购买间隔 | `pullCost`、`pullMaxCount`、`rollSpirit`、`spiritAdd`、`spiritMul`、`danYieldMult`、`bustChance`、`dregYieldMult` |
| `挑战.ts` | 成就/挑战/里程碑的**判定**、累计值读取、加成轴的聚合与访问器（当前五条） | `achievementUnlocked`、`challengeUnlocked`、`milestoneUnlocked`、`totalBonus`、`danBonusAdd`、`qiBonusAdd`、`energyBonusAdd`、`dregBonusMult`、`passBonusMult` |
| `realms.ts` | 境界表与标签页：每境页面类型、破境阈值、可见境界、破境目标 | `REALMS`、`RealmPage`、`visibleRealms`、`breakRealm`、`nextRealm` |
| `更新日志.ts` | 当前版本号与更新日志数据 | `GAME_VERSION`、`CHANGELOG` |
| `元婴.ts` | 元婴**纯数学/设计层**：产量、阈值、元神模式、神武线、战斗、自动破境判定。**运行时未接**，只被 `sim/yuan-*.mjs` 引用 | `YUAN_*`、`yuanRateLog10`、`yuanThresholdLog10`、`SHENWU_LINES`、`FIGHT_MODES`、`shouldAutoBreak`、`applyMetaMult` |
| `BigNumber.ts` | 自定义大数类与格式化（尾数 + 指数，支持超大指数） | `BigNumber`、`NumberStyle` |

### 1.4 `src/components/`（UI）

| 文件 | 职责 |
|---|---|
| `App.vue` | 见 §1.2。页面枚举 `'game' \| 'settings' \| 'automation' \| 'achievements' \| 'changelog' \| 'dev'` |
| `GameScreen.vue` | 修行主画面：顶栏导航、灵气读数、境界标签、吐纳条/破境、内容区、各弹窗挂载。练气页放 `UpgradeList`；筑基页放 `RebirthPanel`（内含根骨/探索两个子标签）；金丹页放 `PillPanel`（内含丹炉/凝练/挑战三个子标签） |
| `StartScreen.vue` | 开始页：有无存档、开始/继续 |
| `SettingsPage.vue` | 设置整页：存档导出/导入、自动保存与间隔、数字记法、格式化数据 |
| `SaveDialog.vue` | 存档导出/导入弹窗：文本框、文件、识别预览 |
| `AutomationPage.vue` | 自动化整页：按境界列代买开关（法门、根骨、鉴宝台、丹炉、转盘） |
| `AchievementsPage.vue` | 成就整页：按境界折叠分档，已达成绿底/绿边/绿徽章 |
| `AchievementToast.vue` | 成就达成报条：屏幕正上方、半透明、左上角 X、自动 6.2 秒退出、队列逐条 |
| `ChangelogPage.vue` | 更新日志整页，按版本从新到旧折叠 |
| `DevPage.vue` | 测试页：全局速度、发资源。只在 `import.meta.env.DEV` 下露出入口 |
| `UpgradeList.vue` | 通用等级购买列表：每行 `1X` + `最大`；目前用于练气法门 |
| `RebirthPanel.vue` | 筑基页外壳：根骨/探索两个子标签，花筑基点与押注都在这里 |
| `BreakDialog.vue` | 破境确认弹窗：这一世清掉什么、换到什么 |
| `OfflineDialog.vue` | 「出关」字据：离线收益结算弹窗 |
| `ExplorePanel.vue` | `RebirthPanel` 的探索子标签：押注、概率、法宝收集、鉴宝台购买 |
| `ExploreDialog.vue` | 探索结果弹窗：预览与结算共用同一批抽取结果 |
| `PillPanel.vue` | 金丹页外壳：丹炉/凝练/挑战三个子标签 |
| `JindanDialog.vue` | 结丹确认弹窗：代价与所得（含结丹见识与丹纹点） |
| `NinglianPanel.vue` | `PillPanel` 的凝练子标签：抽价、七道精神、动画 |
| `ChallengePanel.vue` | `PillPanel` 的挑战子标签：挑战与结丹里程碑（含里程碑另发的丹纹点） |
| `JindanTreePanel.vue` | `PillPanel` 的丹纹子标签：四枝等级、当前/下一级效果、点一级 |
| `HelloWorld.vue` | Vue 模板遗留组件，**未被引用**。不要往里加功能 |

### 1.5 `sim/`（验证脚本，不打包）

统一用真实 TS 模块，禁止在 sim 里复制第二份数值表：

```bash
node --import ./sim/ts-hook.mjs sim/<脚本>.mjs
```

| 类别 | 脚本 |
|---|---|
| 练气/整体曲线 | `balance.mjs`、`chain.mjs`、`life-engine.mjs`、`lives.mjs`、`first-life-lib.mjs`、`realm-timeline.mjs`、`e36.mjs`、`deflate-check.mjs`、`points-ladder.mjs`、`segment-cost-check.mjs`、`segment-scan.mjs`、`zhuji-hours.mjs` |
| 探索 | `explore-check.mjs`、`explore-fan-check.mjs`、`explore-balance.mjs`、`explore-reset-check.mjs` |
| 金丹/丹炉 | `jindan.mjs`、`jindan-qi.mjs`、`jindan-anchor.mjs`、`jindan-tree.mjs`、`pill-check.mjs`、`pill-life.mjs` |
| 凝练/挑战/离线/自动化 | `ninglian-check.mjs`、`challenge-check.mjs`、`offline-check.mjs`、`automation-check.mjs` |
| 购买与被动进项 | `buy-all-check.mjs`、`buy-amount-check.mjs`、`max-buy-check.mjs`、`passive-check.mjs` |
| 元婴（纯数学） | `yuan-model.mjs`、`yuan-anchor.mjs`、`yuan-gear-check.mjs`、`yuan-meta-scale.mjs`、`yuan-auto-break.mjs` |
| 存档/工具 | `save-code.mjs`、`ts-hook.mjs` |

---

## 2. 任务路由表：要改 X，去 Y

| 我要做的事 | 先改这里 | 再改/检查这里 | 验证 |
|---|---|---|---|
| 加法门/删法门/改效果文案 | `词条与属性.ts` → `LIANQI_UPGRADES` | `UpgradeKind`/`effectText`（效果类型）、`state.ts` 的 `quoteOf`/`buyUpgrade`/`recompute`、`UpgradeList.vue` 自动复用 | `npm run build`；`sim/balance.mjs` |
| 改法门涨价曲线/分段拐点 | `UpgradeDef.growth` / `segments`（`词条与属性.ts`） | `upgrades.ts` → `growthAt`/`levelCostLog10` | `sim/segment-cost-check.mjs`、`sim/segment-scan.mjs` |
| 改破境门槛/一世时长 | `realms.ts` → `REALMS[].breakThrough` | `rebirth.ts` → `pointsForLoop`、`state.ts` → `previewBreakThrough`/`breakThrough`、`BreakDialog.vue` 文案 | `sim/realm-timeline.mjs`、`sim/lives.mjs` |
| 改根骨树（转生树） | `词条与属性.ts` → `REBIRTH_TREE` | `state.ts` → `rebirthMods`/`rebirthRows`/`buyRebirth`/`buyAllRebirth`、`RebirthPanel.vue` | `npm run build`；`sim/points-ladder.mjs` |
| 改探索概率/押注/见识/铲数 | `explore.ts`（权重、`FAN_FLOOR`、`drawCount`、`insightOfStake`） | `state.ts` → `exploreMods`/`exploreOdds`/`previewExplore`/`explore`、`ExplorePanel.vue`、`ExploreDialog.vue` | `sim/explore-check.mjs`、`sim/explore-fan-check.mjs`、`sim/explore-balance.mjs` |
| 加法宝/改品阶/改法宝效果 | `词条与属性.ts` → `TREASURES`、`RARITY_LABELS`、`RARITY_INSIGHT` | `state.ts` → `treasureMods`、`explore.ts` 抽取池、`ExplorePanel.vue`、`ExploreDialog.vue` | `sim/explore-check.mjs` |
| 改鉴宝台四条 | `词条与属性.ts` → `EXPLORE_TREE` | `explore.ts` → `exploreCost`、`state.ts` → `exploreRows`/`buyExplore`/`buyAllExplore`/`exploreMods`、`ExplorePanel.vue` | `sim/explore-balance.mjs` |
| 改丹炉链造价/出丹/结丹回溯 | `词条与属性.ts` → `PILL_LINES`、`JIEDAN_*`、`PILL_*` | `金丹丹炉.ts`（全部公式）、`state.ts` → `pillRows`/`buyPill`/`pillBatch`/`jindanState`/`jindanBreak`、`PillPanel.vue`、`JindanDialog.vue` | `sim/jindan-anchor.mjs`、`sim/jindan.mjs`、`sim/pill-check.mjs` |
| 改火候三档（丹↔废渣汇率） | `词条与属性.ts` → `PILL_MODES`、`BUST_FLOOR` | `凝练.ts` → `bustChance`/`dregYieldMult`、`state.ts` → `setPillMode`、`PillPanel.vue` | `sim/ninglian-check.mjs`、`sim/jindan-anchor.mjs` |
| 改凝练转盘/抽价/七道精神 | `词条与属性.ts` → `SPIRITS`、`PULL_BASE_SECONDS`、`PULL_GROWTH` | `凝练.ts`（`pullCost`/`rollSpirit`/`spirit*`）、`state.ts` → `pullQuote`/`spiritRows`/`pull`/`autoPull`、`NinglianPanel.vue` | `sim/ninglian-check.mjs` |
| 加成就/改成就条件 | `词条与属性.ts` → `ACHIEVEMENTS`、`AchievementMetric` | `挑战.ts` → `metricValue`/`achievementUnlocked`；`state.ts` → `counters`/`achievementRows`/`reseedAchievements`；`AchievementsPage.vue` | `sim/challenge-check.mjs` |
| 加挑战/结丹里程碑 | `词条与属性.ts` → `CHALLENGES`／`JINDAN_MILESTONES`、`ChallengeNeed` | `挑战.ts` → `challengeUnlocked`/`milestoneUnlocked`/`totalBonus`；`ChallengePanel.vue` | `sim/challenge-check.mjs` |
| 改丹纹四枝/点数投放 | `词条与属性.ts` → `JINDAN_TREE`、`JINDAN_TREE_PER_LAYER`、里程碑 `marks` | `挑战.ts` → `totalBonus`；`state.ts` → `jindanTreeEarned`/`jindanTreeRows`/`buyJindanTree`、`jindanBreak` 的见识；`JindanTreePanel.vue` | `sim/jindan-tree.mjs` |
| 改成就达成提示 | `state.ts` → `achievementNotices`/`reseedAchievements` | `AchievementToast.vue` | 交给用户实点（AI 不自行开浏览器）：出条、队列、X、6 秒自动退 |
| 给挑战/成就/里程碑换奖励 | `挑战.ts` → `totalBonus` 与各轴访问器、`词条与属性.ts` → `Bonus` | `state.ts` → `activeBonus`/`recompute`（把加成接到对应轴；新轴按 §4.2 接入） | `sim/challenge-check.mjs`；确认加成走 `Bonus` 聚合 |
| 改离线收益 | `词条与属性.ts` → `OFFLINE_CAP_SECONDS`／`OFFLINE_REPORT_SECONDS` | `state.ts` → `settleOffline`/`offlineIdleSeconds`/`settleAwayGap`、`OfflineDialog.vue`、`GameScreen.vue` 的挂载 | `sim/offline-check.mjs` |
| 改自动化 | `state.ts` 的 `*Gate`/`*Active`/`tick` 自动化段、`Settings` 开关 | `AutomationPage.vue`；存档位标（见 §4.3 存档） | `sim/automation-check.mjs` |
| 改设置项 | `state.ts` → `Settings`、`freshState` | `SettingsPage.vue`、存档编码（位标/下标） | `npm run build`；旧档读入 |
| 加/改存档字段 | `state.ts` → `GameState`、`freshState`、`SaveData`、`snapshot`、`toCode`/`fromCode`、`SAVE_VERSION` | `PROJECT_OVERVIEW.md` §7、`GAME_NUMBERS.md` 若涉及数值 | `sim/save-code.mjs`；旧档导入 |
| 加整页/改顶栏导航 | `App.vue`（页面枚举 + 挂载） | `GameScreen.vue`（按钮 + `emit`）、新页面照抄 `ChangelogPage.vue` 的整页骨架 | 交给用户实点（AI 不自行开浏览器） |
| 改全局配色/字号/对比度/面板底色 | `src/style.css` 的 `:root` 变量 | 各组件 `<style scoped>` 只做局部；小字对比度 ≥ 4.5:1 | 交给用户按真实宽度看（AI 不自行截图） |
| 改版本号/更日志 | `更新日志.ts` → `GAME_VERSION`、`CHANGELOG` | `ChangelogPage.vue` 自动显示 | `npm run build` |
| 部署 | `.github/workflows/deploy.yml` | push `main` 后核对 live bundle hash | GitHub Actions |
| 元婴 | `元婴.ts` + `sim/yuan-*.mjs` | **不要接运行时**，除非明确要求 | `sim/yuan-*.mjs` |

### 2.1 快速符号索引

- 找“钱怎么涨”：`state.ts` → `recompute()`、`activeBonus()`。
- 找“买多少/单价”：`upgrades.ts`（等级制）或 `explore.ts`／`金丹丹炉.ts`／`凝练.ts`（各自系统）。
- 找“某条加成从哪来”：`挑战.ts` → `totalBonus()` 与五个访问器。
- 找“这个成就是不是达成了”：`state.ts` → `counters()` + `挑战.ts` → `achievementUnlocked()`。
- 找“这个按钮点下去做什么”：先在 `GameScreen.vue`／对应 Panel 找 `emit` 或 `@click`，再到 `state.ts` 找同名导出函数。
- 找“这个数字存不存”：`state.ts` → `SaveData` + `toCode()`／`fromCode()`。

---

## 3. 新增内容的配方

### 3.1 新增表驱动内容（法门、根骨、法宝、鉴宝台、丹炉线、精神、丹纹、成就、挑战、里程碑）

> **铁律：带等级/层数的表（法门、根骨、法宝、鉴宝台、丹炉线、精神、丹纹）下标就是存档格式的一部分。新条目一律追加到表尾，绝不许插在中间或重排。** 插中间会让旧存档的等级错位。若确实必须重排，就得升 `SAVE_VERSION` 并写迁移映射。成就/挑战/里程碑不按下标存档，但同样建议追加到表尾，保持现有条目的顺序稳定。

步骤：

1. 在 `词条与属性.ts` 对应表**末尾**追加定义；补齐 `id`、名称、描述、`cap`、效果字段。
2. 若是新效果类型：同步改 `UpgradeKind`／`ExploreKind`／`TreasureKind`／`SpiritKind`／`Bonus` 类型与显示函数（`effectText`／`exploreCurrent`／`treasureCurrent`／`spiritCurrent`）。
3. 把效果接进运行时：`state.ts` 的 `recompute`／`rebirthMods`／`treasureMods`／`exploreMods`／`activeBonus` 等；不要只改 UI 文案。
4. UI 通常自动复用列表组件，无需新增页面；检查对应 Panel 的说明文字。
5. 存档：确认新 id 在 `encodeLevels`/`decodeLevels` 的表中顺序正确（追加即可）；若表长变化影响旧档，跑 `sim/save-code.mjs`。
6. 跑相关 sim（见 §2），再 `npm run build`。
7. 数值改动同步更新 `GAME_NUMBERS.md`。

### 3.2 新增成就

1. 在 `ACHIEVEMENTS` **末尾**追加，选已有 `realm` 分档与 `metric`。
2. 若需要新指标：扩展 `AchievementMetric`，在 `挑战.ts` → `metricValue` 中取值，并确认 `state.ts` → `counters()` 提供该累计账。
3. 奖励接到现有 `Bonus` 轴之一；需要新轴时按 §4.2 扩展 `Bonus`、`totalBonus`、`activeBonus`/`recompute`，不要只改界面数字。
4. 条件优先用“只涨不跌的累计账”，不要用会被重置的当前值。
5. 跑 `sim/challenge-check.mjs`，检查达成时间与奖励落点。

### 3.3 新增挑战/结丹里程碑

1. `CHALLENGES`／`JINDAN_MILESTONES` 末尾追加，必要时扩展 `ChallengeNeed`。
2. `挑战.ts` 补判定与 `totalBonus` 奖励。
3. `ChallengePanel.vue` 自动列出；检查文案。
4. 跑 `sim/challenge-check.mjs`。

### 3.4 新增整页

1. 新建 `src/components/XxxPage.vue`，照抄 `ChangelogPage.vue` 的整页骨架（页头 + 返回 `@back`）。
2. `App.vue`：页面枚举加一项、`import`、模板里挂载、把返回事件接回 `'game'`。
3. `GameScreen.vue`：顶栏加入口按钮并 `emit` 新事件。
4. 不要在页面里启动循环或复制产出计算；读 `state.ts` 的导出即可。
5. 提醒用户实点：进入、返回、刷新后进度不丢（AI 不自行开浏览器）。

### 3.5 新增境界链（大工程，先确认再做）

1. 先在 `GAME_NUMBERS.md` 写清资源账本、锚点、与旧链的关系。
2. `realms.ts`：给对应境界加 `page` 类型；`RealmPage` 联合类型同步。
3. 新建纯数学模块（如 `金丹丹炉.ts` 那样），再由 `state.ts` 接线；`GameState` 加字段。
4. 存档：字段追加到 `SaveData` 末尾，`SAVE_VERSION + 1`，老档给默认值。
5. 新建面板组件并在 `GameScreen.vue` 对应境界页挂载。
6. 写 sim 量锚点，跑 `npm run build`；浏览器全流程交给用户。
7. **元婴**已有纯数学模块但未接运行时；不要顺手接。化神及以上目前是占位 `todo`，不要扩展。

### 3.6 新增 sim

1. 复制现有脚本结构，用 `import` 引入真实 `src/game/*.ts`，禁止复制数值表。
2. 用 `node --import ./sim/ts-hook.mjs sim/你的脚本.mjs` 运行。
3. 输出要对人有意义：耗时、达成层数、概率、上下界，而不只是 `ok`。
4. 在本文 §1.5 或 `PROJECT_OVERVIEW.md` §9.2 登记脚本用途。

---

## 4. 硬约束（违反即返工）

### 4.1 状态与架构

- 运行时只有 `state.ts` 里的一个 `reactive` 单例；UI 不持有第二份游戏数据。
- 产出、价格、概率、奖励等数学不许写在组件里；组件只调用 `state.ts` / 纯数学模块。
- 主循环只有 `App.vue` 里的一次 `bootGameLoop()`；不要新增全局定时器算收益。
- 成就/挑战/里程碑是**推导**出来的，不单独存“已达成”状态；判定集中在 `挑战.ts`。

### 4.2 数值与加成

- **加成轴没有数量上限。** 当前是五条：丹、灵气、灵气/秒、废渣、破境点；新玩法可以继续加轴。
- 新轴必须成轴：在 `词条与属性.ts` 的 `Bonus` 接口登记，在 `挑战.ts` 的 `totalBonus()` 聚合，在 `state.ts` 的 `activeBonus()`/`recompute()` 接入，并给一个中性基准值（基准下旧锚一个数位都不许动）。
- 不要绕开 `Bonus` 聚合，在产出公式里另乘一份“私房倍率”。
- 新轴要配 sim，量它在基准值与满档下的增速，证明不会自己喂自己喂到失控（见 `GAME_NUMBERS.md` §10）。
- 丹炉与转盘的自动化门槛：结丹 1 层、转盘自转 50 次后才接管；**破境、结丹、探索押注永远手点**。
- 丹纹四枝也**永远手点**，不接自动化、不洗点：点数按结丹层数与里程碑现算，只存四枝等级。
- 自动化只代买（法门、根骨、鉴宝台、丹炉）与转盘满 50 次后自转；不要在离线时跑代买。
- 改数值必须同步 `GAME_NUMBERS.md`，并跑对应 sim；不要只改代码。
- 经济锚点（见 `GAME_NUMBERS.md`）：练气是唯一修行页，1e10 破境；金丹 1e30 开炉保底；结丹线 = 丹炉第 12 级；结丹首层 ×2、之后 ×1.25。不要随手破坏。

### 4.3 存档

- 存档是定长数组，**位置就是字段名**：新字段只往后追加，绝不插队。
- 升 `SAVE_VERSION`，并保证旧档能读（缺字段给默认值，累计账不许小于当前余额）。
- 所有表驱动等级的存档也按表下标编码：新条目追加到表尾。
- `SALVAGE_KEY` 里故意有一个省略号字符 U+2026，不是乱码；不要“修正”它。改常量后要用码点校验。
- 存档键：`xiuxian.save.v1`；旧错误键：`xiuxian.s…e.v1`（读取时会自动接管）。

### 4.4 文案与视觉

- 玩家可见文案一律简洁中文，**不许出现实现层术语**（如倍率公式、底息、走速、log10、×1.25）。
- 数字与收益不在屏幕上飘；反馈只走静态文字/报条。
- 小字对比度至少 4.5:1；颜色变量只改 `src/style.css` 的 `:root`，按面板合成底色验算。
- 真实屏宽约 2552 CSS 像素：默认铺满，不要给主容器加居中 `max-width`。
- 列表/页面按境界排序：练气 → 筑基 → 金丹；成就页按境界折叠分档，已达成用绿底/绿边/绿徽章。
- 点击控件统一长方形厚按钮 + 按压位移，不用圆形按钮。
- 购买行保留 `1X` 与 `最大`，最大那颗只写“最大”，不堆数字。

### 4.5 元婴与未来境界

- `元婴.ts` 只是纯数学与设计稿，被 `sim/yuan-*.mjs` 使用；**不接运行时**。
- 化神、炼虚等为 `page: 'todo'` 占位，不要擅自扩展新链。
- `BigNumber` 超过 1e308 的阈值必须用 `fromLog10`，不要写 `BigNumber.from(1e4800)`（字面量会变 Infinity）。

### 4.6 工程与 Git

- **唯一真类型检查**：`npm run build`（= `vue-tsc -b && vite build`）。`npx vue-tsc --noEmit` 是空跑，别用。
- **AI 不自行做浏览器验证**：不为了截图、快照或查 DOM 去开浏览器、起 dev server，这是 token 大头；需要看界面的部分写清“请用户实点”，除非用户当次明确要求。
- 没被要求就不提交、不推送；推送需明确确认。
- 永远不要运行 `git config`。需要提交时按次提供身份：
  `git -c user.name="SkyItemChen" -c user.email="118497412+SkyItemChen@users.noreply.github.com" commit ...`
- 不要手改 `dist/`、`node_modules/`；不要扩展 `HelloWorld.vue` 与模板遗留图片。
- sim 脚本不参与打包，不要为了让它跑起来改运行时导出。

---

## 5. 验证清单

### 5.1 必跑

```bash
npm run build
```

### 5.2 按改动选跑

```bash
node --import ./sim/ts-hook.mjs sim/challenge-check.mjs   # 成就/挑战/里程碑
node --import ./sim/ts-hook.mjs sim/jindan-anchor.mjs     # 结丹线锚点
node --import ./sim/ts-hook.mjs sim/jindan-tree.mjs       # 丹纹四枝：点数投放、耗时与四条轴
node --import ./sim/ts-hook.mjs sim/explore-check.mjs     # 探索抽取/溢出/空铲
node --import ./sim/ts-hook.mjs sim/explore-fan-check.mjs # 凡品收齐所需探索次数
node --import ./sim/ts-hook.mjs sim/offline-check.mjs     # 离线封顶与代买边界
node --import ./sim/ts-hook.mjs sim/ninglian-check.mjs    # 火候三档凹性
node --import ./sim/ts-hook.mjs sim/passive-check.mjs     # 按秒折点进项
node --import ./sim/ts-hook.mjs sim/save-code.mjs         # 存档编码/迁移
node --import ./sim/ts-hook.mjs sim/automation-check.mjs  # 自动化门槛
node --import ./sim/ts-hook.mjs sim/balance.mjs           # 整体曲线
```

### 5.3 浏览器（交给用户，AI 不自行执行）

**AI 不要自己打开浏览器验证。** 改完只跑 build 与 sim，然后在回复里列出需要用户实点的路径。以下清单供用户使用：

```bash
npm run dev
```

- 按真实宽度看布局，不只看窄窗口。
- 走一遍黄金路径：开始 → 吐纳 → 买法门 → 破境 → 探索 → 结丹 → 凝练 → 成就提示 → 存档导出/导入。
- 测试页入口只在 dev 出现；发版版本应没有测试入口。
- 内置浏览器面板隐藏时会停 `requestAnimationFrame`、节流定时器，截图也可能失败；详细绕法见 `PROJECT_OVERVIEW.md` §9.3。

### 5.4 完成定义

一次改动算完成，必须同时满足：

1. `npm run build` 通过；
2. 受影响的 sim 通过；
3. 受影响的界面已在回复里列给用户实点（AI 不自行开浏览器）；
4. 数值类改动同步了 `GAME_NUMBERS.md`；
5. 没有绕开 `Bonus` 聚合私改产出、没有第二份状态、没有破坏旧存档；
6. 没有未经要求的提交/推送。

---

## 6. 常见坑（详细版见 `PROJECT_OVERVIEW.md` §10）

| 坑 | 规避 |
|---|---|
| AI 自行开浏览器验证 | 截图、快照、DOM 检查都慢且耗 token；默认不做，只跑 build + sim，界面交给用户 |
| 隐藏的浏览器面板停 rAF | 用户实点前先打开面板；逻辑用 sim 验（AI 默认不碰浏览器） |
| 控制台改活体 `state` 后 reload | `pagehide` 会存档，改坏的状态会落盘；验完先改回再刷新 |
| 模块缓存 | 从 `performance.getEntriesByType('resource')` 拿真实带 `?t=` 的 URL 再 `import()` |
| 省略号污染 | `SALVAGE_KEY` 的 U+2026 是故意的；用码点校验 |
| `vue-tsc --noEmit` 假通过 | 只认 `npm run build` |
| 开发服务器白屏 | 5173 连接成功但零响应通常是控制台快速编辑挂起，不是代码问题 |
| 表中间插入新词条 | 旧存档等级错位；只能追加到表尾 |
| 离线收益重复发 | 导入存档/刷新时不要把时间戳差当离线收益；由 `bootGameLoop` 统一认 |

---

## 7. 文档分工

- 本文件：**去哪改、去哪加、不许做什么**。
- `GAME_NUMBERS.md`：**具体数值是多少、为什么是这个数、时间线是否成立**。
- `PROJECT_OVERVIEW.md`：**系统怎么拼起来、存档结构、工作流、坑的详细说明**。
- `README.md`：给人类看的简短入口。

改完架构或目录职责时，回来更新本文件的目录地图与路由表；只改数值则更新 `GAME_NUMBERS.md`。
