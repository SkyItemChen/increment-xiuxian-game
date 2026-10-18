// 试炼：debuff 倍数、位图记账、目标定标、奖励聚合。
// 用法：node --import ./sim/ts-hook.mjs sim/trial-check.mjs
//
// 这个脚本只碰 `试炼.ts` 与 `词条与属性.ts` 的纯函数，不碰 state，
// 所以它验的是"数值与判定有没有摆错"，不是"界面长得对不对"。

import { TRIALS, TRIAL_MIN_TARGET_LOG10 } from '../src/game/词条与属性.ts'
import { REALMS } from '../src/game/realms.ts'
import {
  NO_TRIAL,
  findTrialIndex,
  markTrialDone,
  trialAt,
  trialBonus,
  trialCompleted,
  trialDaoJiOf,
  trialDaoJiTotal,
  trialDoneCount,
  trialGateJindan,
  trialGateName,
  trialJindanOpen,
  trialMet,
  trialMinJindan,
  trialOutputMul,
  trialPeriodMul,
  trialPriceMul,
  trialProgress,
  trialSlowFactor,
  trialTargetOf,
} from '../src/game/试炼.ts'
// 命名空间那一份只用来验"点数那三个函数确实被删干净了"（删掉的导出不能具名 import）
import * as trialMath from '../src/game/试炼.ts'
import { YUAN_GATE_JINDAN_LAYER } from '../src/game/元婴.ts'

