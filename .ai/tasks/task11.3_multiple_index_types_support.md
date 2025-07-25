---
id: 11.3
title: 'Multiple Index Types Support'
status: pending
priority: high
feature: 'FAISS Vector Storage - Index Optimization'
dependencies:
  - 11.2
assigned_agent: null
created_at: "2025-07-25T08:23:54Z"
started_at: null
completed_at: null
error_log: null
---

## Description

實現多種FAISS索引類型支持 (IndexFlatIP, IndexIVF, IndexHNSW) 和自動索引選擇。優化不同規模數據集的性能。

## Details

### Index Types Overview
**IndexFlatIP (Flat Inner Product)**:
- Best for: Small datasets (<1,000 vectors)
- Characteristics: Exact search, high accuracy, O(n) complexity
- Use case: Development, small codebases

**IndexIVF (Inverted File)**:
- Best for: Medium datasets (1,000-100,000 vectors)  
- Characteristics: Approximate search, balanced speed/accuracy
- Use case: Medium-sized projects

**IndexHNSW (Hierarchical Navigable Small World)**:
- Best for: Large datasets (>100,000 vectors)
- Characteristics: Very fast search, good accuracy
- Use case: Large codebases, enterprise projects

### Implementation Strategy
```typescript
export class FAISSVectorStorage {
  private indexType: 'Flat' | 'IVF' | 'HNSW';
  
  constructor(dimension: number = 768, indexType?: 'Flat' | 'IVF' | 'HNSW') {
    this.indexType = indexType || this.selectOptimalIndexType(0);
  }
  
  private selectOptimalIndexType(vectorCount: number): 'Flat' | 'IVF' | 'HNSW'
  private createIndex(): faiss.Index
  async trainIndex(trainingVectors: number[][]): Promise<void> // For IVF
}
```

### Implementation Steps
- [ ] **Extend Index Type Support**:
  ```typescript
  private createIndex(): faiss.Index {
    switch (this.indexType) {
      case 'Flat':
        return new faiss.IndexFlatIP(this.dimension);
      case 'IVF':
        const quantizer = new faiss.IndexFlatIP(this.dimension);
        const nlist = Math.min(100, Math.max(1, Math.sqrt(this.vectorCount)));
        return new faiss.IndexIVFFlat(quantizer, this.dimension, nlist);
      case 'HNSW':
        const M = 16; // Number of bi-directional links
        return new faiss.IndexHNSWFlat(this.dimension, M);
    }
  }
  ```

- [ ] **Implement Automatic Index Selection**:
  ```typescript
  private selectOptimalIndexType(vectorCount: number): 'Flat' | 'IVF' | 'HNSW' {
    if (vectorCount < 1000) return 'Flat';
    if (vectorCount < 100000) return 'IVF';
    return 'HNSW';
  }
  ```

- [ ] **Add Index Training Support**:
  ```typescript
  async trainIndex(trainingVectors: number[][]): Promise<void> {
    if (this.indexType !== 'IVF') return; // Only IVF needs training
    
    const vectorData = this.convertToFloat32Array(trainingVectors);
    this.index.train(vectorData);
    console.log(`IVF index trained with ${trainingVectors.length} vectors`);
  }
  ```

- [ ] **Implement Dynamic Index Switching**:
  ```typescript
  async optimizeForVectorCount(newVectorCount: number): Promise<void> {
    const optimalType = this.selectOptimalIndexType(newVectorCount);
    if (optimalType !== this.indexType) {
      await this.switchIndexType(optimalType);
    }
  }
  ```

- [ ] **Add Configuration Options**:
  ```typescript
  interface FAISSConfig {
    indexType?: 'Flat' | 'IVF' | 'HNSW';
    autoOptimize?: boolean;
    ivfConfig?: { nlist?: number };
    hnswConfig?: { M?: number; efConstruction?: number };
  }
  ```

### Index-Specific Optimizations
**IVF Configuration**:
- `nlist`: Number of clusters (√vectorCount is good default)
- Training requirement: Need representative vectors for clustering
- Memory vs speed tradeoff

