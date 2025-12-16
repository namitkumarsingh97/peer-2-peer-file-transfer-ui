/**
 * Generate shareable link for file sharing
 * Simplified - no room needed, just file ID
 */

export const generateShareLink = (fileId) => {
  // Use current origin (works for both localhost and production)
  const baseUrl = window.location.origin
  return `${baseUrl}/download/${fileId}`
}

export const generateFileId = () => {
  return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export const parseShareLink = (url) => {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    const fileId = pathParts[pathParts.length - 1]
    return { fileId }
  } catch (e) {
    return null
  }
}

