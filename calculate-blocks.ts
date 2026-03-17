/**
 * 计算 10MB 文本在不同场景下的 blocks 数量
 * 基于项目中的分块逻辑：按换行符切分，去除空行
 */

const MB = 1024 * 1024; // 1MB in bytes

/**
 * 生成测试文本
 */
function generateTestText(avgLineLength: number, totalLines: number): string {
  const lines: string[] = [];
  
  // 使用中文文本生成器
  const chineseChars = '这是一个测试文本用于计算blocks数量我们会重复使用这段文字来达到预期的长度实际应用中的文本长度会有所不同但这个测试可以给我们一个大概的估计';
  
  for (let i = 0; i < totalLines; i++) {
    let line = '';
    let currentLength = 0;
    
    while (currentLength < avgLineLength) {
      const remaining = avgLineLength - currentLength;
      const charsToAdd = Math.min(remaining, chineseChars.length);
      line += chineseChars.slice(0, charsToAdd);
      currentLength += charsToAdd;
    }
    
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * 计算文件大小（字节）
 */
function getFileSizeInBytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * 计算blocks数量（基于项目逻辑）
 */
function calculateBlocks(text: string): number {
  // 按换行符切分，去除空行和空白字符
  const blocks = text.split(/\r?\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 0);
  return blocks.length;
}

/**
 * 测试场景
 */
interface TestScenario {
  name: string;
  avgLineLength: number;
  description: string;
}

const scenarios: TestScenario[] = [
  {
    name: '短行场景',
    avgLineLength: 50,
    description: '平均每行 50 字符（短句、短语）'
  },
  {
    name: '中行场景',
    avgLineLength: 200,
    description: '平均每行 200 字符（正常段落）'
  },
  {
    name: '长行场景',
    avgLineLength: 500,
    description: '平均每行 500 字符（长段落）'
  },
  {
    name: '书籍格式',
    avgLineLength: 1000,
    description: '平均每段 1000 字符（完整段落）'
  }
];

/**
 * 主测试函数
 */
async function main() {
  const targetSize = 10 * MB; // 10MB
  
  console.log('📊 10MB 文本 blocks 数量计算');
  console.log('═'.repeat(70));
  console.log(`目标文件大小: ${(targetSize / MB).toFixed(2)} MB (${targetSize.toLocaleString()} bytes)`);
  console.log('分块逻辑: 按换行符切分，去除空行和空白字符');
  console.log('═'.repeat(70));
  console.log();
  
  const results: any[] = [];
  
  for (const scenario of scenarios) {
    console.log(`🔍 测试场景: ${scenario.name}`);
    console.log(`   ${scenario.description}`);
    
    // 计算需要的行数
    const avgLineBytes = scenario.avgLineLength * 3; // 假设UTF-8编码，每个汉字约3字节
    const estimatedLines = Math.floor(targetSize / avgLineBytes);
    
    console.log(`   估算行数: ${estimatedLines.toLocaleString()}`);
    
    // 生成测试文本（只生成部分用于计算）
    const sampleLines = Math.min(estimatedLines, 1000); // 限制采样数量
    const sampleText = generateTestText(scenario.avgLineLength, sampleLines);
    const sampleSize = getFileSizeInBytes(sampleText);
    
    // 推算完整文本的行数和大小
    const scaleFactor = targetSize / sampleSize;
    const totalLines = Math.floor(sampleLines * scaleFactor);
    const finalSize = sampleSize * scaleFactor;
    
    console.log(`   采样行数: ${sampleLines.toLocaleString()}`);
    console.log(`   推算总行数: ${totalLines.toLocaleString()}`);
    console.log(`   推算文件大小: ${(finalSize / MB).toFixed(2)} MB`);
    
    // 计算blocks数量
    const sampleBlocks = calculateBlocks(sampleText);
    const totalBlocks = Math.floor(sampleBlocks * scaleFactor);
    
    console.log(`   采样blocks: ${sampleBlocks.toLocaleString()}`);
    console.log(`   推算总blocks: ${totalBlocks.toLocaleString()}`);
    console.log(`   平均每block大小: ${(finalSize / totalBlocks / 1024).toFixed(2)} KB`);
    
    results.push({
      name: scenario.name,
      avgLineLength: scenario.avgLineLength,
      totalLines: totalLines,
      totalBlocks: totalBlocks,
      fileSizeMB: finalSize / MB,
      avgBlockSizeKB: finalSize / totalBlocks / 1024
    });
    
    console.log();
  }
  
  // 总结报告
  console.log('📈 测试结果总结:');
  console.log('═'.repeat(70));
  console.log(`场景         | 平均行长 | 总行数     | 总blocks   | 文件大小  | 平均block大小`);
  console.log('-'.repeat(70));
  
  for (const result of results) {
    console.log(`${result.name.padEnd(12)} | ${String(result.avgLineLength).padEnd(8)} | ${result.totalLines.toLocaleString().padEnd(10)} | ${result.totalBlocks.toLocaleString().padEnd(10)} | ${result.fileSizeMB.toFixed(2).padEnd(9)}MB | ${result.avgBlockSizeKB.toFixed(2).padEnd(10)}KB`);
  }
  
  console.log('═'.repeat(70));
  console.log();
  
  // 性能影响分析
  console.log('📊 性能影响分析:');
  console.log('-'.repeat(70));
  
  const blocksRange = {
    min: Math.min(...results.map(r => r.totalBlocks)),
    max: Math.max(...results.map(r => r.totalBlocks))
  };
  
  console.log(`blocks数量范围: ${blocksRange.min.toLocaleString()} - ${blocksRange.max.toLocaleString()}`);
  console.log(`差距倍数: ${(blocksRange.max / blocksRange.min).toFixed(2)}x`);
  console.log();
  
  // Embedding时间估算
  console.log('⏱️  Embedding 时间估算 (基于性能测试结果):');
  console.log('-'.repeat(70));
  
  const avgBlockSizes = [50, 200, 500, 1000];
  const embeddingTimes = [13.75, 32.72, 68.36]; // 基于之前的测试结果
  
  console.log('场景           | 平均block大小 | 预估总blocks | Embedding总时间');
  console.log('-'.repeat(70));
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const avgBlockSize = avgBlockSizes[i];
    
    // 根据之前测试结果估算Embedding时间
    let embeddingTimePerBlock: number;
    if (avgBlockSize <= 50) {
      embeddingTimePerBlock = embeddingTimes[0];
    } else if (avgBlockSize <= 200) {
      embeddingTimePerBlock = embeddingTimes[1];
    } else if (avgBlockSize <= 500) {
      embeddingTimePerBlock = embeddingTimes[2];
    } else {
      embeddingTimePerBlock = embeddingTimes[2] * 1.2; // 1000字比500字稍长
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
}

main().catch(console.error);