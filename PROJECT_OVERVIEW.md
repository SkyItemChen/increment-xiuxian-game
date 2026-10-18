# 问道长生 — 项目总览（给后续大模型看）

> 这是一份修仙题材的增量游戏（idle/incremental game），Vue 3 + TypeScript，部署在 GitHub Pages。
> 本文档的目标：让另一个大模型接手开发时，不用问基础问题就能直接干活。
> **AI 入口是 [`AGENTS.md`](AGENTS.md)**：目录地图、任务路由表、新增内容配方与硬约束都在那里；本页补架构细节、存档格式与坑。

---

## 1. 项目身份

- **名称**：问道长生（英文标识 `increment-xiuxian-game`）
- **类型**：修仙题材增量游戏 —— 点击/挂机攒灵气 → 破境转生 → 解锁新系统 → 数值膨胀但保持可玩性
- **仓库**：https://github.com/SkyItemChen/increment-xiuxian-game
- **在线地址**：https://skyitemchen.github.io/increment-xiuxian-game/
- **当前版本**：见 [`src/game/更新日志.ts`](src/game/%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97.ts) 中的 `GAME_VERSION`（不要在文档里再抄一份版本号）

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vue 3 (Composition API, `<script setup>`) | 响应式状态驱动 UI |
| 语言 | TypeScript | 严格模式，`noUnusedLocals: true`, `noUnusedParameters: true` |
| 构建工具 | Vite | 开发服务器 `npm run dev` (localhost:5173)，生产构建 `npm run build` |
| 大数处理 | 自研 `BigNumber` 类 | 支持 log10 表示法，避免 JS Number 溢出；格式化输出支持字母缩写（K/M/B/T/Qa...）和科学计数 |
| 部署 | GitHub Actions → GitHub Pages | `.github/workflows/deploy.yml`：`npm ci` → `npm run build` → `configure-pages` → `upload-pages-artifact(dist)` → `deploy-pages` |
| 存档 | localStorage (`xiuxian.save.v1`) | 定长数组 → JSON → base64；向后兼容，版本号递增只加字段 |

**关键命令**：
```bash
npm run dev        # 开发服务器（含测试入口）
npm run build      # 唯一真类型检查 + 生产构建（vue-tsc -b && vite build）
npm run preview    # 本地预览生产产物
```

> **重要陷阱**：根目录 `tsconfig.json` 是 solution-style 壳子，`vue-tsc --noEmit` 空跑退 0。**只有 `npm run build` 真正查类型**。CI 里跑的也是 `npm run build`，所以类型错误会阻断部署。

---

## 3. 核心架构

### 3.1 单一响应式状态

[`src/game/state.ts`](src/game/state.ts) 导出一个全局 `state` 对象（由多个 `ref()` / `reactive()` 组成），所有组件通过 import 共享同一份状态。主循环由 `bootGameLoop()` 启动，每帧调用 `refreshDisplay()` 结算产出、更新显示、触发成就通知。

**保存/加载周期**：
- `saveGame()`：序列化 `snapshot()` → 定长数组 → JSON → base64 → `localStorage.setItem('xiuxian.save.v1', ...)`
- `loadGame()` / `applySave(raw)`：反向解析，调用 `reseedAchievements()` 重置成就比对基准，再 `refreshDisplay()`
- `beforeunload` 事件自动保存（无论 autoSave 开关）

**离线收益**：读档时计算墙钟差值（最多 8 小时封顶），补产出不补代买，超过 60 秒弹「出关」字据。

### 3.2 成就/挑战/里程碑：推导而非存储

这三张表的好处（bonus）**不存任何存档字段**，完全从其他累计账推导出来。判定逻辑集中在 [`src/game/挑战.ts`](src/game/%E6%8C%91%E6%88%98.ts) 的 `totalBonus(counters())`，被 [`src/game/state.ts`](src/game/state.ts) 的 `activeBonus()` 调用。
丹纹四枝是唯一例外：四枝等级要存（玩家亲手点的选择），点数仍按层数与里程碑现算。

