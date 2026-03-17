/**
 * 简化版本的 blocks 数量计算
 */

const MB = 1024 * 1024; // 1MB in bytes
const targetSize = 10 * MB; // 10MB

// 假设UTF-8编码，每个汉字约3字节
const bytesPerChar = 3;

// 测试场景
const scenarios = [
  {
    name: '短行场景',
    avgLineLength: 50, // 每行50字
    description: '平均每行 50 字符（短句、短语）'
  },
  {
    name: '中行场景',
    avgLineLength: 200, // 每行200字
    description: '平均每行 200 字符（正常段落）'
  },
  {
    name: '长行场景',
    avgLineLength: 500, // 每行500字
    description: '平均每行 500 字符（长段落）'
  },
  {
    name: '书籍格式',
    avgLineLength: 1000, // 每段1000字
    description: '平均每段 1000 字符（完整段落）'
  }
];

console.log('📊 10MB 文本 blocks 数量计算');
console.log('═'.repeat(70));
console.log(`目标文件大小: ${(targetSize / MB).toFixed(2)} MB (${targetSize.toLocaleString()} bytes)`);
console.log('分块逻辑: 按换行符切分，去除空行和空白字符');
console.log('═'.repeat(70));
console.log();

console.log(`场景         | 平均行长 | 估算行数    | 估算blocks  | 平均block大小`);
console.log('-'.repeat(70));

for (const scenario of scenarios) {
  const avgLineBytes = scenario.avgLineLength * bytesPerChar;
  const totalLines = Math.floor(targetSize / avgLineBytes);
  const totalBlocks = totalLines; // blocks = 非空行数
  const avgBlockSizeKB = (targetSize / totalBlocks) / 1024;
  
  console.log(`${scenario.name.padEnd(12)} | ${String(scenario.avgLineLength).padEnd(8)} | ${totalLines.toLocaleString().padEnd(11)} | ${totalBlocks.toLocaleString().padEnd(11)} | ${avgBlockSizeKB.toFixed(2).padEnd(10)}KB`);
}

console.log('═'.repeat(70));
console.log();

// 性能影响分析
console.log('📊 性能影响分析:');
console.log('-'.repeat(70));

const results = scenarios.map(s => {
  const avgLineBytes = s.avgLineLength * bytesPerChar;
  const totalLines = Math.floor(targetSize / avgLineBytes);
  return {
    name: s.name,
    avgLineLength: s.avgLineLength,
    totalLines: totalLines,
    totalBlocks: totalLines
  };
});

const blocksRange = {
  min: Math.min(...results.map(r => r.totalLines)),
  max: Math.max(...results.map(r => r.totalLines))
};

console.log(`blocks数量范围: ${blocksRange.min.toLocaleString()} - ${blocksRange.max.toLocaleString()}`);
console.log(`差距倍数: ${(blocksRange.max / blocksRange.min).toFixed(2)}x`);
console.log();

// Embedding时间估算（基于之前的性能测试结果）
console.log('⏱️  Embedding 时间估算 (基于性能测试结果):');
console.log('-'.repeat(70));

const avgBlockSizes = [50, 200, 500, 1000];
const embeddingTimes = [13.75, 32.72, 68.36]; // 基于之前测试结果（100字→13.75ms, 1000字→68.36ms）

console.log('场景           | 平均block大小 | 预估总blocks | Embedding总时间');
console.log('-'.repeat(70));

for (let i = 0; i < results.length; i++) {
  const result = results[i];
  const avgBlockSize = avgBlockSizes[i];
  
  // 根据之前测试结果估算Embedding时间
  let embeddingTimePerBlock;
  if (avgBlockSize <= 50) {
    embeddingTimePerBlock = embeddingTimes[0];
  } else if (avgBlockSize <= 200) {
    // 线性插值
    const ratio = (avgBlockSize - 50) / (200 - 50);
    embeddingTimePerBlock = embeddingTimes[0] + ratio * (embeddingTimes[1] - embeddingTimes[0]);
  } else if (avgBlockSize <= 500) {
    const ratio = (avgBlockSize - 200) / (500 - 200);
    embeddingTimePerBlock = embeddingTimes[1] + ratio * (embeddingTimes[2] - embeddingTimes[1]);
  } else {
    const ratio = (avgBlockSize - 500) / (1000 - 500);
    embeddingTimePerBlock = embeddingTimes[2] + ratio * (embeddingTimes[2] * 1.2 - embeddingTimes[2]);
  }
  
  const totalEmbeddingTime = (result.totalBlocks * embeddingTimePerBlock) / 1000; // 转换为秒
  const totalEmbeddingTimeMinutes = totalEmbeddingTime / 60;
  
  console.log(`${result.name.padEnd(12)} | ${String(avgBlockSize).padEnd(13)} | ${result.totalBlocks.toLocaleString().padEnd(13)} | ${totalEmbeddingTimeMinutes.toFixed(2).padEnd(12)}分钟`);
}

console.log('═'.repeat(70));
console.log();

// 存储空间估算
console.log('💾 存储空间估算 (假设每条记录 1KB):');
console.log('-'.repeat(70));

console.log('场景           | 总blocks   | 数据库存储  | Qdrant向量存储');
console.log('-'.repeat(70));

for (const result of results) {
  const dbStorageMB = result.totalBlocks * 1 / 1024; // 假设每条记录1KB
  const vectorStorageMB = result.totalBlocks * 384 * 4 / 1024 / 1024; // 384维，每维4字节
  
  console.log(`${result.name.padEnd(12)} | ${result.totalBlocks.toLocaleString().padEnd(10)} | ${dbStorageMB.toFixed(2).padEnd(10)}MB | ${vectorStorageMB.toFixed(2).padEnd(15)}MB`);
}

console.log('═'.repeat(70));