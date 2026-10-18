// 元婴运行时（0.22）：门槛、结婴、炼神、大突破、神悟台、斗法与存档。
// 用法：node --import ./sim/ts-hook.mjs sim/yuan-runtime-check.mjs
//
// 这个脚本会 import `state.ts`——不像 `yuan-anchor.mjs` 只碰纯数学。
// 理由是"接线"这件事本身要验：门槛读的是不是同一个常量、大突破清得对不对、
// 老档读进来会不会凭空多出元婴进度。算式仍然只从 `元婴.ts` 取，不在这里留第二份。
import { BigNumber } from '../src/game/BigNumber.ts'
import { REALMS } from '../src/game/realms.ts'
import { TRIALS, noBonus } from '../src/game/词条与属性.ts'
import { trialGateJindan } from '../src/game/试炼.ts'
import {
  FIGHT_MODES,
  SHENWU_LINES,
  YUAN_GATE_JINDAN_LAYER,
  YUAN_MODES,
  YUAN_UNLOCK_LOG10,
  fightInsightCost,
  generalCost,
  metaMultOf,
  normalizeYuanAuto,
  shenNianPerSecond,
  shenWuCost,
  warSoulPerSecond,
  yuanDrainKeep,
  yuanRateLog10,
  yuanThresholdLog10,
} from '../src/game/元婴.ts'
import {
  breakIntoYuan,
  buyShenWu,
  exportSave,
  fightState,
  importSave,
  recompute,
  resetGame,
  shenWuRows,
  state,
  yuanBreak,
  yuanRealmOpen,
  yuanState,
} from '../src/game/state.ts'
import { shenWuBonus, fightInsightBonus } from '../src/game/挑战.ts'

let pass = 0
let fail = 0

function check(label, ok, detail = '') {
  if (ok) {
    pass += 1
    console.log(`  ✓ ${label}${detail ? ` · ${detail}` : ''}`)
  } else {
    fail += 1
    console.log(`  ✗ ${label}${detail ? ` · ${detail}` : ''}`)
  }
}

const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps
const HOUR = 3600

/* ---------------------------------------------------------------- 一、门槛 */

console.log('\n【一】结婴门槛：一个常量，两处读数')
{
  check('YUAN_UNLOCK_LOG10 = 80（用户拍板的过渡值）', YUAN_UNLOCK_LOG10 === 80, String(YUAN_UNLOCK_LOG10))
  const yuan = REALMS.find((r) => r.id === 'yuanying')
  check('元婴境界阈值直接读同一个常量', near(yuan.breakThrough.log10(), YUAN_UNLOCK_LOG10),
    `${yuan.breakThrough.log10()} vs ${YUAN_UNLOCK_LOG10}`)
  check('元婴页已接线（page = yuan，不是 todo）', yuan.page === 'yuan', yuan.page)
  check('结婴的丹门槛 = 试炼门票（标签一开就有牌可点）',
    trialGateJindan(TRIALS) === YUAN_GATE_JINDAN_LAYER,
    `${trialGateJindan(TRIALS)} vs ${YUAN_GATE_JINDAN_LAYER}`)
}

/* ---------------------------------------------------------------- 二、结婴 */

console.log('\n【二】结婴：累计灵气 1e80 且结过一层丹')
{
  resetGame()
  check('开局没有元婴', !yuanRealmOpen() && !yuanState().open)
  check('没到门槛时按不动', !breakIntoYuan())

  state.totalEarned = BigNumber.fromLog10(YUAN_UNLOCK_LOG10)
  state.spirit = BigNumber.fromLog10(YUAN_UNLOCK_LOG10)
  recompute()
  check('灵气到了但没结丹，仍按不动', !breakIntoYuan(), `jindan=${state.jindan}`)

  state.jindan = 1
  check('两道门都过 → 结婴成功', breakIntoYuan())
  check('realmIndex 推到元婴那一格', state.realmIndex === 3, String(state.realmIndex))
  check('结婴不扣灵气（它不是买卖）', near(state.spirit.log10(), YUAN_UNLOCK_LOG10))
  check('重复结婴被挡回来', !breakIntoYuan())
}

/* ---------------------------------------------------------------- 三、炼神 */

