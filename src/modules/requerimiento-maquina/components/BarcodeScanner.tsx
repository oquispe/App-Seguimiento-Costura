import { useEffect, useId, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, CameraOff } from 'lucide-react'

/**
 * Escaneo de código por cámara usando `html5-qrcode` (decodifica los frames
 * de video en JS puro vía ZXing-WASM), en vez de la API nativa
 * `BarcodeDetector` — esa API depende de un componente que el navegador
 * puede o no tener instalado (nativa solo en Android/ChromeOS de forma
 * confiable), mientras que esta librería funciona igual en cualquier
 * navegador moderno con `getUserMedia`. Formatos calcados del original:
 * code_128, code_39, code_93, ean_13, ean_8, upc_a, upc_e, codabar, itf, y
 * qr_code para códigos QR. La entrada manual (que también funciona con
 * lectores de código de barras USB tipo teclado) sigue disponible siempre.
 */

const FORMATOS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
]

interface Props {
  onDetected: (valor: string) => void
}

export function BarcodeScanner({ onDetected }: Props) {
  const [activo, setActivo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contenedorId = `barcode-scanner-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const detectadoRef = useRef(false)
  // Ref en vez de dependencia directa: `onDetected` es un closure nuevo en
  // cada render de FirmaModal, y ponerlo en el array de dependencias del
  // efecto hacía que la cámara se reiniciara sola mientras estaba activa.
  const onDetectedRef = useRef(onDetected)
  onDetectedRef.current = onDetected

  useEffect(() => {
    if (!activo) return
    detectadoRef.current = false
    let cancelado = false
    const scanner = new Html5Qrcode(contenedorId, { formatsToSupport: FORMATOS, verbose: false })

    const detener = () => {
      if (scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) return
      scanner
        .stop()
        .catch(() => {})
        .then(() => {
          try { scanner.clear() } catch { /* contenedor ya desmontado */ }
        })
    }

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          if (detectadoRef.current) return
          detectadoRef.current = true
          onDetectedRef.current(decodedText)
          setActivo(false)
        },
        () => {
          // frame no decodificable, se reintenta en el próximo tick
        }
      )
      .catch((err) => {
        if (cancelado) return
        setError(err instanceof Error ? err.message : 'No se pudo acceder a la cámara')
        setActivo(false)
      })

    return () => {
      cancelado = true
      try {
        detener()
      } catch {
        // stop() puede lanzar de forma síncrona si el escáner ya no está corriendo
      }
    }
  }, [activo, contenedorId])

  return (
    <div className="flex flex-col gap-2">
      {activo ? (
        <div className="relative rounded-lg overflow-hidden border border-line bg-black h-48">
          <div id={contenedorId} className="w-full h-full" />
          <button
            onClick={() => setActivo(false)}
            className="absolute top-2 right-2 flex items-center gap-1 text-xs bg-black/60 text-white rounded-lg px-2 py-1"
          >
            <CameraOff className="w-3.5 h-3.5" />
            Detener
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setError(null); setActivo(true) }}
          className="flex items-center justify-center gap-1.5 text-xs font-medium text-ink-muted border border-line rounded-lg px-3 py-2 hover:bg-surface"
        >
          <Camera className="w-3.5 h-3.5" />
          Escanear código
        </button>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
