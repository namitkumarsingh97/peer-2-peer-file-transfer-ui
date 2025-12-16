const ConnectionStatus = ({ status, isConnected, targetUser }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'disconnected':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'connecting':
        return 'Connecting...'
      case 'disconnected':
        return 'Disconnected'
      default:
        return 'Not Connected'
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Connection Status</h2>
      
      <div className={`border-2 rounded-lg p-4 ${getStatusColor()}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold">{getStatusText()}</span>
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
            }`}
          ></div>
        </div>
        
        {targetUser && (
          <div className="mt-2 pt-2 border-t border-current border-opacity-20">
            <p className="text-sm">
              Connected to: <span className="font-semibold">{targetUser.username}</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>• WebRTC peer-to-peer connection</p>
        <p>• Files transfer directly between peers</p>
        <p>• No server storage required</p>
      </div>
    </div>
  )
}

export default ConnectionStatus