console.log('\n【三】炼神：产量、阈值与首破时长')
{
  state.pillAnchor = 50
  const s = yuanState()
  const expectRate = yuanRateLog10(50, YUAN_MODES[0], 0)
  const expectTh = yuanThresholdLog10(50)
  check('元神/秒 = 平方根式（锚 1e50 → 1e35）', near(s.rate.log10(), expectRate, 1e-9),
    `${s.rate.log10().toFixed(3)} vs ${expectRate.toFixed(3)}`)
  check('阈值 = K × √(锚 × 1e40)', near(s.thresholdLog10, expectTh, 1e-9),
    `1e${s.thresholdLog10.toFixed(3)}`)
  const realHours = 10 ** (s.thresholdLog10 - s.rate.log10()) / HOUR
  check('守神首破仍是 62 小时（与锚无关）', realHours > 50 && realHours < 75,
    `${realHours.toFixed(1)} 小时`)

  state.yuanMode = 'duoShe'
  const duo = yuanState()
  check('夺舍把元神倍率抬到 3.20', near(duo.rate.log10() - s.rate.log10(), Math.log10(3.2), 1e-9),
    `×${(10 ** (duo.rate.log10() - s.rate.log10())).toFixed(2)}`)
  check('夺舍把返哺压到四成', duo.mode.qiKeep === 0.4)
  state.yuanMode = 'shouShen'

  check('斗法没开时不分流', yuanState().drain === 0)
}

/* ---------------------------------------------------------------- 四、大突破 */

console.log('\n【四】大突破：清本世、发道基、留丹炉')
{
  // 摆一点"本世的家当"，验大突破到底清哪些
  state.levels = { juLing: 12 }
  state.dan = new BigNumber(1, 30)
  state.dreg = new BigNumber(1, 20)
  state.pillLevels = { danLu: 12 }
  state.warSoul = 500
  state.general = 3
  state.jindan = 2
  state.jindanTree = { danDao: 1 }
  recompute()

  state.yuan = BigNumber.fromLog10(yuanThresholdLog10(state.pillAnchor))
  check('刚到 1× 阈值就能破', yuanBreak())
  check('道基 +1（over=0 的地板值）', near(state.daoJi, 1), String(state.daoJi))
  check('累计大突破 +1', state.yuanBreaks === 1)
  check('元神清零', state.yuan.isZero)
  check('灵气清零', state.spirit.isZero)
  check('丹与废渣清零', state.dan.isZero && state.dreg.isZero)
  check('练气法门清零', Object.keys(state.levels).length === 0)
  check('战魂与战将清零', state.warSoul === 0 && state.general === 0)
  check('丹炉等级保留（清了会与 pillAnchor 打起来，见文档）', state.pillLevels.danLu === 12)
  check('金丹层数与丹纹保留', state.jindan === 2 && state.jindanTree.danDao === 1)

  // 2× 阈值：over = 1 → floor(2.8) = 2
  state.yuan = BigNumber.fromLog10(yuanThresholdLog10(state.pillAnchor) + Math.log10(2))
  const before = state.daoJi
  check('2× 阈值也能破', yuanBreak())
  const gained = state.daoJi - before
  check('2× 阈值给 2 点道基', near(gained, 2), String(gained))

  // 洞明 +4%/级：乘在 floor 外面，所以 2 点会变成 2.08
  state.shenWu = { dongMing: 1 }
  state.yuan = BigNumber.fromLog10(yuanThresholdLog10(state.pillAnchor) + Math.log10(2))
  const before2 = state.daoJi
  check('洞明那一级也破得动', yuanBreak())
  check('洞明把道基抬 4%', near(state.daoJi - before2, 2.08, 1e-9), String(state.daoJi - before2))
  state.shenWu = {}
}

/* ---------------------------------------------------------------- 五、神悟台 */

