"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the browser's built-in barcode reader (Chrome / Edge / Android).
type Detector = { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Reads a product barcode with the camera where the browser supports it (not iPhone Safari yet).
 * Render <video ref={videoRef}> while `scanning`; `onCode` gets the digits once.
 */
export function useBarcodeCamera(onCode: (code: string) => void) {
  const [scanning, setScanning] = useState(false);
  const [canScan, setCanScan] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setCanScan("BarcodeDetector" in window && Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    setCameraError(null);
    try {
      const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
      const detector = new Ctor({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setScanning(true);
      // Wait for the <video> to mount.
      await new Promise((r) => setTimeout(r, 50));
      const video = videoRef.current;
      if (!video) return stop();
      video.srcObject = stream;
      await video.play();
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const value = (await detector.detect(video))[0]?.rawValue;
          if (value) {
            stop();
            onCode(value);
            return;
          }
        } catch {
          // keep trying
        }
        setTimeout(tick, 250);
      };
      void tick();
    } catch (e) {
      stop();
      setCameraError(e instanceof Error && e.name === "NotAllowedError" ? "Camera permission was denied." : "Couldn't start the camera. Type the number instead.");
    }
  }, [onCode, stop]);

  return { videoRef, scanning, canScan, cameraError, start, stop };
}
