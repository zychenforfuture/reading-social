/**
 * SimHash 实现 - 用于文本去重和相似度计算
 *
 * 算法原理：
 * 1. 对文本分词
 * 2. 对每个词计算哈希
 * 3. 根据哈希的每一位更新权重向量
 * 4. 根据权重向量生成最终的指纹
 *
 * 相似度计算：通过海明距离判断两个指纹的相似程度
 * 海明距离 <= 3 可认为文本高度相似
 */

import { createHash } from 'crypto';

const HASH_BITS = 64; // 64 位 SimHash

/**
 * 计算字符串的 MD5 哈希，返回二进制数组
 */
function md5Bits(text: string): number[] {
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
function tokenize(text: string): string[] {
  // 提取所有中文字符、字母数字序列
  const chinese = text.match(/[\u4e00-\u9fa5]/g) || [];
  const words = text.match(/[a-zA-Z0-9]+/g) || [];
  return [...chinese, ...words];
}

/**
 * 计算文本的 SimHash 指纹
 * @returns 64 位哈希的十六进制字符串
 */
export function computeSimHash(text: string): string {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    // 空文本返回全 0
    return '0'.repeat(16);
  }

  // 权重向量，初始化为 0
  const weights = new Array(HASH_BITS).fill(0);

  // 对每个词计算哈希并累加权重
  for (const token of tokens) {
    const bits = md5Bits(token);
    for (let i = 0; i < HASH_BITS; i++) {
      // 如果第 i 位为 1，权重 +1；否则 -1
      weights[i] += bits[i] === 1 ? 1 : -1;
    }
  }

  // 根据权重向量生成最终指纹
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
 * @param hash1 - 第一个哈希值（16 位十六进制）
 * @param hash2 - 第二个哈希值（16 位十六进制）
 * @returns 海明距离（0-64）
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== 16 || hash2.length !== 16) {
    throw new Error('Invalid hash length, expected 16 hex characters');
  }

  const num1 = BigInt('0x' + hash1);
  const num2 = BigInt('0x' + hash2);
  const xor = num1 ^ num2;

  // 计算异或结果中 1 的个数（海明距离）
  let distance = 0;
  let value = xor;
  while (value > 0n) {
    distance += Number(value & 1n);
    value >>= 1n;
  }

  return distance;
}

/**
 * 根据海明距离计算相似度分数
 * @param distance - 海明距离
 * @returns 相似度分数（0-1）
 */
export function similarityFromDistance(distance: number): number {
  return 1 - (distance / HASH_BITS);
}

/**
 * 判断两个文本是否相似
 * @param hash1 - 第一个哈希
 * @param hash2 - 第二个哈希
 * @param threshold - 海明距离阈值，默认 3（<=3 认为高度相似）
 * @returns 是否相似
 */
export function isSimilar(hash1: string, hash2: string, threshold = 3): boolean {
  return hammingDistance(hash1, hash2) <= threshold;
}
