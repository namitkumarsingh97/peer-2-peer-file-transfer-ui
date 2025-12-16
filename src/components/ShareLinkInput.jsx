import { useState } from 'react'
import { parseShareLink } from '../utils/shareLink'

const ShareLinkInput = ({ onJoinShare }) => {
  const [shareLink, setShareLink] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')

    if (!shareLink.trim()) {
      setError('Please enter a share link')
      return
    }

    const parsed = parseShareLink(shareLink.trim())
    if (!parsed || !parsed.fileId) {
      setError('Invalid share link format')
      return
    }

    onJoinShare(parsed.fileId)
    setShareLink('')
  }

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 mb-4 border border-blue-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-br from-blue-400 to-indigo-600 rounded-lg">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-800">Enter Share Link</h2>
          <p className="text-xs text-gray-600">Paste a link or scan QR code to download</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={shareLink}
            onChange={(e) => {
              setShareLink(e.target.value)
              setError('')
            }}
            placeholder="Paste share link here..."
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <span>⚠</span> {error}
            </p>
          )}
        </div>
        <button
          type="submit"
          className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition font-semibold shadow-md hover:shadow-lg transform hover:scale-[1.02]"
        >
          Join Share
        </button>
      </form>
    </div>
  )
}

export default ShareLinkInput
