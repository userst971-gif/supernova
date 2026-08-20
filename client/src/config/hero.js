// Single source of truth for the hero cinematic background.
//
// The hero background is a short night-scene video referenced through the
// app's public/static asset system (client/public → served at /). To change
// the background, drop a new file into client/public/video/ and point
// HERO_BACKGROUND_VIDEO at it. Never hard-code an absolute machine path here.
export const HERO_BACKGROUND_VIDEO = '/video/hero-background.mp4';
export const HERO_BACKGROUND_POSTER = '/img/hero-background-poster.jpg';
