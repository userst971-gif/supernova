import ProductViewer from './ProductViewer';

/**
 * GarmentStage — thin compatibility wrapper over ProductViewer. Design.jsx and
 * RenderPage.jsx keep importing this component with the same props; all of the
 * rendering (normalization, exact-color tinting, surface-conforming opaque
 * print, studio lighting, dynamic camera framing) lives in the new
 * ProductViewer / ApparelModel / PrintOverlay / StudioLight stack.
 */
export default function GarmentStage({ product, color, texture, placement, tool, resetRef, onReady, frameloop = 'demand', diagnose, onPlacementChange }) {
  return (
    <ProductViewer
      product={product}
      color={color}
      texture={texture}
      placement={placement}
      tool={tool}
      resetRef={resetRef}
      onReady={onReady}
      frameloop={frameloop}
      diagnose={diagnose}
      onPlacementChange={onPlacementChange}
    />
  );
}
