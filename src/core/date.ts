/** 按本机时区格式化为 YYYY-MM-DD（打卡、每日任务、进步统计共用同一口径） */
export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地日历上加减天数（按日期而不是 86400000 毫秒，避开夏令时） */
export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}