console.log('\n【五】神悟台：价格曲线与五轴映射')
{
  const want = [1, 2, 4, 6, 11, 19, 35, 62, 111]
  const got = want.map((_, i) => shenWuCost(i))
  check('价格 ceil(1.8^lv) 与文档逐位相同', got.join(',') === want.join(','), got.join(','))

  const dan = shenWuBonus({ danXin: 2 })
  check('丹心 2 级 → 每一炉的丹 +20%', near(dan.danAdd, 0.2), String(dan.danAdd))
  const qi = shenWuBonus({ fanBu: 1 })
  check('返哺 1 级 → 丹炼回灵气 +10%', near(qi.qiAdd, 0.1), String(qi.qiAdd))
  const energy = shenWuBonus({ xuanGong: 3 })
  check('玄功 3 级 → 灵气 +30%', near(energy.energyAdd, 0.3), String(energy.energyAdd))
  const dreg = shenWuBonus({ juZha: 2 })
  check('聚渣 2 级 → 废渣 ×1.05²（乘法轴）', near(dreg.dregMul, 1.1025, 1e-12), String(dreg.dregMul))
  const pass = shenWuBonus({ xiXing: 3 })
  check('息行 3 级 → 折点 ×1.05³（乘法轴）', near(pass.passMul, 1.157625, 1e-12), String(pass.passMul))
  const own = shenWuBonus({ shenLian: 5, dongMing: 5, yuanDao: 5 })
  const empty = noBonus()
  check('元婴自己那三条不进旧五轴账',
    JSON.stringify(own) === JSON.stringify(empty), JSON.stringify(own))

  // 买一级：道基够才扣
  state.daoJi = 3
  state.shenWu = {}
  const ok = buyShenWu('xuanGong')
  check('买一级玄功扣 1 点道基', ok && near(state.daoJi, 2) && state.shenWu.xuanGong === 1,
    `道基 ${state.daoJi} · Lv.${state.shenWu.xuanGong}`)
  state.daoJi = 0.5
  check('道基不够就买不动', !buyShenWu('xuanGong'))

  // 元道：唯一产 metaMult 的线
  check('元道 0 级恒等', metaMultOf(0) === 1)
  check('元道 1 级 ×1.10', near(metaMultOf(1), 1.1), String(metaMultOf(1)))
  check('元道 6 级 ×1.77（文档口径）', near(metaMultOf(6), 1.77, 0.01), metaMultOf(6).toFixed(4))
  const rows = shenWuRows()
  check('八条都在表里且各有价格', rows.length === SHENWU_LINES.length && rows.every((r) => r.cost > 0))
}

/* ---------------------------------------------------------------- 六、斗法 */

console.log('\n【六】斗法：40 点道基的门、三档分流')
{
  state.daoJiEarned = 39
  check('累计道基 39 点时没开', !fightState().unlocked)
  state.daoJiEarned = 40
  check('累计道基 40 点就开', fightState().unlocked)

  check('三档分流递增', FIGHT_MODES[0].yuanDrain < FIGHT_MODES[1].yuanDrain &&
    FIGHT_MODES[1].yuanDrain < FIGHT_MODES[2].yuanDrain,
    FIGHT_MODES.map((m) => m.yuanDrain).join(' < '))
  check('守御只分 5%，元神剩 95%', near(yuanDrainKeep(FIGHT_MODES[0]), 0.95))
  check('死战分 30%，元神剩 70%', near(yuanDrainKeep(FIGHT_MODES[2]), 0.7))

  const s1 = warSoulPerSecond(10, FIGHT_MODES[0])
  const s2 = warSoulPerSecond(20, FIGHT_MODES[0])
  check('战将每级多一波 → 战魂/秒单调上升', s2 > s1, `${s1.toFixed(1)} → ${s2.toFixed(1)}`)
  check('战将价格单调上升', generalCost(10) < generalCost(11))

  const f = fightState()
  check('未开局不产战魂（开了才走节拍）', f.unlocked && f.perSecond > 0, String(f.perSecond.toFixed(2)))
  check('战悟五条各自映射旧轴',
    Object.keys(fightInsightBonus({ zhanYi: 1, zhanXi: 1, zhanTi: 1, zhanLi: 1, zhanWu: 1 }))
      .length === 5)
  check('战悟价格 ceil(1.75^lv) 前几位对得上', [0, 1, 2, 3].map((i) => fightInsightCost(i)).join(',') === '1,2,4,6')
}

/* ---------------------------------------------------------------- 七、神念 */

console.log('\n【七】元神宫与神念')
{
  check('Lv.0 也产 0.05/秒（否则第一级永远买不起）', near(shenNianPerSecond(0), 0.05))
  check('每级 ×1.15', near(shenNianPerSecond(2), 0.05 * 1.15 ** 2, 1e-12))
  check('建筑价 1.7^lv 单调', shenWuCost(0) > 0 && generalCost(0) === 1)
}

/* ---------------------------------------------------------------- 八、存档 */