let fails = 0
function check(name, ok, detail = '') {
  if (!ok) fails++
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? `   ${detail}` : ''}`)
}

console.log('【一】四道试炼的表')
{
  check('下标连续且从 0 起', TRIALS.every((d, i) => findTrialIndex(d.id) === i))
  check('id 不重复', new Set(TRIALS.map((d) => d.id)).size === TRIALS.length)
  check('慢倍数严格递增（难度排序）', TRIALS.every((d, i) => i === 0 || trialSlowFactor(d) > trialSlowFactor(TRIALS[i - 1])),
    TRIALS.map((d) => `${d.name} ×${trialSlowFactor(d)}`).join(' / '))
  check('道基奖励严格递增且是正整数',
    TRIALS.every((d, i) => Number.isInteger(d.daoJi) && d.daoJi > 0 && (i === 0 || d.daoJi > TRIALS[i - 1].daoJi)),
    TRIALS.map((d) => `${d.name} ${d.daoJi}`).join(' / '))
  for (const d of TRIALS) {
    const slow = trialSlowFactor(d)
    const ok = d.debuff.kind === 'output' ? Math.abs(slow - 1 / d.debuff.mul) < 1e-9 : Math.abs(slow - d.debuff.mul) < 1e-9
    check(`${d.name} 的慢倍数换算对（${d.debuff.kind}）`, ok, `×${slow}`)
  }
}

console.log('\n【二】debuff 只作用在本档')
{
  check('不在试炼里（-1）三个乘数都是 1',
    trialOutputMul(NO_TRIAL) === 1 && trialPriceMul(NO_TRIAL) === 1 && trialPeriodMul(NO_TRIAL) === 1)
  check('越界下标也当 1', trialOutputMul(99) === 1 && trialPriceMul(99) === 1 && trialPeriodMul(99) === 1)
  // 每道试炼只能开一种 debuff，另外两条乘数必须是 1——否则会出现"表里写一条、实际挨两条"
  for (const d of TRIALS) {
    const i = findTrialIndex(d.id)
    const muls = [trialOutputMul(i), trialPriceMul(i), trialPeriodMul(i)]
    check(`${d.name} 只开一种 debuff`, muls.filter((m) => m !== 1).length === 1, muls.join(' / '))
  }
}

console.log('\n【三】目标定标与判定')
{
  check('低于下限时抬起', trialTargetOf(6, TRIAL_MIN_TARGET_LOG10) === TRIAL_MIN_TARGET_LOG10)
  check('高于下限时取原值', trialTargetOf(28.4, TRIAL_MIN_TARGET_LOG10) === 28.4)
  check('非有限值退回下限', trialTargetOf(-Infinity, TRIAL_MIN_TARGET_LOG10) === TRIAL_MIN_TARGET_LOG10)
  check('刚好到线算过', trialMet(20, 20) === true)
  check('差一点不算过', trialMet(19.999, 20) === false)
  check('没在局中时不会误判', trialMet(-Infinity, 20) === false)
  check('进度按 log10 比例', Math.abs(trialProgress(10, 20) - 0.5) < 1e-9)
  check('进度夹在 0..1', trialProgress(30, 20) === 1 && trialProgress(0, 20) === 0)
}

console.log('\n【四】位图记账')
{
  let bm = 0
  check('空位图一道都没过', TRIALS.every((_, i) => !trialCompleted(bm, i)))
  bm = markTrialDone(bm, 0)
  check('记第一道', trialCompleted(bm, 0) && !trialCompleted(bm, 1))
  const again = markTrialDone(bm, 0)
  check('重复记幂等', again === bm)
  bm = markTrialDone(bm, 3)
  check('两道都记上', trialCompleted(bm, 0) && trialCompleted(bm, 3) && trialDoneCount(bm) === 2)
  check('越界不写脏位', markTrialDone(bm, 99) === bm && markTrialDone(bm, -1) === bm)
  check('全记满计数对齐', trialDoneCount(TRIALS.reduce((a, _, i) => markTrialDone(a, i), 0)) === TRIALS.length)
}

console.log('\n【五】奖励聚合')
{
  check('没完成时一条不加', JSON.stringify(trialBonus(0)) === JSON.stringify({ danAdd: 0, qiAdd: 0, energyAdd: 0, dregMul: 1, passMul: 1 }))
  const full = TRIALS.reduce((a, _, i) => markTrialDone(a, i), 0)
  const sum = trialBonus(full)
  const wantEnergy = TRIALS.reduce((a, d) => a + (d.bonus.energyAdd ?? 0), 0)
  const wantDan = TRIALS.reduce((a, d) => a + (d.bonus.danAdd ?? 0), 0)
  const wantPass = TRIALS.reduce((a, d) => a * (d.bonus.passMul ?? 1), 1)
  check('灵气加成为各档相加', Math.abs(sum.energyAdd - wantEnergy) < 1e-9, `+${(sum.energyAdd * 100).toFixed(0)}%`)
  check('出丹加成为各档相加', Math.abs(sum.danAdd - wantDan) < 1e-9, `+${(sum.danAdd * 100).toFixed(0)}%`)
  check('折点为各档相乘', Math.abs(sum.passMul - wantPass) < 1e-9, `×${sum.passMul.toFixed(2)}`)
  // 点数那条 0.22 已经整条删掉（见【八】），这里只剩"加成怎么并进总账"这一件事
}

console.log('\n【六】慢倍数与"爬回原处"的账')
{
  // 同一段复利路，产出被压 mul 倍，走完要 1/mul 倍时间——这正是界面念的那个倍数。
  // 这里只验算术：把每档的慢倍数换算成"同样的路要几倍时间"
  for (const d of TRIALS) {
    const slow = trialSlowFactor(d)
    const label = d.debuff.kind === 'output' ? `产出 ×${d.debuff.mul}` : d.debuff.kind === 'price' ? `单价 ×${d.debuff.mul}` : `周期 ×${d.debuff.mul}`
    check(`${d.name}：${label} → 慢 ×${slow}`, Number.isFinite(slow) && slow > 1)
  }
  check('最深一档至少慢十倍', Math.max(...TRIALS.map(trialSlowFactor)) >= 10)
  check('最浅一档不超过两倍', Math.min(...TRIALS.map(trialSlowFactor)) <= 2)
}

console.log('\n【七】准入门槛（元婴页的票 = 结丹一层，四道按层数分档）')
{
  // 这一组是"内容提前上线 / 锁进不存在的境界"那类问题的自动防线。
  // 0.21 起试炼归在元婴标签下，门槛一律按结丹层数（`minJindan`）：
  // 结婴要累计灵气 1e80，按境界下标当门槛等于把四道牌推到结婴之后（0.22 虽然能到元婴，
  // 但"试炼要在结婴前就能打"这条设计没变），而结丹层数只涨不跌、跨世保留。
  const YUANYING = REALMS.findIndex((r) => r.id === 'yuanying')
  check('元婴下标是 3', YUANYING === 3, String(YUANYING))
  check('元婴页已从 todo 换掉（试炼才挂得上去）', REALMS[YUANYING]?.page === 'yuan',
    REALMS[YUANYING]?.page ?? '越界')

  for (const d of TRIALS) {
    const n = trialMinJindan(d)
    check(`${d.name} 的 minJindan 是正整数`, Number.isInteger(n) && n >= 1, String(n))
  }
  check('门槛不倒退（后面的档不能比前面浅）',
    TRIALS.every((d, i) => i === 0 || trialMinJindan(d) >= trialMinJindan(TRIALS[i - 1])),
    TRIALS.map((d) => `${d.name}:${trialMinJindan(d)}`).join(' / '))
  check('整页门槛 = 各道里最浅的那一条',
    trialGateJindan(TRIALS) === Math.min(...TRIALS.map(trialMinJindan)),
    `need=${trialGateJindan(TRIALS)}`)
  check('整页门槛 = 元婴页的门票（否则页面开了点不动，或试炼永远在页外）',
    trialGateJindan(TRIALS) === YUAN_GATE_JINDAN_LAYER,
    `${trialGateJindan(TRIALS)} vs ${YUAN_GATE_JINDAN_LAYER}`)
  check('层数念法不念出小数', trialGateName(3) === '结丹 3 层', trialGateName(3))

  // 对照：0 层时四道全关（新档不该一进游戏就能开赌），最深那档的门槛确实更硬
  check('一层丹都没结时，四道全关', TRIALS.every((d) => !trialJindanOpen(d, 0)))
  check('刚好到线算开', TRIALS.every((d) => trialJindanOpen(d, trialMinJindan(d))))
  check('差一层不算开', TRIALS.every((d) => !trialJindanOpen(d, trialMinJindan(d) - 1)))
  const deepest = Math.max(...TRIALS.map(trialMinJindan))
  check('最深一档也要十来层，不是随手就开', deepest >= 6 && deepest <= 12, `${deepest} 层`)
  check('层数门槛不封顶（结丹无上限，老档 104 层四道全开）',
    TRIALS.every((d) => trialJindanOpen(d, 104)))
}

console.log('\n【八】奖励里没有筑基点（0.22 定稿：换成永久加成 + 道基）')
{
  // 为什么删：试炼的准入是结丹 1 层，那一刻本世累计早已过 1e30；而结丹之后筑基点本来就有
  // 按秒自动进账那条路（`pointPassPerSecond`）。一笔一次性点数最多等于"多挂几分钟"，
  // 而逆天要用 0.1 倍产出把 1e80 爬回来——数量级对不上。整条去掉，不留兜底字段。
  check('表里没有 points 字段', TRIALS.every((d) => !('points' in d)))
  check('表里没有 pointLoops 字段', TRIALS.every((d) => !('pointLoops' in d)))
  check('试炼模块也不再导出那三个点数函数',
    !('trialPointsOf' in trialMath) && !('trialPointsAt' in trialMath) && !('trialPointLoops' in trialMath))

  // 每一道都必须有实打实的永久加成，不能出现"只给道基"的空壳
  check('四道都有永久加成', TRIALS.every((d) => Object.keys(d.bonus ?? {}).length > 0),
    TRIALS.map((d) => `${d.name} ${Object.keys(d.bonus).join('+')}`).join(' / '))
  check('灵气产出随难度递增',
    TRIALS.every((d, i) => i === 0 || (d.bonus.energyAdd ?? 0) > (TRIALS[i - 1].bonus.energyAdd ?? 0)),
    TRIALS.map((d) => `${d.name} +${Math.round((d.bonus.energyAdd ?? 0) * 100)}%`).join(' / '))
  check('加成只落在现成五轴上',
    TRIALS.every((d) => Object.keys(d.bonus).every((k) =>
      ['danAdd', 'qiAdd', 'energyAdd', 'dregMul', 'passMul'].includes(k))),
    TRIALS.flatMap((d) => Object.keys(d.bonus)).filter((v, i, a) => a.indexOf(v) === i).join(' / '))

  // 全过之后叠起来是多大一笔——硬编码在这里，改表改漏了这一行会红
  const full = TRIALS.reduce((a, _, i) => markTrialDone(a, i), 0)
  const b = trialBonus(full)
  check('全过：灵气产出 +250%', Math.abs(b.energyAdd - 2.5) < 1e-9, `+${Math.round(b.energyAdd * 100)}%`)
  check('全过：出丹 +70%', Math.abs(b.danAdd - 0.7) < 1e-9, `+${Math.round(b.danAdd * 100)}%`)
  check('全过：每秒折点 ×1.9', Math.abs(b.passMul - 1.9) < 1e-9, `×${b.passMul}`)

  // 位图记账：抽不到的不给、重复标记不叠两遍、越界位不多给
  const zero = trialBonus(0)
  check('一道没过时加成是白的', zero.energyAdd === 0 && zero.danAdd === 0 && zero.passMul === 1)
  check('位图重复标记不叠两遍',
    Math.abs(trialBonus(markTrialDone(markTrialDone(full, TRIALS.length - 1), TRIALS.length - 1)).energyAdd - b.energyAdd) < 1e-9)
  check('越界位图不多给', Math.abs(trialBonus(0xffff).energyAdd - b.energyAdd) < 1e-9)
}

console.log('\n【九】道基奖励（结婴之后的阶段货币）')
{
  // 筑基点属于练气/筑基那本账，结婴后按秒自动进账，再厚也只是"多挂一会儿"。
  // 道基才是元婴阶段唯一稀缺的东西（一次大突破约 62 小时换 1~3 点），
  // 所以试炼的道基是固定梯度、只在结婴后兑现，结婴前过的在结婴那一刻补齐。
  // 0.22 定稿把筑基点整条删掉之后，道基从 35 提到 53——补的就是那笔点数腾出来的位置。
  const full = TRIALS.reduce((a, _, i) => markTrialDone(a, i), 0)
  check('四道合计 53 点', TRIALS.reduce((a, d) => a + d.daoJi, 0) === 53)
  check('一道没过时一点不欠', trialDaoJiTotal(0) === 0)
  check('过前两道欠 14 点', trialDaoJiTotal(markTrialDone(markTrialDone(0, 0), 1)) === 14)
  check('四道全过欠 53 点', trialDaoJiTotal(full) === 53)
  check('越界位图不凭空多欠', trialDaoJiTotal(0xffff) === 53)
  check('单道读数就是表里的值', TRIALS.every((d) => trialDaoJiOf(d) === Math.floor(d.daoJi)))
  check('坏值兜底为 0',
    trialDaoJiOf(null) === 0 && trialDaoJiOf({ ...TRIALS[0], daoJi: -5 }) === 0 &&
      trialDaoJiOf({ ...TRIALS[0], daoJi: NaN }) === 0 && trialDaoJiOf({ ...TRIALS[0], daoJi: undefined }) === 0)
  // 道基不跟境界涨：它本身就是极慢的长线货币，固定梯度才好控
  check('道基与目标高度无关', trialDaoJiOf(TRIALS[3]) === 24 && trialDaoJiOf(TRIALS[0]) === 5)
}

console.log(`\n${fails === 0 ? '全部通过' : `${fails} 条未通过`}`)
if (fails > 0) process.exit(1)
