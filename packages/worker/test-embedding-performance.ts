/**
 * Embedding 性能测试脚本
 * 测试不同长度文本的 Embedding 生成耗时
 */

import { pipeline, env } from '@xenova/transformers';

// 配置 transformers.js 使用本地缓存
env.allowLocalModels = true;
env.cacheDir = './.cache';

/**
 * 生成文本的向量嵌入
 */
async function generateEmbedding(text: string, embeddingPipeline: any): Promise<number[]> {
  const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data as Float32Array);
}

/**
 * 性能测试函数
 */
async function benchmarkEmbedding(text: string, iterations: number, embeddingPipeline: any): Promise<number[]> {
  const times: number[] = [];
  
  for (let i = 0; i < iterations; i++) {
    const startTime = performance.now();
    await generateEmbedding(text, embeddingPipeline);
    const endTime = performance.now();
    const duration = endTime - startTime;
    times.push(duration);
    console.log(`  迭代 ${i + 1}: ${duration.toFixed(2)}ms`);
  }
  
  return times;
}

/**
 * 计算统计信息
 */
function calculateStats(times: number[]): { mean: number; min: number; max: number; median: number } {
  const sorted = [...times].sort((a, b) => a - b);
  const mean = times.reduce((sum, time) => sum + time, 0) / times.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  return {
    mean: Number(mean.toFixed(2)),
    min: Number(sorted[0].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
    median: Number(median.toFixed(2))
  };
}

async function main() {
  console.log('🚀 开始 Embedding 性能测试...\n');

  // 加载模型
  console.log('📥 加载 embedding 模型...');
  const modelStartTime = performance.now();
  const embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const loadTime = performance.now() - modelStartTime;
  console.log(`✅ 模型加载完成，耗时: ${loadTime.toFixed(2)}ms\n`);

  // 测试场景
  const testCases = [
    {
      name: '短文本（100字）',
      text: '这是一个测试文本，用于测试embedding生成的性能。我们会使用不同长度的文本来进行测试，以观察性能变化的趋势。这段文字大约有100个字符左右，可以模拟短文本的场景。在实际应用中，短文本可能包括短语、短句或者段落开头等。',
      length: '100 字'
    },
    {
      name: '中等文本（1000字）',
      text: '这是一个中等长度的测试文本，用于测试embedding生成的性能。我们会使用不同长度的文本来进行测试，以观察性能变化的趋势。在实际的应用场景中，中等长度的文本可能包括一个完整的段落、一个小节的内容，或者一段中等篇幅的描述。这种长度的文本在很多应用中都会出现，比如文章的段落、产品描述、用户评论等。测试这种长度可以帮助我们了解模型在常见文本长度下的性能表现，这对于优化用户体验和系统响应时间非常重要。我们会重复这段内容来达到预期的长度，这样可以确保测试的准确性和一致性。通过这种测试，我们可以更好地理解模型的性能特征，为系统设计和优化提供数据支持。',
      length: '1000 字'
    },
    {
      name: '长文本（5000字）',
      text: '这是一个长文本测试场景，我们会生成一段较长的文本用于测试embedding生成的性能。在实际的应用中，长文本可能包括整篇文章、长篇评论、文档内容等。测试长文本的性能对于理解模型的计算能力和资源消耗非常重要。我们会重复一些内容来达到5000字左右的长度，这样可以确保测试的准确性。在实际应用中，处理长文本时可能会遇到一些挑战，比如内存消耗增加、处理时间延长等。通过性能测试，我们可以了解模型在不同长度文本下的性能表现，为系统设计和优化提供数据支持。对于embedding模型来说，处理长文本时的性能表现是一个重要的指标，因为它直接影响到用户体验和系统的响应速度。如果处理时间过长，用户可能会感到等待时间过长，影响使用体验。因此，了解模型的性能特征，并根据实际应用场景选择合适的处理策略是非常重要的。在一些情况下，我们可能需要对长文本进行分段处理，以减少单个请求的处理时间。这需要在性能和准确性之间进行权衡。通过实际的性能测试，我们可以更好地理解这种权衡，并做出更明智的决策。此外，性能测试还可以帮助我们识别潜在的性能瓶颈，并指导我们进行针对性的优化。总的来说，embedding性能测试是系统开发和优化过程中不可或缺的一部分。'.repeat(5),
      length: '5000 字'
    }
  ];

  const iterations = 3;
  const results: any[] = [];

  for (const testCase of testCases) {
    console.log(`\n📊 测试场景: ${testCase.name}`);
    console.log(`   文本长度: ${testCase.length}`);
    console.log(`   测试次数: ${iterations}`);
    
    const times = await benchmarkEmbedding(testCase.text, iterations, embeddingPipeline);
    const stats = calculateStats(times);
    
    console.log(`\n   性能统计:`);
    console.log(`   平均耗时: ${stats.mean}ms`);
    console.log(`   最小耗时: ${stats.min}ms`);
    console.log(`   最大耗时: ${stats.max}ms`);
    console.log(`   中位数: ${stats.median}ms`);
    
    results.push({
      name: testCase.name,
      length: testCase.length,
      ...stats
    });
  }

  // 总结报告
  console.log('\n📈 性能测试总结:');
  console.log('═'.repeat(60));
  console.log(`场景           | 长度    | 平均  | 最小  | 最大  | 中位数`);
  console.log('-'.repeat(60));
  
  for (const result of results) {
    console.log(`${result.name.padEnd(14)} | ${result.length.padEnd(6)} | ${String(result.mean).padEnd(5)}ms | ${String(result.min).padEnd(5)}ms | ${String(result.max).padEnd(5)}ms | ${result.median}ms`);
  }
  
  console.log('-'.repeat(60));
  console.log(`模型加载时间: ${loadTime.toFixed(2)}ms`);
  console.log('═'.repeat(60));
  
  // 性能分析
  console.log('\n📊 性能分析:');
  console.log('1. 短文本 vs 长文本性能差异:');
  const shortTime = results[0].mean;
  const longTime = results[2].mean;
  const ratio = (longTime / shortTime).toFixed(2);
  console.log(`   长文本(5000字)是短文本(100字)的 ${ratio} 倍耗时`);
  
  console.log('2. 性能随长度增长趋势:');
  for (let i = 1; i < results.length; i++) {
    const prevTime = results[i - 1].mean;
    const currTime = results[i].mean;
    const growth = ((currTime - prevTime) / prevTime * 100).toFixed(1);
    console.log(`   ${results[i - 1].name} → ${results[i].name}: +${growth}%`);
  }
  
  console.log('3. 性能稳定性分析:');
  for (const result of results) {
    const stability = ((1 - (result.max - result.min) / result.mean) * 100).toFixed(1);
    console.log(`   ${result.name}: 稳定性 ${stability}%`);
  }
}

main().catch(console.error);