**HNSW Configuration**:
- `M`: Connectivity (16 is good default, higher = more memory + accuracy)
- `efConstruction`: Search scope during construction (200-800)
- `efSearch`: Search scope during query (can be adjusted per query)

### Performance Characteristics
| Index Type | Vector Count | Search Time | Memory Usage | Accuracy |
|------------|-------------|-------------|--------------|----------|
| Flat       | <1,000      | ~1ms        | Low          | 100%     |
| IVF        | 1K-100K     | ~2-5ms      | Medium       | 95-99%   |
| HNSW       | >100K       | ~1-3ms      | High         | 95-98%   |

## Test Strategy

### Index Type Validation Tests
1. **Flat Index Test**:
   ```typescript
   test('Flat index for small datasets', async () => {
     const storage = new FAISSVectorStorage(768, 'Flat');
     await storage.initialize();
     
     const vectors = generateTestVectors(500, 768);
     await storage.addVectors(vectors, generateMetadata(500));
     
     const results = await storage.searchSimilar(vectors[0], 5);
     expect(results[0].similarity).toBeGreaterThan(0.99);
   });
   ```

2. **IVF Index Test**:
   ```typescript
   test('IVF index for medium datasets', async () => {
     const storage = new FAISSVectorStorage(768, 'IVF');
     await storage.initialize();
     
     const vectors = generateTestVectors(5000, 768);
     await storage.trainIndex(vectors.slice(0, 1000)); // Training subset
     await storage.addVectors(vectors, generateMetadata(5000));
     
     const results = await storage.searchSimilar(vectors[0], 5);
     expect(results[0].similarity).toBeGreaterThan(0.95);
   });
   ```

3. **HNSW Index Test**:
   ```typescript
   test('HNSW index for large datasets', async () => {
     const storage = new FAISSVectorStorage(768, 'HNSW');
     await storage.initialize();
     
     const vectors = generateTestVectors(50000, 768);
     await storage.addVectors(vectors, generateMetadata(50000));
     
     const startTime = Date.now();
     const results = await storage.searchSimilar(vectors[0], 5);
     const searchTime = Date.now() - startTime;
     
     expect(searchTime).toBeLessThan(10); // <10ms for large dataset
     expect(results[0].similarity).toBeGreaterThan(0.9);
   });
   ```

### Automatic Selection Tests
4. **Auto Index Selection Test**:
   ```typescript
   test('Automatic index type selection', () => {
     expect(selectOptimalIndexType(500)).toBe('Flat');
     expect(selectOptimalIndexType(5000)).toBe('IVF');
     expect(selectOptimalIndexType(150000)).toBe('HNSW');
   });
   ```

### Performance Benchmark Tests
5. **Performance Comparison Test**:
   ```typescript
   test('Performance comparison across index types', async () => {
     const vectorSizes = [1000, 10000, 50000];
     const results = {};
     
     for (const size of vectorSizes) {
       for (const indexType of ['Flat', 'IVF', 'HNSW']) {
         const timeResult = await benchmarkIndexType(indexType, size);
         results[`${indexType}_${size}`] = timeResult;
       }
     }
     
     // Verify performance expectations
     expect(results['HNSW_50000']).toBeLessThan(results['Flat_50000']);
   });
   ```

### Success Criteria
- [ ] All three index types (Flat, IVF, HNSW) implemented and working
- [ ] Automatic index selection based on vector count
- [ ] IVF index training functionality working
- [ ] Performance benchmarks meet expectations for each index type
- [ ] Dynamic index switching capability (optional)
- [ ] Configuration options for index-specific parameters
- [ ] Comprehensive test coverage for all index types

## Notes

**Performance Goals**:
- Flat: Exact results, <5ms for <1K vectors
- IVF: >95% accuracy, <10ms for 10K vectors  
- HNSW: >90% accuracy, <5ms for 100K+ vectors

**Memory Considerations**: HNSW uses more memory but provides faster searches
**Training Requirements**: IVF requires training phase with representative data
**Fallback Strategy**: If advanced index fails, fall back to Flat index 