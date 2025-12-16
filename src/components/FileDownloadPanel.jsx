import { useState } from 'react'

const FileDownloadPanel = ({ 
  availableFiles, 
  onDownloadFile,
  downloads 
}) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 border border-gray-100">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-gradient-to-br from-purple-400 to-indigo-600 rounded-lg">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Download Files</h2>
          <p className="text-sm text-gray-500">From other devices</p>
        </div>
      </div>
      
      {availableFiles.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium">No files available</p>
          <p className="text-xs mt-1">Enter a share link to download files</p>
        </div>
      ) : (
        <div className="space-y-3">
          {availableFiles.map((file) => {
            const download = downloads.find(d => d.fileId === file.fileId)
            return (
              <div
                key={file.fileId}
                className="border border-gray-200 rounded-xl p-4 hover:bg-gray-50 hover:border-purple-300 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-800 truncate">{file.fileName}</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>
                  {download ? (
                    <div className="flex items-center gap-3 ml-4">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-indigo-600 h-2 rounded-full transition-all"
                          style={{ width: `${download.progress}%` }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-600 font-medium whitespace-nowrap">{Math.round(download.progress)}%</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => onDownloadFile(file)}
                      className="ml-4 px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition font-semibold text-sm flex-shrink-0 shadow-md"
                    >
                      Download
                    </button>
                  )}
                </div>
                {download && download.status === 'downloading' && (
                  <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    Downloading...
                  </p>
                )}
                {download && download.status === 'completed' && (
                  <p className="text-xs text-green-600 mt-2 font-semibold">
                    ✓ Download complete!
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {downloads.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
            Active Downloads ({downloads.filter(d => d.status === 'downloading').length})
          </h3>
          <div className="space-y-3">
            {downloads.map((download) => (
              <div key={download.fileId} className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-4 border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-gray-700 truncate">{download.fileName}</span>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                    download.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {download.status}
                  </span>
                </div>
                <div className="w-full bg-white rounded-full h-2.5 mb-2 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 h-2.5 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${download.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-600">
                  {Math.round(download.progress)}% • {formatFileSize(download.downloaded)} / {formatFileSize(download.fileSize)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FileDownloadPanel
