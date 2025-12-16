import { useState, useRef, useCallback } from 'react'
import { chunkFile, verifyChunk, reconstructFile, CHUNK_SIZE } from '../utils/fileChunker'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB limit

/**
 * Torrent-like file sharing hook
 * Supports multiple peers, chunk-based downloads, and parallel transfers
 */
export const useTorrent = (socket, roomId, username) => {
  const [availableFiles, setAvailableFiles] = useState([]) // Files available in the room
  const [myFiles, setMyFiles] = useState([]) // Files I'm sharing (seeding)
  const [downloads, setDownloads] = useState([]) // Active downloads
  const [peers, setPeers] = useState(new Map()) // Connected peers with their data channels
  
  const peerConnectionsRef = useRef(new Map()) // socketId -> RTCPeerConnection
  const dataChannelsRef = useRef(new Map()) // socketId -> RTCDataChannel
  const fileMetadataRef = useRef(new Map()) // fileHash -> metadata
  const chunkStoreRef = useRef(new Map()) // fileHash -> { chunks: Map<index, chunk>, received: Set<index> }
  const seedingFilesRef = useRef(new Map()) // fileHash -> { metadata, chunks }

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  /**
   * Create peer connection for a specific peer
   */
  const createPeerConnection = useCallback((targetSocketId) => {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return peerConnectionsRef.current.get(targetSocketId)
    }

    const pc = new RTCPeerConnection(configuration)
    
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetSocketId
        })
      }
    }

    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupDataChannel(channel, targetSocketId)
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        peerConnectionsRef.current.delete(targetSocketId)
        dataChannelsRef.current.delete(targetSocketId)
        setPeers(prev => {
          const newPeers = new Map(prev)
          newPeers.delete(targetSocketId)
          return newPeers
        })
      }
    }

    peerConnectionsRef.current.set(targetSocketId, pc)
    return pc
  }, [socket, configuration])

  /**
   * Setup data channel for peer communication
   */
  const setupDataChannel = useCallback((channel, socketId) => {
    channel.onopen = () => {
      console.log(`Data channel opened with peer ${socketId}`)
      setPeers(prev => {
        const newPeers = new Map(prev)
        newPeers.set(socketId, { socketId, connected: true, channel })
        return newPeers
      })
      dataChannelsRef.current.set(socketId, channel)
      
      // Announce available files to new peer
      seedingFilesRef.current.forEach((fileData, fileHash) => {
        sendMessage(socketId, {
          type: 'file-announce',
          metadata: fileData.metadata
        })
      })
    }

    channel.onclose = () => {
      console.log(`Data channel closed with peer ${socketId}`)
      setPeers(prev => {
        const newPeers = new Map(prev)
        newPeers.delete(socketId)
        return newPeers
      })
      dataChannelsRef.current.delete(socketId)
    }

    channel.onerror = (error) => {
      console.error(`Data channel error with peer ${socketId}:`, error)
    }

    channel.onmessage = async (event) => {
      const data = event.data
      
      // Handle Blob data (chunk)
      if (data instanceof Blob) {
        const chunkStore = chunkStoreRef.current.get('receiving')
        if (chunkStore) {
          const reader = new FileReader()
          reader.onload = async (e) => {
            const chunkBlob = new Blob([e.target.result])
            const chunkInfo = chunkStore.pendingChunks?.get(socketId)
            if (chunkInfo) {
              const { fileHash, chunkIndex, chunkHash } = chunkInfo
              
              // Verify chunk
              const isValid = await verifyChunk(chunkBlob, chunkHash)
              if (isValid) {
                // Store chunk
                const store = chunkStoreRef.current.get(fileHash)
                if (store) {
                  store.chunks.set(chunkIndex, chunkBlob)
                  store.received.add(chunkIndex)
                  
                  // Update download progress
                  setDownloads(prev => prev.map(download => {
                    if (download.fileHash === fileHash) {
                      const progress = (store.received.size / download.totalChunks) * 100
                      const receivedChunks = new Map(download.receivedChunks)
                      receivedChunks.set(chunkIndex, chunkBlob)
                      
                      // Check if download is complete
                      if (store.received.size === download.totalChunks) {
                        // Reconstruct file
                        const file = reconstructFile(
                          Array.from(store.chunks.entries()).map(([idx, blob]) => ({
                            index: idx,
                            data: blob
                          })),
                          download.fileType
                        )
                        
                        // Download file
                        const url = URL.createObjectURL(file)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = download.fileName
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                        
                        return {
                          ...download,
                          progress: 100,
                          status: 'completed',
                          receivedChunks
                        }
                      }
                      
                      return {
                        ...download,
                        progress,
                        receivedChunks
                      }
                    }
                    return download
                  }))
                }
              } else {
                console.error(`Chunk ${chunkIndex} verification failed`)
                // Request chunk again
                sendMessage(socketId, {
                  type: 'chunk-request',
                  fileHash,
                  chunkIndex
                })
              }
              
              // Clear pending chunk
              chunkStore.pendingChunks?.delete(socketId)
            }
          }
          reader.readAsArrayBuffer(data)
        }
        return
      }
      
      // Handle JSON messages
      await handlePeerMessage(data, socketId)
    }
  }, [])

  /**
   * Send message to peer
   */
  const sendMessage = useCallback((socketId, message) => {
    const channel = dataChannelsRef.current.get(socketId)
    if (channel && channel.readyState === 'open') {
      channel.send(JSON.stringify(message))
    }
  }, [])

  /**
   * Handle messages from peers
   */
  const handlePeerMessage = useCallback(async (data, socketId) => {
    try {
      if (data instanceof Blob) {
        // Receiving chunk data
        const chunkInfo = chunkStoreRef.current.get('receiving')
        if (chunkInfo) {
          const reader = new FileReader()
          reader.onload = async (e) => {
            const chunkData = e.target.result
            // Handle chunk data
            console.log('Received chunk data from', socketId)
          }
          reader.readAsArrayBuffer(data)
        }
        return
      }

      const message = JSON.parse(data)
      
      switch (message.type) {
        case 'file-announce':
          // Peer is announcing a file they have
          handleFileAnnounce(message.metadata, socketId)
          break
          
        case 'chunk-request':
          // Peer is requesting a chunk
          handleChunkRequest(message, socketId)
          break
          
        case 'chunk-response':
          // Peer is sending a chunk
          handleChunkResponse(message, socketId)
          break
          
        case 'have-chunk':
          // Peer has a specific chunk
          handleHaveChunk(message, socketId)
          break
          
        default:
          console.log('Unknown message type:', message.type)
      }
    } catch (error) {
      console.error('Error handling peer message:', error)
    }
  }, [])

  /**
   * Handle file announcement from peer
   */
  const handleFileAnnounce = useCallback((metadata, socketId) => {
    setAvailableFiles(prev => {
      const exists = prev.find(f => f.fileHash === metadata.fileHash)
      if (exists) {
        // Add peer to existing file
        if (!exists.peers.includes(socketId)) {
          exists.peers.push(socketId)
        }
        return [...prev]
      }
      // New file
      return [...prev, {
        ...metadata,
        peers: [socketId],
        availableChunks: new Set() // Will be populated as peers announce chunks
      }]
    })
  }, [])

  /**
   * Handle chunk request from peer
   */
  const handleChunkRequest = useCallback(async ({ fileHash, chunkIndex }, socketId) => {
    const fileData = seedingFilesRef.current.get(fileHash)
    if (!fileData) {
      return // Don't have this file
    }

    const chunk = fileData.chunks[chunkIndex]
    if (!chunk) {
      return // Don't have this chunk
    }

    // Send chunk metadata first
    sendMessage(socketId, {
      type: 'chunk-response',
      fileHash,
      chunkIndex,
      chunkHash: chunk.hash
    })

    // Small delay to ensure metadata is received first
    setTimeout(() => {
      // Send chunk data
      const channel = dataChannelsRef.current.get(socketId)
      if (channel && channel.readyState === 'open') {
        // Store pending chunk info for receiver
        let chunkStore = chunkStoreRef.current.get('receiving')
        if (!chunkStore) {
          chunkStore = { pendingChunks: new Map() }
          chunkStoreRef.current.set('receiving', chunkStore)
        }
        chunkStore.pendingChunks.set(socketId, {
          fileHash,
          chunkIndex,
          chunkHash: chunk.hash
        })
        
        channel.send(chunk.data)
      }
    }, 50)
  }, [sendMessage])

  /**
   * Handle chunk response from peer
   */
  const handleChunkResponse = useCallback(async ({ fileHash, chunkIndex, chunkHash }, socketId) => {
    // Chunk data will come as Blob in onmessage handler
    // This is just metadata - actual data handling is in setupDataChannel
  }, [])

  /**
   * Handle "have chunk" message
   */
  const handleHaveChunk = useCallback(({ fileHash, chunkIndex }, socketId) => {
    setAvailableFiles(prev => prev.map(file => {
      if (file.fileHash === fileHash) {
        file.availableChunks.add(chunkIndex)
        if (!file.peers.includes(socketId)) {
          file.peers.push(socketId)
        }
      }
      return file
    }))
  }, [])

  /**
   * Share a file (start seeding)
   */
  const shareFile = useCallback(async (file) => {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    const { chunks, metadata } = await chunkFile(file)
    
    seedingFilesRef.current.set(metadata.fileHash, {
      metadata,
      chunks: chunks.reduce((acc, chunk) => {
        acc[chunk.index] = chunk
        return acc
      }, {})
    })

    setMyFiles(prev => [...prev, {
      ...metadata,
      originalFile: file
    }])

    // Announce file to all connected peers
    dataChannelsRef.current.forEach((channel, socketId) => {
      if (channel.readyState === 'open') {
        sendMessage(socketId, {
          type: 'file-announce',
          metadata
        })
      }
    })

    // Also announce via socket for peers not yet connected
    if (socket) {
      socket.emit('file-announce', {
        roomId,
        metadata
      })
    }

    return metadata
  }, [socket, roomId, sendMessage])

  /**
   * Download a file from peers
   */
  const downloadFile = useCallback(async (fileMetadata) => {
    const downloadId = `${fileMetadata.fileHash}-${Date.now()}`
    
    const download = {
      id: downloadId,
      fileName: fileMetadata.fileName,
      fileHash: fileMetadata.fileHash,
      fileSize: fileMetadata.fileSize,
      fileType: fileMetadata.fileType,
      totalChunks: fileMetadata.totalChunks,
      receivedChunks: new Map(),
      progress: 0,
      status: 'downloading',
      peers: fileMetadata.peers || []
    }

    setDownloads(prev => [...prev, download])

    // Initialize chunk store
    chunkStoreRef.current.set(fileMetadata.fileHash, {
      chunks: new Map(),
      received: new Set(),
      metadata: fileMetadata
    })

    // Initialize receiving store
    if (!chunkStoreRef.current.has('receiving')) {
      chunkStoreRef.current.set('receiving', { pendingChunks: new Map() })
    }

    // Request chunks from available peers
    const peersWithFile = fileMetadata.peers || []
    if (peersWithFile.length === 0) {
      console.warn('No peers available for download')
      return downloadId
    }

    // Distribute chunks across peers for parallel download
    peersWithFile.forEach((peerSocketId, peerIndex) => {
      // Connect to peer if not already connected
      const channel = dataChannelsRef.current.get(peerSocketId)
      if (!channel || channel.readyState !== 'open') {
        connectToPeer(peerSocketId)
        // Wait a bit for connection
        setTimeout(() => {
          requestChunksFromPeer(peerSocketId, fileMetadata, peerIndex, peersWithFile.length)
        }, 500)
      } else {
        requestChunksFromPeer(peerSocketId, fileMetadata, peerIndex, peersWithFile.length)
      }
    })

    return downloadId
  }, [sendMessage, connectToPeer])

  /**
   * Request chunks from a specific peer
   */
  const requestChunksFromPeer = useCallback((peerSocketId, fileMetadata, peerIndex, totalPeers) => {
    for (let i = peerIndex; i < fileMetadata.totalChunks; i += totalPeers) {
      sendMessage(peerSocketId, {
        type: 'chunk-request',
        fileHash: fileMetadata.fileHash,
        chunkIndex: i
      })
    }
  }, [sendMessage])

  /**
   * Connect to a peer
   */
  const connectToPeer = useCallback(async (targetSocketId) => {
    if (peerConnectionsRef.current.has(targetSocketId)) {
      return // Already connected
    }

    const pc = createPeerConnection(targetSocketId)
    
    // Create data channel
    const channel = pc.createDataChannel('torrent', { ordered: true })
    setupDataChannel(channel, targetSocketId)

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      
      if (socket) {
        socket.emit('offer', {
          offer,
          roomId,
          targetSocketId
        })
      }
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }, [socket, roomId, createPeerConnection, setupDataChannel])

  /**
   * Handle offer from peer
   */
  const handleOffer = useCallback(async (offer, fromSocketId) => {
    const pc = createPeerConnection(fromSocketId)
    
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      
      if (socket) {
        socket.emit('answer', {
          answer,
          roomId,
          targetSocketId: fromSocketId
        })
      }
    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }, [socket, roomId, createPeerConnection])

  /**
   * Handle answer from peer
   */
  const handleAnswer = useCallback(async (answer, fromSocketId) => {
    const pc = peerConnectionsRef.current.get(fromSocketId)
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (error) {
        console.error('Error handling answer:', error)
      }
    }
  }, [])

  /**
   * Handle ICE candidate
   */
  const handleIceCandidate = useCallback(async (candidate, fromSocketId) => {
    const pc = peerConnectionsRef.current.get(fromSocketId)
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    }
  }, [])

  /**
   * Disconnect from peer
   */
  const disconnectFromPeer = useCallback((socketId) => {
    const pc = peerConnectionsRef.current.get(socketId)
    if (pc) {
      pc.close()
      peerConnectionsRef.current.delete(socketId)
    }
    
    const channel = dataChannelsRef.current.get(socketId)
    if (channel) {
      channel.close()
      dataChannelsRef.current.delete(socketId)
    }
    
    setPeers(prev => {
      const newPeers = new Map(prev)
      newPeers.delete(socketId)
      return newPeers
    })
  }, [])

  return {
    availableFiles,
    myFiles,
    downloads,
    peers: Array.from(peers.values()),
    shareFile,
    downloadFile,
    connectToPeer,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    disconnectFromPeer,
    MAX_FILE_SIZE
  }
}

