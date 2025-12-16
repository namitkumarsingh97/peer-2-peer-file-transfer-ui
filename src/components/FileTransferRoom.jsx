import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useWebRTC } from '../hooks/useWebRTC'
import { useTorrent } from '../hooks/useTorrent'
import ChatPanel from './ChatPanel'
import FileTransferPanel from './FileTransferPanel'
import TorrentPanel from './TorrentPanel'
import ConnectionStatus from './ConnectionStatus'
import RoomManager from './RoomManager'

const FileTransferRoom = ({ user, onLogout }) => {
  const [roomId, setRoomId] = useState('')
  const [socket, setSocket] = useState(null)
  const [roomUsers, setRoomUsers] = useState([])
  const [targetUser, setTargetUser] = useState(null)
  const [error, setError] = useState('')
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState('torrent') // 'direct' or 'torrent'
  const fileInputRef = useRef(null)
  const torrentFileInputRef = useRef(null)
  const currentRoomRef = useRef('')
  const isJoiningRoomRef = useRef(false)

  const {
    isConnected,
    connectionStatus,
    fileTransferProgress,
    currentFile,
    initiateConnection,
    handleOffer: handleWebRTCOffer,
    handleAnswer: handleWebRTCAnswer,
    handleIceCandidate: handleWebRTCIceCandidate,
    sendFile,
    disconnect,
    MAX_FILE_SIZE
  } = useWebRTC(socket, roomId, user.username)

  const {
    availableFiles,
    myFiles,
    downloads,
    peers,
    shareFile,
    downloadFile,
    connectToPeer,
    handleOffer: handleTorrentOffer,
    handleAnswer: handleTorrentAnswer,
    handleIceCandidate: handleTorrentIceCandidate,
    disconnectFromPeer,
    MAX_FILE_SIZE: TORRENT_MAX_FILE_SIZE
  } = useTorrent(socket, roomId, user.username)

  // Initialize socket connection
  useEffect(() => {
    // Connect to signaling server
    const newSocket = io('http://localhost:3001', {
      auth: {
        username: user.username,
        token: 'dummy-token' // In production, use proper JWT
      }
    })

    newSocket.on('connect', () => {
      console.log('Connected to signaling server')
      // Join room after socket connects
      const savedRoomId = localStorage.getItem('roomId')
      const initialRoomId = savedRoomId || `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      if (!savedRoomId) {
        localStorage.setItem('roomId', initialRoomId)
      }
      
      currentRoomRef.current = initialRoomId
      setRoomId(initialRoomId)
      newSocket.emit('join-room', { roomId: initialRoomId, username: user.username })
    })

    newSocket.on('room-users', (users) => {
      const otherUsers = users.filter(u => u.socketId !== newSocket.id)
      setRoomUsers(otherUsers)
      console.log(`Users in room: ${otherUsers.map(u => u.username).join(', ') || 'None'}`)
    })

    newSocket.on('user-joined', ({ username, socketId }) => {
      console.log(`User ${username} joined`)
    })

    newSocket.on('user-left', ({ username }) => {
      console.log(`User ${username} left`)
      setTargetUser(prev => {
        if (prev?.username === username) {
          disconnect()
          return null
        }
        return prev
      })
    })

    // WebRTC signaling handlers
    newSocket.on('offer', ({ offer, fromSocketId, fromUsername }) => {
      handleOffer(offer, fromSocketId)
      setTargetUser({ socketId: fromSocketId, username: fromUsername })
    })

    newSocket.on('answer', ({ answer }) => {
      handleAnswer(answer)
    })

    newSocket.on('ice-candidate', ({ candidate }) => {
      handleIceCandidate(candidate)
    })

    // Chat handlers
    newSocket.on('chat-message', ({ message, username, timestamp }) => {
      setMessages(prev => [...prev, { message, username, timestamp }])
    })

    // File metadata handler
    newSocket.on('file-metadata', ({ fileName, fileSize, fileType, fromSocketId, fromUsername }) => {
      setTargetUser({ socketId: fromSocketId, username: fromUsername })
      // File metadata received, ready to receive
    })

    newSocket.on('file-progress', ({ progress, fileName }) => {
      // Progress updates handled by useWebRTC hook
    })

    newSocket.on('file-complete', ({ fileName }) => {
      console.log(`File transfer complete: ${fileName}`)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from signaling server')
    })

    setSocket(newSocket)

    return () => {
      disconnect()
      if (newSocket.connected) {
        const currentRoomId = localStorage.getItem('roomId')
        if (currentRoomId) {
          newSocket.emit('leave-room', { roomId: currentRoomId })
        }
        newSocket.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.username])

  // Handle room changes
  useEffect(() => {
    // Prevent infinite loops - only join if room actually changed and socket is ready
    if (!socket || !socket.connected || !roomId) {
      return
    }
    
    // Skip if already in this room or currently joining
    if (roomId === currentRoomRef.current || isJoiningRoomRef.current) {
      return
    }
    
    isJoiningRoomRef.current = true
    console.log(`Joining room: ${roomId} (previous: ${currentRoomRef.current})`)
    
    // Leave previous room if exists
    const previousRoomId = currentRoomRef.current
    if (previousRoomId && previousRoomId !== roomId) {
      socket.emit('leave-room', { roomId: previousRoomId })
    }
    
    // Clear previous state when joining new room
    setRoomUsers([])
    setTargetUser(null)
    setMessages([])
    
    // Disconnect existing WebRTC connection
    try {
      disconnect()
    } catch (e) {
      console.log('Disconnect error (expected if no connection):', e)
    }
    
    // Join new room after a brief delay
    const timeoutId = setTimeout(() => {
      if (socket && socket.connected && roomId === currentRoomRef.current || roomId) {
        socket.emit('join-room', { roomId, username: user.username })
        localStorage.setItem('roomId', roomId)
        currentRoomRef.current = roomId
        console.log(`Successfully joined room: ${roomId}`)
      }
      isJoiningRoomRef.current = false
    }, 200)
    
    // Cleanup function
    return () => {
      clearTimeout(timeoutId)
      // Reset flag if component unmounts or room changes again
      if (roomId !== currentRoomRef.current) {
        isJoiningRoomRef.current = false
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket, user.username])

  const handleConnectToUser = (targetSocketId, targetUsername) => {
    if (mode === 'torrent') {
      connectToPeer(targetSocketId)
    } else {
      setTargetUser({ socketId: targetSocketId, username: targetUsername })
      initiateConnection(targetSocketId)
    }
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      setError(`File size exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
      return
    }

    if (!targetUser || !isConnected) {
      setError('Please connect to a user first')
      return
    }

    try {
      setError('')
      await sendFile(file)
    } catch (err) {
      setError(err.message || 'Failed to send file')
    }
  }

  const handleSendMessage = (message) => {
    if (socket && roomId && message.trim()) {
      socket.emit('chat-message', {
        roomId,
        message: message.trim(),
        username: user.username
      })
    }
  }

  const handleJoinRoom = (newRoomId) => {
    if (!newRoomId || newRoomId.trim() === '') {
      setError('Please enter a valid Room ID')
      return
    }
    
    if (newRoomId === roomId || newRoomId === currentRoomRef.current) {
      setError('You are already in this room')
      return
    }
    
    if (!socket || !socket.connected) {
      setError('Not connected to server. Please wait...')
      return
    }
    
    setError('')
    setRoomId(newRoomId.trim())
  }

  const handleCreateRoom = () => {
    const newRoomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setRoomId(newRoomId)
    setError('')
  }

  const handleCopyRoomId = () => {
    // Handled by RoomManager component
  }

  const handleLeaveRoom = () => {
    if (socket) {
      socket.emit('leave-room', { roomId })
      socket.close()
    }
    disconnect()
    localStorage.removeItem('roomId')
    onLogout()
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">P2P File Transfer</h1>
              <p className="text-sm text-gray-600">
                User: <span className="font-semibold">{user.username}</span>
              </p>
            </div>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* Room Manager */}
        <RoomManager
          roomId={roomId}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          onCopyRoomId={handleCopyRoomId}
        />

        {/* Mode Switcher */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Transfer Mode</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('torrent')}
                className={`px-4 py-2 rounded-lg transition ${
                  mode === 'torrent'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🌐 Torrent (Multi-Peer)
              </button>
              <button
                onClick={() => setMode('direct')}
                className={`px-4 py-2 rounded-lg transition ${
                  mode === 'direct'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                🔗 Direct (1-to-1)
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {mode === 'torrent'
              ? 'Share files with multiple peers. Download from multiple sources simultaneously.'
              : 'Direct peer-to-peer file transfer between two users.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {mode === 'torrent' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Panel - Users & Peers */}
            <div className="lg:col-span-1 space-y-4">
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Users in Room</h2>
                {roomUsers.length === 0 ? (
                  <p className="text-gray-500 text-sm">Waiting for other users to join...</p>
                ) : (
                  <div className="space-y-2">
                    {roomUsers.map((user) => {
                      const peer = peers.find(p => p.socketId === user.socketId)
                      return (
                        <div
                          key={user.socketId}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                        >
                          <span className="font-medium text-gray-700">{user.username}</span>
                          {peer?.connected ? (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Connected
                            </span>
                          ) : (
                            <button
                              onClick={() => handleConnectToUser(user.socketId, user.username)}
                              className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 transition"
                            >
                              Connect
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-lg p-4">
                <h2 className="text-lg font-semibold mb-2 text-gray-800">Connected Peers</h2>
                <p className="text-sm text-gray-600">{peers.length} peer(s) connected</p>
              </div>
            </div>

            {/* Middle Panel - Torrent File Sharing */}
            <div className="lg:col-span-2">
              <TorrentPanel
                availableFiles={availableFiles}
                myFiles={myFiles}
                downloads={downloads}
                onShareFile={shareFile}
                onDownloadFile={downloadFile}
                fileInputRef={torrentFileInputRef}
                maxFileSize={TORRENT_MAX_FILE_SIZE}
              />
            </div>
          </div>
        ) : (

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Panel - Users & Connection */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Users in Room</h2>
              {roomUsers.length === 0 ? (
                <p className="text-gray-500 text-sm">Waiting for other users to join...</p>
              ) : (
                <div className="space-y-2">
                  {roomUsers.map((user) => (
                    <div
                      key={user.socketId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
                    >
                      <span className="font-medium text-gray-700">{user.username}</span>
                      {targetUser?.socketId === user.socketId ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Connected
                        </span>
                      ) : (
                        <button
                          onClick={() => handleConnectToUser(user.socketId, user.username)}
                          className="text-xs bg-purple-500 text-white px-3 py-1 rounded hover:bg-purple-600 transition"
                          disabled={isConnected}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <ConnectionStatus
              status={connectionStatus}
              isConnected={isConnected}
              targetUser={targetUser}
            />
          </div>

          {/* Middle Panel - File Transfer */}
          <div className="lg:col-span-1">
            <FileTransferPanel
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              isConnected={isConnected}
              fileTransferProgress={fileTransferProgress}
              currentFile={currentFile}
              error={error}
              maxFileSize={MAX_FILE_SIZE}
            />
          </div>

          {/* Right Panel - Chat */}
          <div className="lg:col-span-1">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              currentUsername={user.username}
            />
          </div>
        </div>
        )}

        {/* Chat Panel for Torrent Mode */}
        {mode === 'torrent' && (
          <div className="mt-4">
            <ChatPanel
              messages={messages}
              onSendMessage={handleSendMessage}
              currentUsername={user.username}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default FileTransferRoom

