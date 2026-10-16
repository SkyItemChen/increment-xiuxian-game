// 一次性：给 Node 的解析器补 .ts 后缀，好在无头环境里 import 项目真实的 explore.ts
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(spec, ctx, next) {
    if (!spec.startsWith('.') || /\.(mjs|js|ts)$/.test(spec)) return next(spec, ctx)
    const base = new URL(spec, ctx.parentURL)
    for (const suffix of ['.ts', '/index.ts']) {
      const url = new URL(base.href + suffix)
      if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true }
    }
    return next(spec, ctx)
  },
})
