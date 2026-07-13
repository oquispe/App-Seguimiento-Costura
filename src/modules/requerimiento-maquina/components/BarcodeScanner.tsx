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
  // Cola que serializa inicio/detención de la cámara entre invocaciones del
  // efecto. React.StrictMode (activo en main.tsx) monta→desmonta→monta este
  // efecto en desarrollo; como start() es async, el desmontaje fantasma no
  // alcanza a frenarlo antes de que el segundo montaje pida la cámara de
  // nuevo, y dos getUserMedia() simultáneos sobre el mismo dispositivo
  // suelen fallar con NotReadableError aunque el permiso ya esté concedido.
  const colaRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!activo) return
    detectadoRef.current = false
    let cancelado = false
    let scanner: Html5Qrcode | null = null

    colaRef.current = colaRef.current.then(async () => {
      if (cancelado) return
      // useBarCodeDetectorIfSupported: en Chrome/Edge/Android usa la API nativa
      // BarcodeDetector (mucho más confiable que ZXing-WASM para códigos de
      // barras 1D como el Code128 de los carnés/DNI) y cae a ZXing solo si el
      // navegador no la soporta.
      scanner = new Html5Qrcode(contenedorId, {
        formatsToSupport: FORMATOS,
        useBarCodeDetectorIfSupported: true,
        verbose: false,
      })
      try {
        await scanner.start(
          // El selector de cámara solo admite un key (facingMode o deviceId);
          // la resolución va aparte, en `videoConstraints` de la config de scan.
          { facingMode: 'environment' },
          {
            fps: 10,
            // qrbox rectangular (más ancho que alto): evita recortar un
            // código de barras horizontal (carné/DNI) como pasaría con el
            // cuadrado 250x250 pensado para QR.
            qrbox: { width: 280, height: 180 },
            videoConstraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
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
        if (cancelado) {
          await scanner.stop().catch(() => {})
          try { scanner.clear() } catch { /* contenedor ya desmontado */ }
        }
      } catch (err) {
        if (cancelado) return
        // html5-qrcode rechaza con un string plano ("Error getting userMedia,
        // error = NotReadableError: ...", etc.), no con un Error — si solo
        // miramos err.message perdemos el motivo real (permiso denegado,
        // cámara ocupada por otra app/pestaña, no hay cámara, etc).
        const mensaje = err instanceof Error ? err.message : String(err)
        setError(mensaje || 'No se pudo acceder a la cámara')
        setActivo(false)
      }
    })

    return () => {
      cancelado = true
      colaRef.current = colaRef.current.then(async () => {
        if (!scanner || scanner.getState() === Html5QrcodeScannerState.NOT_STARTED) return
        await scanner.stop().catch(() => {})
        try { scanner!.clear() } catch { /* contenedor ya desmontado */ }
      })
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
