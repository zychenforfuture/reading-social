/**
 * SimHash 实现 - 用于文本去重和相似度计算
 */

import { createHash } from 'crypto';

const HASH_BITS = 64;

/**
 * 计算字符串的 MD5 哈希，返回二进制数组
 */
export function md5Bits(text: string): number[] {
  const hash = createHash('md5').update(text).digest('hex');
  const bits: number[] = [];
  for (const char of hash) {
    const num = parseInt(char, 16);
    bits.push((num & 8) >> 3);
    bits.push((num & 4) >> 2);
    bits.push((num & 2) >> 1);
    bits.push(num & 1);
  }
  return bits;
}

/**
 * 对文本进行分词（中文按字分词，英文按单词）
 */
export function tokenize(text: string): string[] {
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || [];
  const words = text.match(/[a-zA-Z0-9]+/g) || [];
  return [...chinese, ...words];
}

/**
 * 计算文本的 SimHash 指纹
 */
export function computeSimHash(text: string): string {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return '0'.repeat(16);
  }

  const weights = new Array(HASH_BITS).fill(0);

  for (const token of tokens) {
    const bits = md5Bits(token);
    for (let i = 0; i < HASH_BITS; i++) {
      weights[i] += bits[i] === 1 ? 1 : -1;
    }
  }

  let hash = '';
  for (let i = 0; i < HASH_BITS; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4; j++) {
      if (weights[i + j] >= 0) {
        nibble |= (1 << (3 - j));
      }
    }
    hash += nibble.toString(16);
  }

  return hash;
}

/**
 * 计算两个 SimHash 之间的海明距离
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== 16 || hash2.length !== 16) {
    throw new Error('Invalid hash length, expected 16 hex characters');
  }

  const num1 = BigInt('0x' + hash1);
  const num2 = BigInt('0x' + hash2);
  const xor = num1 ^ num2;

  let distance = 0;
  let value = xor;
  while (value > 0n) {
    distance += Number(value & 1n);
    value >>= 1n;
  }

  return distance;
}

/**
 * 计算相似度分数
 */
export function calculateSimilarityScore(distance: number): number {
  return Number((1 - distance / 64).toFixed(4));
}
