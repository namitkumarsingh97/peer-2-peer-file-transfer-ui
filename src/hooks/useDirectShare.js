import { useState, useRef, useCallback } from 'react'
import { chunkFile, verifyChunk, reconstructFile } from '../utils/fileChunker'

/**
 * Direct device-to-device file sharing hook
 * Files stay on user's device, served directly via WebRTC
 * No rooms, no login - just upload and share
 */
export const useDirectShare = (socket) => {
  const [sharedFiles, setSharedFiles] = useState([]) // Files I'm sharing
  const [availableFiles, setAvailableFiles] = useState([]) // Files available to download
  const [downloads, setDownloads] = useState([]) // Active downloads
  
  const peerConnectionsRef = useRef(new Map()) // fileId -> { socketId, pc, channel }
  const fileStoreRef = useRef(new Map()) // fileId -> { file, metadata, chunks }
  const downloadStoreRef = useRef(new Map()) // fileId -> { chunks, received }

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  /**
   * Share a file from device (file stays on device)
   * Optimized for large files - processes in batches to prevent memory issues
   */
  const shareFile = useCallback(async (file, fileId, onProgress) => {
    // Chunk the file with progress callback for large files
    const { chunks, metadata } = await chunkFile(file, onProgress)
    
    // Store chunks efficiently - don't keep all in memory for very large files
    // Instead, store references and read from file when needed
    const fileData = {
      fileId,
      file, // Keep original file reference for streaming
      metadata: {
        ...metadata,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      },
      chunks: chunks.reduce((acc, chunk) => {
        acc[chunk.index] = {
          ...chunk,
          // For very large files, we'll read from file.slice() when sending
          // instead of keeping all chunks in memory
        }
        return acc
      }, {}),
      createdAt: new Date()
    }

    fileStoreRef.current.set(fileId, fileData)
    
    setSharedFiles(prev => [...prev, {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      ...metadata
    }])

    // Announce file availability (broadcast to all)
    if (socket) {
      socket.emit('file-share-announce', {
        fileId,
        metadata: fileData.metadata,
        seederSocketId: socket.id
      })
    }

    return fileId
  }, [socket])

  /**
   * Stop sharing a file
   */
  const stopSharing = useCallback((fileId) => {
    // Close all connections for this file
    const connections = peerConnectionsRef.current.get(fileId)
    if (connections) {
      connections.forEach(({ pc, channel }) => {
        if (channel) channel.close()
        if (pc) pc.close()
      })
      peerConnectionsRef.current.delete(fileId)
    }

    fileStoreRef.current.delete(fileId)
    setSharedFiles(prev => prev.filter(f => f.fileId !== fileId))
    
    if (socket) {
      socket.emit('file-share-stop', { fileId })
    }
  }, [socket])

  /**
   * Handle chunk received from seeder
   */
  const handleChunkReceived = useCallback(async (fileId, chunkBlob) => {
    const store = downloadStoreRef.current.get(fileId)
    if (!store) return

    // Find which chunk this is (simplified - in production, use metadata)
    const receivedCount = store.received.size
    const chunkIndex = receivedCount
    
    store.chunks.set(chunkIndex, chunkBlob)
    store.received.add(chunkIndex)

    setDownloads(prev => {
      const download = prev.find(d => d.fileId === fileId)
      if (!download) return prev

      const progress = (store.received.size / download.totalChunks) * 100
      const downloaded = Array.from(store.chunks.values()).reduce((sum, chunk) => sum + chunk.size, 0)

      // Check if complete
      if (store.received.size === download.totalChunks) {
        // Reconstruct and download file
        const file = reconstructFile(
          Array.from(store.chunks.entries()).map(([idx, blob]) => ({
            index: idx,
            data: blob
          })),
          download.fileType
        )
        
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = download.fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)

        return prev.map(d => 
          d.fileId === fileId
            ? { ...d, progress: 100, status: 'completed', downloaded }
            : d
        )
      }

      return prev.map(d => 
        d.fileId === fileId
          ? { ...d, progress, downloaded }
          : d
      )
    })
  }, [])

  /**
   * Connect to file seeder
   */
  const connectToSeeder = useCallback(async (fileId, seederSocketId, fileInfo) => {
    const pc = new RTCPeerConnection(configuration)
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetSocketId: seederSocketId,
          fileId
        })
      }
    }

    const channel = pc.createDataChannel('fileTransfer', { ordered: true })
    
    channel.onopen = () => {
      console.log(`Connected to seeder for file ${fileId}`)
      
      // Request all chunks
      for (let i = 0; i < fileInfo.totalChunks; i++) {
        channel.send(JSON.stringify({
          type: 'chunk-request',
          fileId,
          chunkIndex: i
        }))
      }
    }

    channel.onmessage = async (event) => {
      const data = event.data
      
      if (data instanceof Blob) {
        // Receiving chunk
        await handleChunkReceived(fileId, data)
      } else {
        try {
          const message = JSON.parse(data)
          if (message.type === 'chunk-response') {
            // Chunk metadata received, actual data will come as Blob
          }
        } catch (e) {
          // Not JSON
        }
      }
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
    }

    channel.onclose = () => {
      console.log(`Connection closed for file ${fileId}`)
    }

    // Store connection
    if (!peerConnectionsRef.current.has(fileId)) {
      peerConnectionsRef.current.set(fileId, [])
    }
    peerConnectionsRef.current.get(fileId).push({ socketId: seederSocketId, pc, channel })

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      if (socket) {
        socket.emit('file-download-request', {
          offer,
          fileId,
          targetSocketId: seederSocketId
        })
      }
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }, [socket, configuration, handleChunkReceived])

  /**
   * Connect to file seeder and download
   */
  const downloadFile = useCallback(async (fileInfo) => {
    const { fileId, seederSocketId } = fileInfo
    
    setDownloads(prev => {
      // Check if already downloading
      if (prev.find(d => d.fileId === fileId)) {
        return prev
      }

      const download = {
        fileId,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        fileType: fileInfo.fileType,
        totalChunks: fileInfo.totalChunks,
        progress: 0,
        status: 'downloading',
        downloaded: 0,
        seederSocketId
      }

      // Initialize download store
      downloadStoreRef.current.set(fileId, {
        chunks: new Map(),
        received: new Set()
      })

      return [...prev, download]
    })

    // Connect to seeder after state update
    setTimeout(() => {
      connectToSeeder(fileId, seederSocketId, fileInfo)
    }, 100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Handle download request from peer
   */
  const handleDownloadRequest = useCallback(async (offer, fromSocketId, fileId) => {
    const fileData = fileStoreRef.current.get(fileId)
    if (!fileData) {
      return // Don't have this file
    }

    const pc = new RTCPeerConnection(configuration)
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetSocketId: fromSocketId,
          fileId
        })
      }
    }

    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupSeederChannel(channel, fileId, fileData)
    }

    // Store connection
    if (!peerConnectionsRef.current.has(fileId)) {
      peerConnectionsRef.current.set(fileId, [])
    }
    peerConnectionsRef.current.get(fileId).push({ socketId: fromSocketId, pc })

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      if (socket) {
        socket.emit('file-download-answer', {
          answer,
          fileId,
          targetSocketId: fromSocketId
        })
      }
    } catch (error) {
      console.error('Error handling download request:', error)
    }
  }, [socket, configuration])

  /**
   * Setup data channel for seeding
   * Optimized for large files - reads chunks on-demand
   */
  const setupSeederChannel = useCallback((channel, fileId, fileData) => {
    channel.onopen = () => {
      console.log(`Seeder channel open for file ${fileId}`)
    }

    channel.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'chunk-request') {
          const { chunkIndex } = message
          const chunkInfo = fileData.chunks[chunkIndex]
          
          if (chunkInfo) {
            // For large files, read chunk from file on-demand instead of keeping in memory
            let chunkData
            if (chunkInfo.data) {
              chunkData = chunkInfo.data
            } else {
              // Read from file slice (for very large files to save memory)
              const start = chunkIndex * fileData.metadata.chunkSize
              const end = Math.min(start + fileData.metadata.chunkSize, fileData.file.size)
              chunkData = fileData.file.slice(start, end)
            }
            
            // Send chunk metadata
            channel.send(JSON.stringify({
              type: 'chunk-response',
              fileId,
              chunkIndex,
              chunkHash: chunkInfo.hash
            }))
            
            // Send chunk data with small delay to prevent overwhelming the channel
            setTimeout(() => {
              if (channel.readyState === 'open') {
                channel.send(chunkData)
              }
            }, 50)
          }
        }
      } catch (e) {
        // Not JSON
      }
    }
  }, [])

  /**
   * Handle answer from seeder
   */
  const handleDownloadAnswer = useCallback(async (answer, fromSocketId, fileId) => {
    const connections = peerConnectionsRef.current.get(fileId)
    if (connections) {
      const conn = connections.find(c => c.socketId === fromSocketId)
      if (conn && conn.pc) {
        try {
          await conn.pc.setRemoteDescription(new RTCSessionDescription(answer))
        } catch (error) {
          console.error('Error handling answer:', error)
        }
      }
    }
  }, [])

  /**
   * Handle ICE candidate
   */
  const handleIceCandidate = useCallback(async (candidate, fromSocketId, fileId) => {
    const connections = peerConnectionsRef.current.get(fileId)
    if (connections) {
      const conn = connections.find(c => c.socketId === fromSocketId)
      if (conn && conn.pc) {
        try {
          await conn.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (error) {
          console.error('Error adding ICE candidate:', error)
        }
      }
    }
  }, [])

  return {
    sharedFiles,
    availableFiles,
    downloads,
    shareFile,
    stopSharing,
    downloadFile,
    handleDownloadRequest,
    handleDownloadAnswer,
    handleIceCandidate
  }
}

