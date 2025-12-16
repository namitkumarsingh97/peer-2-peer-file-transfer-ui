import { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { useDirectShare } from '../hooks/useDirectShare'
import FileSharePanel from './FileSharePanel'
import FileDownloadPanel from './FileDownloadPanel'
import ShareLinkInput from './ShareLinkInput'
import { parseShareLink } from '../utils/shareLink'

const DirectShareRoom = () => {
  const [socket, setSocket] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const {
    sharedFiles,
    availableFiles,
    downloads,
    shareFile,
    stopSharing,
    downloadFile,
    handleDownloadRequest,
    handleDownloadAnswer,
    handleIceCandidate
  } = useDirectShare(socket)

  useEffect(() => {
    const newSocket = io('http://localhost:3001')

    newSocket.on('connect', () => {
      console.log('Connected to signaling server')
    })

    // File sharing announcements (broadcast to all)
    newSocket.on('file-share-announce', ({ fileId, metadata, seederSocketId }) => {
      setAvailableFiles(prev => {
        const exists = prev.find(f => f.fileId === fileId)
        if (exists) return prev
        return [...prev, {
          fileId,
          ...metadata,
          seederSocketId
        }]
      })
    })

    newSocket.on('file-share-stop', ({ fileId }) => {
      setAvailableFiles(prev => prev.filter(f => f.fileId !== fileId))
    })

    // File download request (when someone wants to download)
    newSocket.on('file-download-connect', ({ fileId, downloaderSocketId }) => {
      // This is handled by useDirectShare hook
    })

    // WebRTC signaling for file downloads
    newSocket.on('file-download-request', ({ offer, fileId, fromSocketId }) => {
      handleDownloadRequest(offer, fromSocketId, fileId)
    })

    newSocket.on('file-download-answer', ({ answer, fileId, fromSocketId }) => {
      handleDownloadAnswer(answer, fromSocketId, fileId)
    })

    newSocket.on('ice-candidate', ({ candidate, fromSocketId, fileId }) => {
      handleIceCandidate(candidate, fromSocketId, fileId)
    })

    setSocket(newSocket)

    return () => {
      if (newSocket.connected) {
        newSocket.close()
      }
    }
  }, [handleDownloadRequest, handleDownloadAnswer, handleIceCandidate])

  const handleShareFile = async (file, fileId, onProgress) => {
    try {
      await shareFile(file, fileId, onProgress)
    } catch (error) {
      setError(error.message || 'Failed to share file')
    }
  }

  const handleDownload = async (fileInfo) => {
    try {
      await downloadFile(fileInfo)
    } catch (error) {
      setError(error.message || 'Failed to download file')
    }
  }

  const handleJoinShare = (fileId) => {
    // Request file info and connect to seeder
    if (socket && socket.connected) {
      socket.emit('file-download-connect', { fileId })
    }
  }

  return (
    <div className="min-h-screen p-3 sm:p-4 md:p-6 bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-4 sm:p-6 mb-4 sm:mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Direct File Share
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Share files directly from your device • No login required
              </p>
              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                <span>💡</span>
                <span>Upload a file, get a link, share it. File stays on YOUR device - others download directly from you via WebRTC (no cloud storage needed!)</span>
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-4 sm:mb-6">
            <p className="text-sm text-red-800 flex items-center gap-2">
              <span className="text-red-500">⚠</span>
              {error}
            </p>
          </div>
        )}

        {/* Share Link Input */}
        <ShareLinkInput onJoinShare={handleJoinShare} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          {/* Share Panel */}
          <div>
            <FileSharePanel
              sharedFiles={sharedFiles}
              onShareFile={handleShareFile}
              onStopSharing={stopSharing}
              fileInputRef={fileInputRef}
            />
          </div>

          {/* Download Panel */}
          <div>
            <FileDownloadPanel
              availableFiles={availableFiles}
              onDownloadFile={handleDownload}
              downloads={downloads}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DirectShareRoom
