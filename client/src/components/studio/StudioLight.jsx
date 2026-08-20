import { useThree } from '@react-three/fiber';

/**
 * StudioLight — dark premium product-studio lighting.
 *
 * The old stage was overexposed and green: ambient 0.98 + directional 2.4 plus
 * a #21f59a front point light and a #063c2e under-light pushed every garment
 * toward a grey-green cast (a "black" hoodie measured rgb(77,91,95)). This rig
 * is low-key and neutral: a warm white key raking the fabric from the upper
 * left, a cool desaturated fill on the right, a cool rim punching the
 * silhouette from behind, and a faint neutral bounce under the hem. The fabric
 * reads by its own fold shading + normal map rather than raw light power.
 */
export default function StudioLight() {
  const gl = useThree((s) => s.gl);
  gl.toneMappingExposure = 1.0;

  return (
    <>
      {/* Base level — dark, never black-on-black */}
      <ambientLight intensity={0.28} color="#ffffff" />

      {/* Key — warm, rakes the front-left fabric */}
      <directionalLight position={[3, 4.2, 5]} intensity={1.4} color="#fff1dd" castShadow />

      {/* Fill — cool, softens the right side without washing it */}
      <directionalLight position={[-4, 1.5, 3]} intensity={0.55} color="#dcebff" />

      {/* Rim — cool backlight, separates the garment from the backdrop */}
      <directionalLight position={[0.5, 3, -4]} intensity={0.7} color="#cfebff" />

      {/* Bounce — faint neutral lift off the (shadowed) floor */}
      <directionalLight position={[0, -2.4, 2.4]} intensity={0.18} color="#f5f5f0" />
    </>
  );
}
