import { useState } from 'react'

const RoomManager = ({ roomId, onJoinRoom, onCreateRoom, onCopyRoomId }) => {
  const [inputRoomId, setInputRoomId] = useState('')
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleJoin = () => {
    if (inputRoomId.trim()) {
      onJoinRoom(inputRoomId.trim())
      setInputRoomId('')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
      <h2 className="text-lg font-semibold mb-3 text-gray-800">Room Management</h2>
      
      {/* Current Room */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Current Room ID
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={roomId}
            readOnly
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg font-mono text-sm"
          />
          <button
            onClick={handleCopy}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm font-medium"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Share this Room ID with others to join the same room
        </p>
      </div>

      {/* Join Room */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Join Existing Room
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputRoomId}
            onChange={(e) => setInputRoomId(e.target.value)}
            placeholder="Enter Room ID"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
            onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
          />
          <button
            onClick={handleJoin}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition text-sm font-medium"
          >
            Join
          </button>
        </div>
      </div>

      {/* Create New Room */}
      <div>
        <button
          onClick={onCreateRoom}
          className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition text-sm font-medium"
        >
          Create New Room
        </button>
      </div>
    </div>
  )
}

export default RoomManager