```typescript
// counters() 读取的几笔只涨不跌的累计账
interface BonusCounters {
  pillLevels: Record<string, number>   // 丹炉/火候/丹房等级
  spirits: SpiritLevels                // 七道丹道精神等级
  pulls: number                        // 累计凝练抽数
  jindan: number                       // 已结金丹层数
  insightEarned: number                // 累计见识
  explores: number                     // 累计探索次数
  pointsEarned: number                 // 累计筑基点
  rootLevels: number                   // 根骨五条合计等级
  benchLevels: number                  // 鉴宝台四条合计等级
  treasures: number                    // 已收法宝件数
  qiLog10: number                      // 累计灵气 log10
  jindanTree?: Record<string, number>  // 丹纹四枝等级（唯一要存的选择）
}
```

`achievementUnlocked(def, c)` 是唯一判定口径，成就页进度条和挑战页都走它，保证「达成」与「好处」不会漂移。

### 3.3 加成轴与聚合（当前五条，可扩展）

[`src/game/词条与属性.ts`](src/game/%E8%AF%8D%E6%9D%A1%E4%B8%8E%E5%B1%9E%E6%80%A7.ts) 定义 `Bonus` 接口，当前有这五条轴：

| 轴名 | 含义 | 作用位置 |
|------|------|----------|
| `danAdd` | 出丹加法 | 每一炉该出的丹额外增加的比例（和武火同一条加法轴） |
| `qiAdd` | 灵气返哺加法 | 丹房那条修行加成轴（和丹房、通灵共用一个加数，一起被 √定价吃回去） |
| `energyAdd` | 全部产出加法 | 道基/淬炼/养气那条灵气/秒加法轴 |
| `dregMul` | 废渣乘法 | 炸一炉赔的废渣整体乘这个数（只喂转盘，转盘不竖墙） |
| `passMul` | 折点乘法 | 按秒折给玩家的筑基点整体乘这个数 |

聚合规则：加法轴相加（出厂 0），乘法轴相乘（出厂 1）。`noBonus()` 返回起点账，`addBonus(sum, add)` 合并两条 bonus。

**扩展规则**：加成轴没有数量上限，新玩法可以继续加轴。新轴要在 `Bonus` 接口登记、在 `挑战.ts` 的 `totalBonus()` 聚合、在 `state.ts` 的 `activeBonus()`/`recompute()` 接入，并给中性基准值；基准值下旧锚不许漂。不要绕开聚合在产出公式里另乘一份倍率。

---

## 4. 关键玩法系统

### 4.1 练气（Qi Refinement）

- **五个法门**：每个有等级上限，涨价曲线分段（前期陡、中期缓、后期再陡），目的是让玩家在真实能达到的等级里看到拐点
- **破境转生**：攒够筑基点后破境，清空本世灵气和法门修为，换筑基点永久生效
- **自动化解锁**：累计筑基点 ≥ 20 时，法门参悟交给系统代跑（`AUTO_BUY_UNLOCK_POINTS`）
- **免费参悟**：累计见识 ≥ 20 时，参悟法门不再扣灵气，只要灵气够价就能悟进去（`FREE_UPGRADE_UNLOCK_INSIGHT`）

**经济锚点**：五条法门的单级收益两次抬档（加法两条抬得多、乘法三条只抬一点），空树一世累计灵气达到 `1e10` 需要约 **15.0 分钟**；带根骨树的来世更快（第 2 世 8.4 分钟）。门槛、破境点数与根骨价目都不动。

### 4.2 筑基（Foundation Building）

- **根骨树**：用筑基点买永久强化，每条根骨是加法效果（+X% 灵气/秒等），无等级上限
- **鉴宝台**：用见识买眼力（出土概率）/ 淬炼（灵气产出）/ 收资（见识收入）/ 铁铲（单次铲数）四条永久强化，无等级上限
- **自动化**：两条树各看各的等级门槛——根骨五条合计 40 级（`ROOT_AUTO_UNLOCK_LEVELS`）、鉴宝台四条合计 24 级（`BENCH_AUTO_UNLOCK_LEVELS`），谁先满谁先交给系统

### 4.3 探索（Exploration）

- **解锁条件**：累计筑基点 ≥ 100
- **机制**：押上全部筑基点下矿，两层全清只留法宝，押注按 10:1 折成见识
- **法宝**：7 件，分凡/灵/仙三品，各有层数上限（凡 8/6/8，灵 5/5，仙 3/3）。收满的档移出抽池；凡品未收满时保 20% 占比下限；三档全收满后每铲改攒见识
- **永久生效**：全收集后永久加成，不因散功/结丹而丢失

