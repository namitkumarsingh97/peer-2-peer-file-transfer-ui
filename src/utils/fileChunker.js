// File chunking utilities for torrent-like functionality
// Optimized for large files - streams chunks instead of loading entire file

const CHUNK_SIZE = 256 * 1024 // 256KB chunks (optimized for large files)

/**
 * Calculate SHA-256 hash of a chunk
 */
export const hashChunk = async (chunk) => {
  const buffer = await chunk.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

/**
 * Split file into chunks and create metadata
 * Optimized for large files - processes chunks incrementally to avoid memory issues
 */
export const chunkFile = async (file, onProgress) => {
  const chunks = []
  const chunkHashes = []
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  
  // Process chunks in batches to avoid memory overload
  const BATCH_SIZE = 10 // Process 10 chunks at a time
  
  for (let batchStart = 0; batchStart < totalChunks; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, totalChunks)
    const batchPromises = []
    
    for (let i = batchStart; i < batchEnd; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)
      
      // Process chunk asynchronously
      batchPromises.push(
        hashChunk(chunk).then(hash => ({
          index: i,
          data: chunk,
          hash,
          size: chunk.size,
          start,
          end
        }))
      )
    }
    
    // Wait for batch to complete
    const batchResults = await Promise.all(batchPromises)
    chunks.push(...batchResults)
    chunkHashes.push(...batchResults.map(r => r.hash))
    
    // Report progress
    if (onProgress) {
      onProgress((batchEnd / totalChunks) * 100)
    }
    
    // Small delay to prevent UI blocking
    if (batchEnd < totalChunks) {
      await new Promise(resolve => setTimeout(resolve, 10))
    }
  }
  
  // Create file metadata (like .torrent file)
  const fileHash = await hashChunk(
    new Blob(chunkHashes.map(h => new TextEncoder().encode(h)))
  )
  
  return {
    chunks,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      fileHash,
      chunkHashes,
      totalChunks,
      chunkSize: CHUNK_SIZE
    }
  }
}

/**
 * Verify chunk integrity
 */
export const verifyChunk = async (chunk, expectedHash) => {
  const hash = await hashChunk(chunk)
  return hash === expectedHash
}

/**
 * Reconstruct file from chunks
 */
export const reconstructFile = (chunks, fileType) => {
  // Sort chunks by index
  const sortedChunks = chunks.sort((a, b) => a.index - b.index)
  const blobParts = sortedChunks.map(chunk => chunk.data)
  return new Blob(blobParts, { type: fileType })
}

export { CHUNK_SIZE }

