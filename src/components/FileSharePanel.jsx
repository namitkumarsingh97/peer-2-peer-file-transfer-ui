import { useState } from 'react'
import QRCode from './QRCode'
import { generateShareLink, generateFileId } from '../utils/shareLink'

const FileSharePanel = ({ 
  sharedFiles, 
  onShareFile, 
  onStopSharing,
  fileInputRef
}) => {
  const [copiedFileId, setCopiedFileId] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setIsProcessing(true)
    setUploadProgress(0)

    try {
      const fileId = generateFileId()
      // Pass progress callback for large files
      await onShareFile(file, fileId, (progress) => {
        setUploadProgress(progress)
      })
      e.target.value = '' // Reset input
      setUploadProgress(0)
    } catch (error) {
      alert(`Error sharing file: ${error.message}`)
    } finally {
      setIsProcessing(false)
      setUploadProgress(0)
    }
  }

  const handleCopyLink = (fileId) => {
    const link = generateShareLink(fileId)
    navigator.clipboard.writeText(link)
    setCopiedFileId(fileId)
    setTimeout(() => setCopiedFileId(null), 2000)
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-green-400 to-green-600 rounded-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Share Files</h2>
          <p className="text-sm text-gray-500">From your device</p>
        </div>
      </div>
      
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          Select File to Share
        </label>
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-3 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-gradient-to-r file:from-green-500 file:to-green-600 file:text-white hover:file:from-green-600 hover:file:to-green-700 file:transition-all file:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isProcessing && (
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600">Processing file...</span>
                <span className="text-xs font-semibold text-green-600">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3 flex items-start gap-1">
          <span className="text-green-500">💡</span>
          <span>File stays on YOUR device. Others download directly from you via WebRTC. Keep this window open!</span>
        </p>
      </div>

      {sharedFiles.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Your Shared Files ({sharedFiles.length})
          </h3>
          <div className="space-y-4">
            {sharedFiles.map((file) => {
              const shareLink = generateShareLink(file.fileId)
              return (
                <div
                  key={file.fileId}
                  className="border-2 border-green-200 rounded-xl p-5 bg-gradient-to-br from-green-50 to-white shadow-lg hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-gray-800 mb-1 truncate">{file.fileName}</h4>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm text-gray-600">{formatFileSize(file.fileSize)}</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-semibold">
                          Sharing
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onStopSharing(file.fileId)}
                      className="ml-3 px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-medium flex-shrink-0"
                    >
                      Stop
                    </button>
                  </div>

                  {/* Share Link */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Share Link
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={shareLink}
                        readOnly
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      />
                      <button
                        onClick={() => handleCopyLink(file.fileId)}
                        className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition font-semibold text-sm flex-shrink-0 shadow-md"
                      >
                        {copiedFileId === file.fileId ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center bg-white p-4 rounded-lg border border-gray-200">
                    <QRCode value={shareLink} size={180} />
                  </div>

                  <p className="text-xs text-center text-gray-500 mt-3">
                    Keep this window open for others to download
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {sharedFiles.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-sm font-medium">No files shared yet</p>
          <p className="text-xs mt-1">Select a file to start sharing!</p>
        </div>
      )}
    </div>
  )
}

export default FileSharePanel