### 4.4 金丹（Golden Core）

- **丹炉链**：三条线全部用**丹**付账
  - 丹炉：每级出丹翻一倍（乘法，growth ×30/级）
  - 火候：每级多炼出 5% 丹（加法，growth ×10/级）
  - 丹房：每级修行 +5%（加法，growth ×3/级）
- **火候三档**（不是境界，是炼丹节奏）：
  - 静心：几乎不炸炉（2%），出丹最多，废渣最少
  - 常态：炸炉 15%，出丹与废渣平衡
  - 狂躁：炸炉 25%，出丹最少，废渣最狠
  - **中间那格不许被压死**：改表时必须保证"每多要一份渣所付的丹"一路变贵（凹性），否则玩家会永远选两头
- **炸炉机制**：按概率炸炉，那一炉的丹一分不得，改按 `dregMult` 赔成**丹药废渣**。废渣是凝练转盘的门票。
- **结丹线**：丹炉第 12 级。定标档（灵气/秒 1e24）挂满 **12 小时**正好摸到。这是第二条硬锚点。
- **结丹回溯加成**：首层把全部灵气产出 ×2，之后每层 ×1.25。倍率乘在整份产出上，所以第 n 层那一世大约只要第 1 层的 `1/M(n)`；约 405 层攒到 ×1e39.5，最后一世可把累计灵气推过 1e100。
- **结丹见识与丹纹点**：每结一层给结丹见识（底数 1 点，识海每 5 级再 +1）与 1 点丹纹；结丹里程碑第 1/2/3/5/8 层另发 2/2/3/4/6 点。
- **丹纹四枝**：丹道（出丹 +4%/级）、返元（灵气 +3%/级）、识海（每 5 级每层多 1 见识）、炉火（废渣 +6%/级），各 22 级，枝内第 n 级价 n 点。四枝全满 1012 点；405 层共 422 点。只手动点、不洗点、不自动化。

### 4.5 凝练（Refinement / Spirit Wheel）

- **七道丹道精神**：转盘上的七道，抽到已抽过的就往上叠一级。全是**从零起加**的永久 buff：
  - 武火：每一炉多炼出 5% 丹（dan-add）
  - 守一：每级炸炉率降 20%（bust-cut）
  - 回甘：每级多赔 15% 废渣（dreg-add）
  - 通灵：每级修行 +5%（qi-add）
  - 养气：每级灵气 +5%（energy-add）
  - 敏手：代买更快，只能参悟两层（auto-cut，cap 2）
  - 定息：每秒折的筑基点更多，最多二十层（pass-add，cap 20）
- **抽卡价**：第 1 次 = 半秒的出丹流量，往后每次 ×1.15。这条墙很硬——实测 150 抽 ≈ 12 天，170 抽 ≈ 4 个月，260 抽 ≈ 数年，400 抽挂满 3e13 秒也到不了。原因是转盘价按"见过的最高出丹流量"定标，废渣供给也随流量涨，两边约掉，time-to-N-抽几乎与流量无关。
- **自动化**：自己转过 50 次后，转盘开始替玩家抽（`PULL_AUTO_UNLOCK_TURNS = 50`）

### 4.6 自动化边界

**代买覆盖**：法门、根骨、鉴宝台、丹炉/火候/丹房、凝练转盘  
**永远手动**：结丹按钮、探索押注、丹纹四枝

理由：结丹是重大抉择（要不要散功重来），探索押注是风险决策，丹纹先点哪一枝是这一层唯一的策略；交给系统会剥夺玩家的核心体验。

---

## 5. 经济曲线锚点（不可动摇）

| 锚点 | 数值 | 意义 | 验证脚本 |
|------|------|------|----------|
| 练气锚点 | 空树一世 15.0 分钟到 1e10（五条法门加强后，不挑世数） | 有了根骨树只会更快，练气每一世都压在 15 分钟上下 | `sim/balance.mjs` |
| 结丹线 | 丹炉第 12 级 = 12 小时（灵气/秒 1e24） | 金丹开张的门槛，决定中期是否有"盼头" | `sim/jindan-anchor.mjs` |

