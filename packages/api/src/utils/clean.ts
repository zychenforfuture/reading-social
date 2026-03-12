export function cleanText(input: string, maxLen = 5000): string {
  if (input === undefined || input === null) return input as unknown as string;
  // 移除 null 字节
  let s = input.replace(/\0/g, '');
  // 移除大多数控制字符，保留常见换行和制表符
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // 统一 CRLF 为 LF
  s = s.replace(/\r\n?/g, '\n');
  // 修剪两端，折叠连续空白为单个空格（包含 NBSP）
  s = s.trim().replace(/[ \u00A0\u2000-\u200A]+/g, ' ');
  if (maxLen && s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}
