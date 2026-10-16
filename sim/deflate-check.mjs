// 存档码要不要再套一层 deflate：量三种写法各多长，顺带验证解压能还原。
// 用的是浏览器同款 CompressionStream（Node 24 也有这个全局），所以量出来的就是线上跑得通的。
import { BigNumber } from '../src/game/BigNumber.ts'
import { exportSave, state } from '../src/game/state.ts'

const enc = new TextEncoder()

async function pack(text, format) {
  const bytes = await new Response(
    new Blob([text]).stream().pipeThrough(new CompressionStream(format)),
  ).arrayBuffer()
  let binary = ''
  for (const b of new Uint8Array(bytes)) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function unpack(code, format) {
  const bin = atob(code)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new Response(
    new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)),
  ).text()
}

function b64(text) {
  let binary = ''
  for (const b of enc.encode(text)) binary += String.fromCharCode(b)
  return btoa(binary)
}

async function early() {
  state.spirit = new BigNumber(5.2, 10)
  state.totalEarned = new BigNumber(5.2, 10)
  state.loopEarned = new BigNumber(5.2, 10)
  state.points = 2
  state.pointsEarned = 2
  state.loops = 0
  state.levels = { tuNaYinQi: 12, jinWuJue: 3 }
  state.rebirth = { daoJi: 1, lingGen: 1 }
  state.treasures = {}
  state.exploreLevels = {}
  return atob(exportSave())
}

async function late() {
  state.spirit = new BigNumber(1.5, 12)
  state.totalEarned = new BigNumber(7.3, 300)
  state.loopEarned = new BigNumber(9.9, 300)
  state.points = 1886
  state.pointsEarned = 1886
  state.loops = 116
  state.totalGathers = 987654
  state.totalTime = 14400
  state.levels = { tuNaYinQi: 54, jinWuJue: 9, yangHeGong: 8, kanShanJue: 8, guiYiZhen: 18 }
  state.rebirth = { daoJi: 14, lingGen: 14, wuXing: 13, huiGen: 10, yuanFa: 10 }
  state.treasures = { juBaoPen: 3, ziJinHuLu: 2, xuanTongJing: 1, hunDunZhong: 1, ding: 2 }
  state.exploreLevels = { yanLi: 5, cuiLian: 4, tieShan: 3, jianShi: 6 }
  return atob(exportSave())
}

for (const [label, build] of [['开局一世', early], ['后期满档', late]]) {
  const json = await build()
  const plain = b64(json)
  const deflate = await pack(json, 'deflate')
  const gzip = await pack(json, 'gzip')
  const raw = await pack(json, 'deflate-raw')
  const back = await unpack(deflate, 'deflate')
  console.log(
    `${label}：裸 JSON ${String(json.length).padStart(4)} · base64 ${String(plain.length).padStart(4)}` +
      ` · base64+deflate ${String(deflate.length).padStart(4)} · gzip ${String(gzip.length).padStart(4)}` +
      ` · deflate-raw ${String(raw.length).padStart(4)}`,
  )
  console.log(
    `  相对裸 JSON：base64 ×${(plain.length / json.length).toFixed(2)} · ` +
      `deflate ×${(deflate.length / json.length).toFixed(2)} · 还原一致 = ${back === json}`,
  )
}