**为什么不能动**：
- 练气锚点漂到几分钟 → 前期太爽，玩家没耐心学系统
- 练气锚点漂到几小时 → 前期太苦，玩家弃坑
- 结丹线漂到几天 → 中期绝望，没人走到金丹
- 结丹线漂到几分钟 → 金丹太容易，后期内容空洞

**新玩法守则**：任何新增系统、成就、挑战，如果它的奖励会影响灵气/秒或出丹速率，必须确保在达到上述锚点之前**完全不咬合**（即奖励只在锚点之后才生效）。

---

## 6. 成就系统

### 6.1 结构

[`src/game/词条与属性.ts`](src/game/%E8%AF%8D%E6%9D%A1%E4%B8%8E%E5%B1%9E%E6%80%A7.ts) 中的 `ACHIEVEMENTS` 表共 **24 条**：

- **7 条自动化/便利解锁**（无 bonus）：无为而治、不取一毫、根骨自成、鉴宝有度、不劳而获、一丹在手、转过一圈
- **17 条加属性**（有 bonus，练气 3 条 + 筑基 5 条 + 金丹 9 条）：
  - 练气（3 条，读练气自己做的三件事）：气满丹田（danAdd 0.1，读累计灵气 1e11）、吐纳有常（energyAdd 0.05，读累计吐纳 500 次）、静坐忘机（passMul 1.1，读在线修行 50 分钟）
  - 筑基（5 条，只给 passMul）：初探宝山 ×1.05、三宝在身 ×1.08、慧眼识珍 ×1.1、点石成金 ×1.1、七宝俱全 ×1.2
  - 金丹第一档（4 条）：海纳百川（danAdd 0.2）、聚沙成塔（qiAdd 0.2）、踏破铁鞋（passMul 1.5）、丹成一品（energyAdd 0.5）
  - 金丹第二档（5 条）：返本还元（dregMul 1.25）、鼎中三昧（danAdd 0.35）、跬步千里（passMul 2.5）、灵源不竭（qiAdd 0.35）、气冲霄汉（energyAdd 0.75）

### 6.2 设计原则

1. **零存档字段（丹纹除外）**：达成与否从累计账推导，读老存档不用迁移；丹纹四枝的等级是玩家亲手点的选择，随存档 `[32]` 保存
2. **单调累计账做条件**：只用 `pillLevels` / `spirits` / `pulls` / `jindan` / `insightEarned` / `explores` / `pointsEarned` / `rootLevels` / `benchLevels` / `treasures` / `qiLog10` / `totalGathers` / `totalTime`。花掉不减、探索清零也不减，所以解锁一次就一直开着；丹纹点也按 `jindan` 与里程碑现算，不另存余额。后两笔（吐纳次数、在线时长）本来就在存档里，加度量不动存档格式；`loops` 押探索散功会归零，不能当门槛
3. **独独不用累计凝练做第二档门槛**：转盘价与废渣供给同步缩放，导致 time-to-N-抽与流量无关，260 抽以上≈数年墙。第一档的 聚沙成塔 压在 170 抽已是这条墙上人还够得着的最后一格
4. **奖励走 bonus 轴**：优先复用现有轴；需要新轴时按 §3.3 接入聚合，并给中性基准值
5. **成就页按境界排序**：练气 → 筑基 → 金丹，后期玩法不许挤到前面

### 6.3 通知机制

成就达成时即时弹出报条（右下角非模态 toast），队列逐条播报。原理：跨 tick 比对 `knownAchievements` Set，`refreshDisplay()` 每次结算时检查，多出来的压进 `achievementNotices` 队列。读档/导入/格式化后调用 `reseedAchievements()` 重置基准，避免把老存档里已有的几十条一次性全报出来。

---

## 7. 存档格式

- **版本**：v16（见 `SAVE_VERSION = 16` in [`src/game/state.ts`](src/game/state.ts)）。v14/v15 未加字段，只做偏好迁移：v14 及更早的档读进来时把五颗自动化开关归零；之后读档还会把未达成门槛的开关自动关掉。v16 在 `[32]` 加丹纹四枝等级，老档读进来四枝全空；若四枝花掉的点数超过按层数现算的总额（改过的档），整棵清空。
- **编码**：定长数组（当前 33 个元素）→ `JSON.stringify` → `btoa` → base64 字符串
- **解码**：`atob` → `JSON.parse` → 校验长度与版本 → 逐项赋值到 state
- **向后兼容**：新字段只往后加，老存档缺失的字段用默认值填充（`?? 0` / `?? {}`）
- **导出/导入**：设置页提供文本框 + 文件上传两种方式，导入前先 `describeSave(raw)` 展示灵气数量/保存时间/游玩时间，让用户确认再覆盖

