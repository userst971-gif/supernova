// Single source of truth for the hero cinematic background.
//
// The hero shows ONE full-bleed scene — a masked hero in a glowing green
// suit, built from the original 720x1280 portrait clip into a 1280x720 16:9
// master (figure centered at full height, atmospheric blur-fill sides).
// Referenced through the app's public/static asset system (client/public →
// served at /). To change the hero, drop a new file into client/public/video/
// and point HERO_BACKGROUND_VIDEO at it. Never hard-code a machine path here.
export const HERO_BACKGROUND_VIDEO = '/video/hero-figure.mp4';
export const HERO_BACKGROUND_POSTER = '/img/hero-figure-poster.jpg';
