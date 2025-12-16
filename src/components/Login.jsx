import { useState } from 'react'

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters')
      return
    }
    if (username.trim().length > 20) {
      setError('Username must be less than 20 characters')
      return
    }
    setError('')
    onLogin(username.trim())
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            P2P File Transfer
          </h1>
          <p className="text-gray-600">
            Secure peer-to-peer file sharing
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition"
              placeholder="Enter your username"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition transform hover:scale-105"
          >
            Enter Room
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>No account needed - just enter a username to start sharing files!</p>
        </div>
      </div>
    </div>
  )
}

export default Login