**注意**：存档键名 `SALVAGE_KEY = 'xiuxian.salvage…'` 里故意混了一个省略号字符（U+2026），不是 bug。改常量后要用码点校验，别信 Read/Grep 显示。

---

## 8. 文件命名约定

纯数据/纯数学模块一律用**中文文件名**，方便快速定位：

| 文件 | 职责 |
|------|------|
| [`词条与属性.ts`](src/game/%E8%AF%8D%E6%9D%A1%E4%B8%8E%E5%B1%9E%E6%80%A7.ts) | 所有词条表（法门、根骨、法宝、丹炉、火候、丹道精神、挑战、里程碑、成就）、常量、阈值 |
| [`挑战.ts`](src/game/%E6%8C%91%E6%88%98.ts) | 成就/挑战/里程碑的判定逻辑、bonus 聚合、加成轴访问器（当前五条） |
| [`金丹丹炉.ts`](src/game/%E9%87%91%E4%B8%B9%E4%B8%B9%E7%82%89.ts) | 丹炉链的造价公式、出丹速率、炸炉概率 |
| [`凝练.ts`](src/game/%E5%87%9D%E7%BB%83.ts) | 转盘抽卡价、roll 逻辑、七道精神的当前效果 |
| [`更新日志.ts`](src/game/%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97.ts) | 版本号 `GAME_VERSION` 和 `CHANGELOG` 表 |
| [`state.ts`](src/game/state.ts) | 全局状态、主循环、保存/加载、UI 辅助函数 |

`sims/` 目录下的 `.mjs` 脚本统一通过 `import` 上述真实模块来做平衡验证，**不允许在 sim 里镜像第二份表**。

---

## 9. 开发工作流

### 9.1 类型检查与构建

```bash
# 唯一真类型检查 + 生产构建
npm run build    # = vue-tsc -b && vite build

# 以下命令查不到任何东西，别用
npx vue-tsc --noEmit   # 根 tsconfig 是壳子，空跑退 0
```

### 9.2 平衡验证（sim 脚本）

`sim/` 目录下有一批 `.mjs` 脚本，通过 `--import ./sim/ts-hook.mjs` 让 Node.js 直接 import TypeScript 模块：

```bash
node --import ./sim/ts-hook.mjs sim/challenge-check.mjs   # 挑战/成就/里程碑回归检查
node --import ./sim/ts-hook.mjs sim/jindan-anchor.mjs     # 结丹线锚点验证
node --import ./sim/ts-hook.mjs sim/jindan-tree.mjs       # 丹纹四枝：点数投放、耗时与四条轴
node --import ./sim/ts-hook.mjs sim/passive-check.mjs     # 按秒折点进项测量
node --import ./sim/ts-hook.mjs sim/ninglian-check.mjs    # 火候三档凹性检查
```

**关键 sim**：
- `challenge-check.mjs`：五档挑战的落点时间、好处各归各的轴、不可回退、中间那格不许被压死
- `jindan-anchor.mjs`：验证 `t·√流量 = 常数`，确保四档构筑间结丹线不漂
- `jindan-tree.mjs`：丹纹每层与里程碑的点数投放、405/1000 层的点法对比、四枝进 `totalBonus` 后的轴刻度
- `offline-check.mjs`：离线收益封顶 8 小时，代买离线一栏不跑

### 9.3 浏览器验证

**AI 默认不要自己做浏览器验证**（除非用户当次明确要求）：不开浏览器、不起 dev server 去截图/取快照/查 DOM，这些都很耗 token。AI 改完只跑 `npm run build` 与受影响的 `sim/`，把需要实点的界面列给用户。以下内容只在用户要求时参考。

开发服务器运行在 `http://localhost:5173/`。Qoder Desktop 内置浏览器面板可用于实时调试，但有以下坑：

