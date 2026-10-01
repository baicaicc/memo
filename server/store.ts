import { getStore } from '@edgeone/pages-blob'
import type { ProfileStore } from './handlers'

/**
 * EdgeOne Makers Blob 存储：首次调用自动为项目建命名空间，函数运行时由平台注入凭据。
 * 读用强一致，保证刚写入就能读到（恢复码在别的设备上立刻可用）。
 */
export function blobStore(): ProfileStore {
  const store = getStore('memo-profiles')
  return {
    get: (key) => store.get(key, { consistency: 'strong' }),
    put: (key, value) => store.set(key, value),
  }
}