console.log('\n【八】存档：新十三格来回一趟，老档按默认值兜底')
{
  state.yuan = BigNumber.fromLog10(44.5)
  state.daoJi = 12.34
  state.daoJiEarned = 56.78
  state.shenNian = 345.6
  state.yuanBuilding = 7
  state.shenWu = { shenLian: 2, yuanDao: 1 }
  state.yuanMode = 'ningPo'
  state.yuanBreaks = 12
  state.warSoul = 98765
  state.general = 13
  state.fightMode = 'siZhan'
  state.fightInsight = { zhanTi: 4 }
  state.yuanAuto = 5
  state.pillLevels = { danLu: 12 }

  const code = exportSave()
  const again = exportSave()
  // 第 13 格是保存时刻（Date.now()），两次可能差 1 毫秒，比它之前的部分必须一模一样
  const a1 = JSON.parse(atob(code))
  const a2 = JSON.parse(atob(again))
  check('同一份进度导出两次只有时间戳可能不同',
    JSON.stringify(a1.filter((_, i) => i !== 13)) === JSON.stringify(a2.filter((_, i) => i !== 13)))

  resetGame()
  check('格式化之后元婴退回未开', !yuanRealmOpen() && state.yuan.isZero)
  check('格式化之后道基/神念/战魂归零',
    state.daoJi === 0 && state.shenNian === 0 && state.warSoul === 0)
  check('格式化之后档位回默认', state.yuanMode === 'shouShen' && state.fightMode === 'shouYu')

  check('导入存档成功', importSave(code))
  check('元神原样回来', near(state.yuan.log10(), 44.5, 1e-6), String(state.yuan.log10()))
  check('道基/累计道基原样回来', near(state.daoJi, 12.34) && near(state.daoJiEarned, 56.78),
    `${state.daoJi} / ${state.daoJiEarned}`)
  check('神念与元神宫原样回来', near(state.shenNian, 345.6) && state.yuanBuilding === 7)
  check('神悟台两条原样回来', state.shenWu.shenLian === 2 && state.shenWu.yuanDao === 1)
  check('炼神档位原样回来', state.yuanMode === 'ningPo')
  check('大突破次数原样回来', state.yuanBreaks === 12)
  check('战魂/战将原样回来', state.warSoul === 98765 && state.general === 13)
  check('斗法档位与战悟原样回来',
    state.fightMode === 'siZhan' && state.fightInsight.zhanTi === 4)
  check('自动器档位原样回来', state.yuanAuto === 5)

  // v17 老档：没有 [36]..[48]，读进来必须全是默认值
  const arr = JSON.parse(atob(code))
  arr[0] = 17
  arr.length = 36
  const oldCode = btoa(JSON.stringify(arr))
  check('v17 老档能读进来', importSave(oldCode))
  check('老档元神为 0', state.yuan.isZero)
  check('老档道基/神念/战魂为 0',
    state.daoJi === 0 && state.daoJiEarned === 0 && state.shenNian === 0 && state.warSoul === 0)
  check('老档档位回守神 / 守御', state.yuanMode === 'shouShen' && state.fightMode === 'shouYu')
  check('老档神悟台/战悟为空', Object.keys(state.shenWu).length === 0 &&
    Object.keys(state.fightInsight).length === 0)
  check('老档自动器是关的', state.yuanAuto === 0)
  check('老档不在试炼里', state.trialId === -1)
}

/* ---------------------------------------------------------------- 九、边界 */

console.log('\n【九】边界：坏值不许把账算成 NaN / Infinity')
{
  check('自动器只认 0/1/2/5/10', [0, 1, 2, 5, 10].every((n) => normalizeYuanAuto(n) === n))
  check('越界档位一律当关', [3, 4, 7, -1, NaN, Infinity].every((n) => normalizeYuanAuto(n) === 0),
    [3, 7, -1, NaN].map((n) => normalizeYuanAuto(n)).join(','))

  resetGame()
  state.realmIndex = 3
  state.pillAnchor = 0
  const s = yuanState()
  check('锚为 0 时也给出有限的元神/秒', Number.isFinite(s.rate.log10()), String(s.rate.log10()))
  check('没有元神时进度是 0 而不是 NaN', s.progress === 0, String(s.progress))
  check('没有元神时 ETA 是有限的估算', Number.isFinite(s.etaSeconds), String(s.etaSeconds))

  state.yuan = BigNumber.zero()
  check('元神为 0 时破不动', !yuanBreak())
}

console.log(`\n通过 ${pass} · 失败 ${fail}`)
if (fail > 0) process.exitCode = 1
