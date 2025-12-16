import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useParams, useNavigate } from 'react-router-dom'
import DirectShareRoom from './components/DirectShareRoom'
import './App.css'

// Component to handle download route
const DownloadPage = () => {
  const { fileId } = useParams()
  const navigate = useNavigate()

  useEffect(() => {
    if (fileId) {
      console.log('DownloadPage: Redirecting with fileId:', fileId)
      // Redirect to main app with fileId in state
      // The DirectShareRoom will handle the download
      navigate('/', { 
        state: { fileId },
        replace: true 
      })
    }
  }, [fileId, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading file share...</p>
        {fileId && (
          <p className="text-xs text-gray-500 mt-2">File ID: {fileId}</p>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/download/:fileId" element={<DownloadPage />} />
        <Route path="/" element={<DirectShareRoom />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
