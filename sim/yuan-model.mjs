// 元婴循环的共享模型：斗法斩怪、道基/神念的"买最便宜"策略。
// 价格与表全部从 src/game/元婴.ts 取，sim 不另抄。
import {
  FIGHT_KILL_SECONDS, fightWaveCap, warSoulPerKill, generalCost,
  shenWuCost, yuanBuildingCost, fightInsightCost, shenNianPerSecond,
} from '../src/game/元婴.ts'

/** 一整个周期的斗法：斩怪 → 战魂 → 买战将。波次到上限后原地刷 */
export function runFight(seconds, mode, generalCap = 1e6) {
  let wave = 1
  let souls = 0
  let general = 0
  let kills = 0
  let earned = 0
  const milestones = {}
  for (let t = 0; t < seconds; t += FIGHT_KILL_SECONDS) {
    const reward = warSoulPerKill(wave) * mode.warMul
    souls += reward
    earned += reward
    kills++
    wave = Math.min(wave + 1, fightWaveCap(general))
    while (general < generalCap && souls >= generalCost(general)) {
      souls -= generalCost(general)
      general++
      wave = Math.min(wave, fightWaveCap(general))
    }
    for (const mark of [10, 20, 30, 40, 50]) {
      if (milestones[mark] === undefined && general >= mark) milestones[mark] = t + FIGHT_KILL_SECONDS
    }
  }
  return { general, souls, earned, kills, wave, milestones }
}

/** 在若干条线里买"下一级最便宜"的，直到预算不够；strictFocus 时只买 focusId，攒不够就停 */
export function spendCheapest(levels, ids, costOf, budget, focusId = null, strictFocus = false) {
  let left = budget
  let bought = 0
  for (;;) {
    if (focusId && strictFocus) {
      const c = costOf(levels[focusId] ?? 0)
      if (c > left) break
      left -= c
      levels[focusId] = (levels[focusId] ?? 0) + 1
      bought++
      continue
    }
    let best = null
    for (const id of ids) {
      const c = costOf(levels[id] ?? 0)
      if (c <= left && (best === null || c < best.c)) best = { id, c }
    }
    if (best === null) break
    left -= best.c
    levels[best.id] = (levels[best.id] ?? 0) + 1
    bought++
  }
  return { left, bought }
}

/**
 * 挂 seconds 秒的神念线：每小时结算一次，先收神念再买建筑/战悟。
 * focusBuilding=true 时建筑优先到 Lv.20，之后与战悟一起买最便宜的。
 */
export function advanceShenNian(state, seconds, focusBuilding = true) {
  const HOUR = 3600
  let left = seconds
  while (left > 0) {
    const dt = Math.min(HOUR, left)
    left -= dt
    state.shenNian += shenNianPerSecond(state.buildingLevel) * dt
    const ids = ['building', ...state.fightInsightIds]
    const costOf = (id, lv) => (id === 'building' ? yuanBuildingCost(lv) : fightInsightCost(lv))
    // 用一层临时对象把"建筑"和五条战悟放在一起算最便宜
    const levels = { building: state.buildingLevel, ...state.fightInsight }
    for (;;) {
      let best = null
      for (const id of ids) {
        const c = costOf(id, levels[id] ?? 0)
        if (c <= state.shenNian && (best === null || c < best.c)) best = { id, c }
      }
      if (best === null) break
      if (focusBuilding && levels.building < 20) {
        const c = yuanBuildingCost(levels.building)
        if (c <= state.shenNian) best = { id: 'building', c }
      }
      state.shenNian -= best.c
      levels[best.id] = (levels[best.id] ?? 0) + 1
    }
    state.buildingLevel = levels.building
    for (const id of state.fightInsightIds) state.fightInsight[id] = levels[id] ?? 0
  }
}
