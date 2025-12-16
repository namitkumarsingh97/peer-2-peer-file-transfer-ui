import { QRCodeSVG } from 'qrcode.react'

const QRCode = ({ value, size = 200 }) => {
  if (!value) return null

  return (
    <div className="flex flex-col items-center p-4 bg-white rounded-lg">
      <QRCodeSVG
        value={value}
        size={size}
        level="H"
        includeMargin={true}
        className="border-2 border-gray-200 rounded-lg"
      />
      <p className="mt-3 text-xs text-gray-600 text-center max-w-xs break-all font-mono">
        {value}
      </p>
      <p className="mt-1 text-xs text-gray-500 text-center">
        Scan to download
      </p>
    </div>
  )
}

export default QRCode
