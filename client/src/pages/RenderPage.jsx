import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { PRINT_DEFAULT, PRODUCTS } from '../config/design';
import { generateShopPrint } from '../config/shopPrints';
import GarmentStage from '../components/studio/GarmentStage';

/**
 * Render harness — hidden route (/render?model=&hex=&yaw=) used by the asset
 * pipeline to capture product photos straight from the Design Studio's 3D
 * garment stage. Not linked anywhere; the puppeteer render script drives it
 * headlessly and screenshots the <canvas>.
 *
 * Batch mode: pass `cols=hex1,hex2,...` — the page cycles through every
 * colorway (same model, one GLB load) and marks each via
 * `html[data-render-colour="<hex>"]`, ending with `html[data-render-done]`.
 *
 * Print mode: pass `design=<product-slug>` to render the product's own print
 * artwork (shopPrints.js) through the surface-conforming overlay, so product
 * photos show the designed print instead of a blank garment.
 */
export default function RenderPage() {
  const resetRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [batchIdx, setBatchIdx] = useState(-1);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const modelId = params.get('model') || 'tee';
  const hex = params.get('hex') || '#16181c';
  const yaw = Number(params.get('yaw') || 0);
  const width = Number(params.get('w') || 1200);
  const height = Number(params.get('h') || 1500);
  const dwell = Number(params.get('dwell') || 2200);
  const probe = params.get('probe') === '1';
  const designSlug = params.get('design') || '';
  const cols = useMemo(
    () =>
      (params.get('cols') || '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => /^#?[0-9a-f]{6}$/i.test(s)),
    [params]
  );
  const color = cols.length ? cols[batchIdx] || cols[0] : hex;

  const product = useMemo(() => {
    const base = PRODUCTS.find((p) => p.id === modelId) || PRODUCTS[0];
    return { ...base, camera: { ...base.camera, yaw } };
  }, [modelId, yaw]);

  // Draw the product's own print artwork (if `design` given) into a
  // CanvasTexture for the surface-conforming overlay. Fonts must be ready first
  // or the wordmark text renders with a fallback face.
  const [texture, setTexture] = useState(null);
  const texRef = useRef(null);
  useEffect(() => {
    let alive = true;
    if (texRef.current) {
      texRef.current.dispose();
      texRef.current = null;
    }
    setTexture(null);
    if (!designSlug) return undefined;
    const canvas = generateShopPrint(designSlug);
    if (!canvas) return undefined;
    const commit = () => {
      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      if (!alive) {
        t.dispose();
        return;
      }
      texRef.current = t;
      setTexture(t);
    };
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
      document.fonts
        .load('700 96px "Space Grotesk", "Segoe UI", sans-serif')
        .finally(() => document.fonts.ready.then(commit))
        .catch(commit);
    } else {
      commit();
    }
    return () => {
      alive = false;
    };
  }, [designSlug]);

  const handleReady = useCallback(() => {
    setReady(true);
    document.documentElement.dataset.renderReady = '1';
  }, []);

  // Tuning probe (?probe=1): the viewer dumps the normalized bbox + front-face
  // height profile here for the asset pipeline to read (print-zone/camera
  // tuning) instead of eyeballing screenshots.
  const handleDiagnose = useCallback((data) => {
    window.__diagnose = data;
    document.documentElement.dataset.diagReady = '1';
  }, []);

  // Batch driver: advance through the colorways only when the capture script
  // signals `html[data-render-next="1"]` — never on a timer, so a screenshot
  // can never race past its colorway.
  useEffect(() => {
    if (!cols.length) return undefined;
    setBatchIdx(0);
    const poll = setInterval(() => {
      if (document.documentElement.dataset.renderNext !== '1') return;
      document.documentElement.dataset.renderNext = '0';
      setBatchIdx((i) => {
        if (i + 1 >= cols.length) {
          document.documentElement.dataset.renderDone = '1';
          return i;
        }
        return i + 1;
      });
    }, 120);
    return () => clearInterval(poll);
  }, [cols]);

  useEffect(() => {
    if (ready && color) {
      document.documentElement.dataset.renderColour = color.replace(/^#/, '').toLowerCase();
    }
  }, [ready, color]);

  return (
    <div
      style={{ width, height }}
      className="relative overflow-hidden bg-[#020303]"
      data-render-model={modelId}
    >
      <GarmentStage
        product={product}
        color={color}
        texture={texture}
        placement={PRINT_DEFAULT}
        resetRef={resetRef}
        onReady={handleReady}
        frameloop="always"
        diagnose={probe ? handleDiagnose : undefined}
      />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.35em] text-white/40">Loading garment…</span>
        </div>
      )}
    </div>
  );
}
