const VISIBILITY_EVENT = 'memo:visibility'

/**
 * 页面可见性变化时触发；detail.hidden 表示页面被切到后台。
 * 微信/移动浏览器切后台后 JS 计时不可靠，游戏应监听此事件暂停计时。
 */
export function onVisibilityChange(
  cb: (detail: { hidden: boolean }) => void,
): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail)
  window.addEventListener(VISIBILITY_EVENT, handler)
  return () => window.removeEventListener(VISIBILITY_EVENT, handler)
}

let installed = false

/** 移动端/微信内体验适配，在 main.ts 调用一次 */
export function setupCompat(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  document.addEventListener(
    'visibilitychange',
    () => {
      window.dispatchEvent(
        new CustomEvent(VISIBILITY_EVENT, {
          detail: { hidden: document.hidden },
        }),
      )
    },
    { passive: true },
  )

  // 阻止双击缩放（iOS Safari 旧版本不遵守 touch-action 时兜底）
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    },
    { passive: false },
  )

  // 阻止橡皮筋：仅当目标自身不可滚动时拦截 touchmove
  document.addEventListener(
    'touchmove',
    (e) => {
      let el = e.target as HTMLElement | null
      while (el && el !== document.body) {
        if (el.dataset.scrollable !== undefined) return
        el = el.parentElement
      }
      e.preventDefault()
    },
    { passive: false },
  )
}
