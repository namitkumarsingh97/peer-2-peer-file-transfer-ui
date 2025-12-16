import { useRef, useEffect, useState, useCallback } from 'react'

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB limit

export const useWebRTC = (socket, roomId, username) => {
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const [fileTransferProgress, setFileTransferProgress] = useState(0)
  const [currentFile, setCurrentFile] = useState(null)
  
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const dataChannelRef = useRef(null)
  const fileChunksRef = useRef([])
  const receivedFileInfoRef = useRef(null)

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(configuration)
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit('ice-candidate', {
          candidate: event.candidate,
          targetSocketId: socket.targetSocketId
        })
      }
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        setRemoteStream(event.streams[0])
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0]
        }
      }
    }

    // Handle data channel
    pc.ondatachannel = (event) => {
      const channel = event.channel
      setupDataChannel(channel)
    }

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      setConnectionStatus(state)
      setIsConnected(state === 'connected')
    }

    return pc
  }, [socket])

  const setupDataChannel = useCallback((channel) => {
    channel.onopen = () => {
      console.log('Data channel opened')
      setConnectionStatus('connected')
      setIsConnected(true)
    }

    channel.onclose = () => {
      console.log('Data channel closed')
      setConnectionStatus('disconnected')
      setIsConnected(false)
    }

    channel.onerror = (error) => {
      console.error('Data channel error:', error)
    }

    channel.onmessage = (event) => {
      const data = event.data
      
      if (data instanceof Blob) {
        // Receiving file chunk
        fileChunksRef.current.push(data)
        const progress = (fileChunksRef.current.length / (receivedFileInfoRef.current?.totalChunks || 1)) * 100
        setFileTransferProgress(Math.min(progress, 100))
        
        if (socket) {
          socket.emit('file-progress', {
            targetSocketId: socket.targetSocketId,
            progress,
            fileName: receivedFileInfoRef.current?.fileName
          })
        }
      } else {
        try {
          const message = JSON.parse(data)
          
          if (message.type === 'file-start') {
            // Start receiving file
            receivedFileInfoRef.current = {
              fileName: message.fileName,
              fileSize: message.fileSize,
              fileType: message.fileType,
              totalChunks: message.totalChunks
            }
            fileChunksRef.current = []
            setCurrentFile({
              name: message.fileName,
              size: message.fileSize,
              type: message.fileType
            })
            setFileTransferProgress(0)
          } else if (message.type === 'file-end') {
            // File transfer complete
            const blob = new Blob(fileChunksRef.current, { type: receivedFileInfoRef.current.fileType })
            downloadFile(blob, receivedFileInfoRef.current.fileName)
            fileChunksRef.current = []
            receivedFileInfoRef.current = null
            setFileTransferProgress(100)
            
            setTimeout(() => {
              setFileTransferProgress(0)
              setCurrentFile(null)
            }, 2000)
          }
        } catch (e) {
          // Not JSON, might be text message
          console.log('Received message:', data)
        }
      }
    }

    dataChannelRef.current = channel
  }, [socket])

  const downloadFile = (blob, fileName) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const createDataChannel = useCallback(() => {
    if (peerConnectionRef.current && !dataChannelRef.current) {
      const channel = peerConnectionRef.current.createDataChannel('fileTransfer', {
        ordered: true
      })
      setupDataChannel(channel)
    }
  }, [setupDataChannel])

  const initiateConnection = useCallback(async (targetSocketId) => {
    if (!socket || !targetSocketId) return

    socket.targetSocketId = targetSocketId
    peerConnectionRef.current = createPeerConnection()
    createDataChannel()

    try {
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)
      
      socket.emit('offer', {
        offer,
        roomId,
        targetSocketId
      })
    } catch (error) {
      console.error('Error creating offer:', error)
    }
  }, [socket, roomId, createPeerConnection, createDataChannel])

  const handleOffer = useCallback(async (offer, fromSocketId) => {
    if (!socket) return

    socket.targetSocketId = fromSocketId
    peerConnectionRef.current = createPeerConnection()

    try {
      await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await peerConnectionRef.current.createAnswer()
      await peerConnectionRef.current.setLocalDescription(answer)
      
      socket.emit('answer', {
        answer,
        roomId,
        targetSocketId: fromSocketId
      })
    } catch (error) {
      console.error('Error handling offer:', error)
    }
  }, [socket, roomId, createPeerConnection])

  const handleAnswer = useCallback(async (answer) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
      } catch (error) {
        console.error('Error handling answer:', error)
      }
    }
  }, [])

  const handleIceCandidate = useCallback(async (candidate) => {
    if (peerConnectionRef.current) {
      try {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (error) {
        console.error('Error adding ICE candidate:', error)
      }
    }
  }, [])

  const sendFile = useCallback(async (file) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      throw new Error('Data channel not ready')
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    const chunkSize = 16 * 1024 // 16KB chunks
    const totalChunks = Math.ceil(file.size / chunkSize)

    // Send file metadata
    const metadata = {
      type: 'file-start',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      totalChunks
    }

    dataChannelRef.current.send(JSON.stringify(metadata))
    
    if (socket) {
      socket.emit('file-metadata', {
        roomId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        targetSocketId: socket.targetSocketId
      })
    }

    setCurrentFile({
      name: file.name,
      size: file.size,
      type: file.type
    })
    setFileTransferProgress(0)

    // Send file in chunks
    let offset = 0
    let chunkIndex = 0

    while (offset < file.size) {
      const chunk = file.slice(offset, offset + chunkSize)
      dataChannelRef.current.send(chunk)
      
      offset += chunkSize
      chunkIndex++
      
      const progress = (chunkIndex / totalChunks) * 100
      setFileTransferProgress(Math.min(progress, 100))
      
      if (socket) {
        socket.emit('file-progress', {
          targetSocketId: socket.targetSocketId,
          progress,
          fileName: file.name
        })
      }

      // Small delay to prevent overwhelming the channel
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // Send file end marker
    dataChannelRef.current.send(JSON.stringify({ type: 'file-end' }))
    
    if (socket) {
      socket.emit('file-complete', {
        targetSocketId: socket.targetSocketId,
        fileName: file.name
      })
    }

    setTimeout(() => {
      setFileTransferProgress(0)
      setCurrentFile(null)
    }, 2000)
  }, [dataChannelRef, socket, roomId])

  const disconnect = useCallback(() => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    setLocalStream(null)
    setRemoteStream(null)
    setIsConnected(false)
    setConnectionStatus('disconnected')
    fileChunksRef.current = []
    receivedFileInfoRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return {
    localStream,
    remoteStream,
    isConnected,
    connectionStatus,
    fileTransferProgress,
    currentFile,
    localVideoRef,
    remoteVideoRef,
    initiateConnection,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    sendFile,
    disconnect,
    MAX_FILE_SIZE
  }
}

