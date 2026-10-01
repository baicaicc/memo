import type { KV } from './handlers'

declare global {
  /** EdgeOne Pages 控制台把 KV 命名空间绑定到项目时设置的变量名 */
  const MEMO_KV: KV | undefined
}
