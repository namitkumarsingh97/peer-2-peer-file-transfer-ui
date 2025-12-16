import { useState } from 'react'

const TorrentPanel = ({
  availableFiles,
  myFiles,
  downloads,
  onShareFile,
  onDownloadFile,
  fileInputRef,
  maxFileSize
}) => {
  const [selectedFile, setSelectedFile] = useState(null)

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.size > maxFileSize) {
      alert(`File size exceeds limit of ${maxFileSize / 1024 / 1024}MB`)
      return
    }

    try {
      await onShareFile(file)
      alert(`File "${file.name}" is now being shared!`)
      e.target.value = '' // Reset input
    } catch (error) {
      alert(`Error sharing file: ${error.message}`)
    }
  }

  const handleDownload = (file) => {
    onDownloadFile(file)
  }

  return (
    <div className="space-y-4">
      {/* Share File Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Share File (Seed)</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File to Share (Max: {formatFileSize(maxFileSize)})
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
          </div>

          {myFiles.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Shared Files:</h3>
              <div className="space-y-2">
                {myFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{file.fileName}</p>
                      <p className="text-xs text-gray-600">
                        {formatFileSize(file.fileSize)} • {file.totalChunks} chunks
                      </p>
                    </div>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                      Seeding
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Available Files Section */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-800">Available Files</h2>
        {availableFiles.length === 0 ? (
          <p className="text-gray-500 text-sm">No files available. Share a file to get started!</p>
        ) : (
          <div className="space-y-2">
            {availableFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{file.fileName}</p>
                  <p className="text-xs text-gray-600">
                    {formatFileSize(file.fileSize)} • {file.totalChunks} chunks • {file.peers?.length || 0} peers
                  </p>
                </div>
                <button
                  onClick={() => handleDownload(file)}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium"
                >
                  Download
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Downloads Section */}
      {downloads.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Active Downloads</h2>
          <div className="space-y-4">
            {downloads.map((download) => (
              <div key={download.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{download.fileName}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {download.status}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${download.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">
                  {Math.round(download.progress)}% • {download.receivedChunks?.size || 0}/{download.totalChunks} chunks • {download.peers?.length || 0} peers
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TorrentPanel

