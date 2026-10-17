import { BigNumber } from '../src/game/BigNumber.ts'
import { describeSave, exportSave, importSave, state } from '../src/game/state.ts'

state.spirit = new BigNumber(1.5, 12)
state.points = 23
state.pointsEarned = 40
state.loops = 5
state.settings.autoBuyCultivate = true
state.settings.autoBuyPill = true
// 丹炉那四个字段是 v11 新加的，位置在 [23]..[26]，来回一趟得一个都不丢
state.dan = new BigNumber(7.25, 19)
state.pillLevels = { danLu: 12, huoHou: 9, danFang: 3 }
state.jindan = 2
// v16：丹纹四枝等级 [32]。第 2 层带里程碑一共 6 点，两枝各 2 级正好花完
state.jindanTree = { danDao: 2, fanYuan: 2 }
state.pillAnchor = 24.3718
// v12：筑基点零头 [27]，加上根骨/鉴宝台两颗代买开关（偏好位标 8 与 16）
state.loopBanked = 0.3742
state.settings.autoBuyRebirth = true
state.settings.autoBuyExplore = true
// v13：废渣 [28]、抽数 [29]、精神等级表 [30]、火候档位 [31]，加上代抽开关（偏好位标 32）
state.dreg = new BigNumber(3.5, 17)
state.pulls = 50
state.spirits = { wuHuo: 6, shouYi: 2, minShou: 2, dingXi: 9 }
state.pillMode = 'wild'
state.settings.autoBuyPull = true
// v14：自动化开关只有在对应成就达成后才会保留，先把根骨与鉴宝台的门槛摆齐
state.rebirth = { daoJi: 40 }
state.exploreLevels = { yanLi: 24 }

state.totalTime = 45296
const code = exportSave()
console.log('存档码长', code.length, '· 只含 base64 字符 =', /^[A-Za-z0-9+/=]+$/.test(code))
// 导入那一面的提示词是拍死三项：灵气、最后保存时间、游玩时长——第几世与筑基点不许再回来挤位置
const glance = describeSave(code)
console.log('读一眼：', glance)
console.log(
  '  三项齐 =', ['灵气', '保存于', '游玩'].every((k) => glance.includes(k)),
  '· 念的游玩时长 =', /游玩 (\d+):/.exec(glance)?.[1] === '12' ? '12:34:56 ✓' : '对不上 ✗',
  '· 世/筑基点没混进来 =', !glance.includes('世') && !glance.includes('筑基点'),
)

state.points = 0
console.log(
  '原样贴回：', importSave(code), '· 筑基点', state.points,
  '· 自动化开关', state.settings.autoBuyCultivate, state.settings.autoBuyPill,
  state.settings.autoBuyRebirth, state.settings.autoBuyExplore, state.settings.autoBuyPull,
  '· 零头', state.loopBanked,
)
const allOn = [
  state.settings.autoBuyCultivate, state.settings.autoBuyPill, state.settings.autoBuyRebirth,
  state.settings.autoBuyExplore, state.settings.autoBuyPull,
].every(Boolean)
console.log('  v14 同档开关原样保留 =', allOn)
console.log(
  '丹炉那几栏：丹', state.dan.format(2), '· 炉子', state.pillLevels.danLu,
  '· 火候', state.pillLevels.huoHou, '· 丹房', state.pillLevels.danFang,
  '· 结丹', state.jindan, '层 · 锚', state.pillAnchor,
)
console.log(
  '丹纹那几枝：丹道', state.jindanTree.danDao, '级 · 返元', state.jindanTree.fanYuan,
  '级 · 识海', state.jindanTree.shiHai ?? 0, '级 · 炉火', state.jindanTree.luHuo ?? 0,
  '级',
)
console.log(
  '凝练那几栏：废渣', state.dreg.format(2), '· 抽过', state.pulls, '次 · 武火', state.spirits.wuHuo,
  '· 守一', state.spirits.shouYi, '· 敏手', state.spirits.minShou, '· 定息', state.spirits.dingXi,
  '· 火候档', state.pillMode,
)

