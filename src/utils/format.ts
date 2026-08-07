export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function uid(): number {
  return Date.now() + Math.floor(Math.random() * 10000)
}

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** 中文模糊匹配相似度（简单实现：字符交集 / 长度） */
export function similarity(a: string, b: string): number {
  const A = a.replace(/\s/g, '')
  const B = b.replace(/\s/g, '')
  if (!A || !B) return 0
  if (A === B) return 1
  const shorter = A.length <= B.length ? A : B
  const longer = A.length <= B.length ? B : A
  let matches = 0
  for (const ch of shorter) {
    if (longer.includes(ch)) matches++
  }
  // 短串完全包含于长串时给予较高相似度
  if (longer.includes(shorter)) {
    return Math.max(0.55, matches / longer.length)
  }
  return matches / shorter.length
}

export const CAUSES = [
  '买卖合同纠纷',
  '民间借贷纠纷',
  '借款合同纠纷',
  '房屋买卖合同纠纷',
  '租赁合同纠纷',
  '建设工程施工合同纠纷',
  '劳动争议',
  '婚姻家庭纠纷',
  '继承纠纷',
  '侵权责任纠纷',
  '交通事故责任纠纷',
  '股权转让纠纷',
  '公司决议纠纷',
  '服务合同纠纷',
  '居间合同纠纷',
  '承揽合同纠纷',
  '物业服务合同纠纷',
  '其他合同纠纷',
  '执行异议之诉',
  '其他',
]

export const CONFLICT_HINT = '可能与现有客户存在利益冲突'
