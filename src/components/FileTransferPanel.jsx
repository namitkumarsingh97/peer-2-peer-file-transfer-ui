const FileTransferPanel = ({
  fileInputRef,
  onFileSelect,
  isConnected,
  fileTransferProgress,
  currentFile,
  error,
  maxFileSize
}) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">File Transfer</h2>
      
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800">
            Connect to a user to start transferring files
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select File (Max: {formatFileSize(maxFileSize)})
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={onFileSelect}
            disabled={!isConnected}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {currentFile && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 truncate">
                {currentFile.name}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                {formatFileSize(currentFile.size)}
              </span>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
              <div
                className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${fileTransferProgress}%` }}
              ></div>
            </div>
            
            <p className="text-xs text-gray-600 text-center">
              {Math.round(fileTransferProgress)}% complete
            </p>
          </div>
        )}

        {!currentFile && isConnected && (
          <div className="text-center py-8 text-gray-400">
            <svg
              className="mx-auto h-12 w-12 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-sm">Ready to send files</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default FileTransferPanel

