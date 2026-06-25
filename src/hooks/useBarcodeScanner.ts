import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  enabled?: boolean;
}

export function useBarcodeScanner({ onScan, enabled = true }: UseBarcodeScannerOptions) {
  const buffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys
      if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') {
        return;
      }

      const currentTime = Date.now();
      
      // Calculate speed. Scanner inputs are typed extremely fast (typically <10ms per char)
      // We set a threshold of 75ms to catch emulated keyboard keystrokes
      const isFast = lastKeyTime.current === 0 || (currentTime - lastKeyTime.current) <= 75;

      if (!isFast) {
        // Manual typing detected (slower than 75ms delay) -> clear buffer
        buffer.current = '';
      }

      lastKeyTime.current = currentTime;

      if (e.key === 'Enter') {
        const barcode = buffer.current.trim();
        // Suffix found, trigger scan
        if (barcode && barcode.length >= 3) {
          onScan(barcode);
        }
        buffer.current = '';
        lastKeyTime.current = 0;
      } else {
        // Append printable character
        if (e.key.length === 1) {
          buffer.current += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onScan, enabled]);
}