1. **面板没打开时**：`visibilityState=hidden` 导致 `requestAnimationFrame` 停摆、`setTimeout` 节流到 ~1 次/秒，页面卡在 Vue 过场动画里。此时 `take_screenshot` 报 `NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`，但 `evaluate_script` 仍可用。
2. **连接器标签页不可信**：`list_pages` 可能只显示 `about:blank`，`take_snapshot` 突然返回 "empty page"。恢复办法：`navigate_page` 到目标 URL。
3. **真实模块单例**：从 `performance.getEntriesByType('resource')` 捞出应用实际加载的那个带 `?t=` 的时间戳 URL 再 `import()`。用裸路径 `/src/game/state.ts` 会另起一份模块实例，得到全新的 state，还会把它自己那份空进度写进 localStorage。

### 9.4 Git 提交与推送

- **git 身份**：这台机器从没设过 `user.name`/`user.email`，每次提交都得现喂。QQ 邮箱会被远端拒掉（仓库开了「阻止泄露私有邮箱的推送」），改用：
  ```bash
  git -c user.name="SkyItemChen" -c user.email="118497412+SkyItemChen@users.noreply.github.com" commit ...
  ```
- **推送**：`git push origin main` → 触发 GitHub Actions → 自动部署到 Pages。等待 1–2 分钟后，对比 live `index.html` 的 bundle hash 与本地 `dist/index.html` 确认上线。

---

## 10. 已知陷阱与规避方法

| 陷阱 | 现象 | 规避方法 |
|------|------|----------|
| **逐次掷的循环随速度爆炸** | 会心/炸炉按“次数”一颗一颗掷，次数 = 时长 ÷ 每跳秒数（5/吐纳速度）。速度到 1e7 量级时一帧几十万次、8 小时闭关 1e11 次，主线程直接卡死，且**存档完全正常**（不是坏档） | 统一走 `state.ts` 的 `rollCrits(cycles, chance)`：额度 20000 以内逐次掷（种子推进、可复现），超出按期望值折算。任何新写的“逐次掷”都必须走它 |
| **吐纳速度溢出成 Infinity 后灵气归零** | 速度乘到 1e308 以上 → `gatherSpeed = Infinity` → `gatherSeconds = 0`、`cycles = Infinity`，而 `BigNumber.mulNumber(Infinity)` 的尾数会被抹成 0，吐纳、丹、每秒产出一起变 0：**页面不卡，但一格灵气都不进**。改过等级的存档尤其容易撞上 | 速度在 `GATHER_SPEED_CAP = 5e5` 处截断，溢出那一截按等比例折成 `spiritPerGather`（`gatherOverflowLog10`），`rate × speed` 保持不变。**速度一律在 log10 里累加**（`p.speedMult.log10()`），不要先 `toNumber()` 再乘——那样溢出前后就分不出来了。等级写成 `Infinity`/`NaN` 的坏档按 1 倍兜底 |
| **涨价削减把"越买越贵"翻成"越买越赚"** | 悟性/玄铜镜砍 growth 砍过头，乘法法门的 `E = log(power)/log(growth)` 会被抬上去；三条 ΣE ≥ 1 之后等级与流量互抬，金丹期一小时就能从 1e87 冲到 F500（指数上亿）。**表面完全正常**：没有报错、没有卡顿，只是数字疯了 | `rebirth.ts` 的 `growthCutOf` 给 log 涨幅留了 `MAX_LOG_CUT = 1/3` 的地板（`growth^(2/3)`），ΣE 封在 0.648。改任何"削减/涨价/每级收益"的数字后跑 `sim/rebirth-cut-check.mjs`；`MIN_GROWTH = 1.25` 只防"越买越便宜"，**挡不住越买越赚** |
| **想给"超出上限的削减"发补偿** | 例如把溢出折成首级价折扣：只改截距不改斜率，ΣE 不变、本身安全；但**一旦顺手撤掉 `MAX_LOG_CUT`**、让 growth 一路砍到 `MIN_GROWTH`，ΣE 立刻回到 1.33~5.5，F500 原样复发（触发档位还是 31 级）。折价那条旁路也会让"价格是否还自限"多一个要同时维护的变量 | 定案：悟性到顶即饱和，不给溢出发补偿。要修"点数白花"只能动别的轴，别碰 `MAX_LOG_CUT`、别给首级价打折。校验脚本里有一条断言：地板咬合后再加大削减，ΣE 不再变化 |
| **AI 自行开浏览器验证** | 截图、快照、DOM 检查慢且耗 token，还容易被离线条目带偏 | 默认不做；只跑 `npm run build` 与 `sim/`，界面实点交给用户 |
| **隐藏面板阻塞 rAF** | Qoder 内置浏览器面板没打开时，`requestAnimationFrame` 停摆，Vue `<Transition>` 卡在 leave 阶段，主循环不结算 | 验渲染前提示用户打开面板；逻辑层验证改用 node 直跑真实模块（`sim/` 脚本） |
| **改活体 state 写花存档** | 在控制台直接改 `state.xxx` 后 reload，`beforeunload → saveGame` 会把半路改坏的状态写进 localStorage | 验完锁定态要把值改回去再 reload；或用导入存档弹窗的方式恢复，不走 `setItem` |
| **模块缓存欺骗** | `import('/src/game/state.ts?t=' + Date.now())` 看似刷新了，但浏览器可能返回旧的 cached 模块，缺少新 exports | 从 `performance.getEntriesByType('resource')` 捞真实 URL；检查 `Object.keys(m)` 确认新 exports 存在 |
| **省略号污染字符串** | 存档键名 `SALVAGE_KEY` 里混进 U+2026，Read/Grep 显示正常但实际字节不同 | 改常量后用码点校验：`[...key].map(c => c.codePointAt(0))` |
| **vue-tsc --noEmit 空跑** | 根 tsconfig 是 solution-style 壳子，`vue-tsc --noEmit` 查零文件退 0 | 只用 `npm run build` 做类型闸 |
| **剪贴板 API 被拒** | Qoder 内置浏览器面板里 `navigator.clipboard.readText/writeText` 抛 `NotAllowedError` | 文本框 + 文件那条路靠 `evaluate_script` 往 textarea 里 `setter.call(ta, text)` 再 `dispatchEvent(new Event('input'))` |
| **git push 网络抖动** | `Failed to connect to github.com port 443` 间歇性出现 | 重试 2–3 次；检查是否代理配置异常；api.github.com 通但 github.com 不通时可能是 DNS/路由问题 |