// 定长数组的下标就是格式，改一位等于把所有存档读坏；把整张表钉在这儿
const table = JSON.parse(atob(code))
console.log('字段总数', table.length, '· 版本', table[0])
for (const [i, want] of [
  [1, '灵气'], [23, '丹'], [24, '结丹层数'], [25, '定价锚'], [26, '丹炉等级表'], [27, '筑基点零头'],
  [28, '废渣'], [29, '抽过的次数'], [30, '丹道精神等级表'], [31, '火候档位'],
  [32, '丹纹四枝等级表'],
]) {
  const got = table[i]
  const shape = Array.isArray(got) ? `数组长 ${got.length}` : typeof got === 'number' ? '数' : typeof got
  console.log(`  [${i}] ${want}：${shape}`)
}

// 老存档少几栏也要读得动：v11 的码贴回来，零头与凝练那四栏全按"没有"处理
const old = JSON.parse(atob(code))
old.splice(27, 6)
old[0] = 11
state.loopBanked = 9
state.points = 0
state.dreg = new BigNumber(9, 9)
state.pulls = 9
state.pillMode = 'serene'
console.log(
  'v11 老码：', importSave(JSON.stringify(old)), '· 零头归', state.loopBanked, '· 筑基点', state.points,
  '· 废渣归', state.dreg.format(0), '· 抽数归', state.pulls, '· 档', state.pillMode,
)

// v12 的码只缺凝练那四栏，零头该照样读回来
const v12 = JSON.parse(atob(code))
v12.splice(28, 5)
v12[0] = 12
state.loopBanked = 0
state.pulls = 7
state.pillMode = 'serene'
console.log(
  'v12 老码：', importSave(JSON.stringify(v12)), '· 零头', state.loopBanked,
  '· 抽数归', state.pulls, '· 档改回', state.pillMode, '· 丹房', state.pillLevels.danFang,
)

// v13 老码：字段全在，但五颗自动化开关一次性归零（哪怕门槛已经达到）
const v13 = JSON.parse(atob(code))
v13.splice(32, 1)
v13[0] = 13
console.log(
  'v13 老码：', importSave(JSON.stringify(v13)),
  '· 五颗开关全关 =',
  [
    state.settings.autoBuyCultivate, state.settings.autoBuyPill, state.settings.autoBuyRebirth,
    state.settings.autoBuyExplore, state.settings.autoBuyPull,
  ].every((on) => on === false),
)

// v15 老码没有 [32]：丹纹四枝按"没点过"读进来，结丹层数照旧
const v15 = JSON.parse(atob(code))
v15.splice(32, 1)
v15[0] = 15
state.jindanTree = { danDao: 3 }
console.log(
  'v15 老码：', importSave(JSON.stringify(v15)),
  '· 结丹', state.jindan, '层 · 丹纹归空 =', Object.keys(state.jindanTree).length === 0,
)

// 改过的档把四枝全写成满级、点数却不够：整棵清掉，别让它白拿加成
const badTree = JSON.parse(atob(code))
badTree[32] = [22, 22, 22, 22]
state.jindanTree = {}
console.log(
  '改过的丹纹：', importSave(JSON.stringify(badTree)),
  '· 整棵清空 =', Object.keys(state.jindanTree).length === 0,
)

// v14 的码（用户实际导出的那种）：根骨 36、鉴宝台 12、位标 27，门槛没到但三颗开着
const v14 = JSON.parse(atob(code))
v14.splice(32, 1)
v14[0] = 14
v14[18] = 27
v14[7] = 399
v14[15] = [8, 7, 7, 7, 7]
v14[17] = [3, 3, 3, 3]
console.log(
  'v14 老码：', importSave(JSON.stringify(v14)),
  '· 五颗开关全关 =',
  [
    state.settings.autoBuyCultivate, state.settings.autoBuyPill, state.settings.autoBuyRebirth,
    state.settings.autoBuyExplore, state.settings.autoBuyPull,
  ].every((on) => on === false),
)

// 落地成文件常被按 76 字符换行，粘回来还该认得
const wrapped = code.match(/.{1,76}/g).join('\n')
state.points = 0
console.log('换行版：', importSave(wrapped), '· 筑基点', state.points)

// 早先导出过的是裸 JSON 文本，别让玩家手边的旧文件作废
state.points = 0
console.log('裸 JSON 版：', importSave(JSON.stringify(JSON.parse(atob(code)))), '· 筑基点', state.points)

for (const bad of ['', '   ', '这不是存档', 'eyJub3QgYSBzYXZlIg==', '{oops']) {
  console.log(`  拒收 ${JSON.stringify(bad)}：`, describeSave(bad) ?? '认不出来', '·', importSave(bad) ? '竟然写进去了' : '进度没动')
}