---

## 附录：关键文件速查

| 文件 | 行号参考 | 用途 |
|------|---------|------|
| [`GAME_NUMBERS.md`](GAME_NUMBERS.md) | — | 玩法与数值模型（供推演下一轮内容，含公式、锚点、墙与约束清单） |
| [`src/game/state.ts`](src/game/state.ts) | `counters()` ~577, `activeBonus()` ~591, `achievementRows()` ~763, `refreshDisplay()` ~555 | 全局状态、主循环、成就行生成 |
| [`src/game/挑战.ts`](src/game/%E6%8C%91%E6%88%98.ts) | `totalBonus()` ~83, `achievementUnlocked()` ~54 | 成就/挑战/里程碑判定与 bonus 聚合 |
| [`src/game/词条与属性.ts`](src/game/%E8%AF%8D%E6%9D%A1%E4%B8%8E%E5%B1%9E%E6%80%A7.ts) | `ACHIEVEMENTS` ~560, `CHALLENGES` ~903, `JINDAN_MILESTONES` ~960, `Bonus` ~414 | 所有词条表、常量、阈值 |
| [`src/game/金丹丹炉.ts`](src/game/%E9%87%91%E4%B8%B9%E4%B8%B9%E7%82%89.ts) | — | 丹炉链造价、出丹速率、炸炉概率 |
| [`src/game/凝练.ts`](src/game/%E5%87%9D%E7%BB%83.ts) | `pullCostLog10()` , `rollSpirit()` | 转盘抽卡价、roll 逻辑 |
| [`sim/challenge-check.mjs`](sim/challenge-check.mjs) | — | 挑战/成就/里程碑回归检查（必跑） |
| [`sim/jindan-anchor.mjs`](sim/jindan-anchor.mjs) | — | 结丹线锚点验证（必跑） |
| [`sim/jindan-tree.mjs`](sim/jindan-tree.mjs) | — | 丹纹四枝点数投放与轴刻度 |
| [`src/components/JindanTreePanel.vue`](src/components/JindanTreePanel.vue) | — | 金丹页丹纹子标签 |
| [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) | — | CI/CD 流水线 |

---

*最后更新：2026-10-17*
