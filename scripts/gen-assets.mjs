// Generates the source icon/splash images that `@capacitor/assets` expands into
// every Android density and iOS icon/splash slot. Rasterized from the IronLog
// barbell mark in public/icon.svg so the native apps share the web branding.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

mkdirSync("assets", { recursive: true });

const BLUE = "#2563eb"; // brand / manifest theme_color
const DARK = "#09090b"; // manifest background_color

const fullIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="${BLUE}"/><path d="M16 20v24M48 20v24M16 32h32M22 28v8M42 28v8" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;
const glyph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none"><path d="M16 20v24M48 20v24M16 32h32M22 28v8M42 28v8" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>`;

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const blank = (size, background) => ({
  create: { width: size, height: size, channels: 4, background },
});

// Full icon (iOS / Android legacy) — blue rounded square + barbell.
await sharp(Buffer.from(fullIcon)).resize(1024, 1024).png().toFile("assets/icon-only.png");

// Android adaptive: solid blue background layer + glyph foreground (in safe zone).
await sharp(blank(1024, BLUE)).png().toFile("assets/icon-background.png");
const fg = await sharp(Buffer.from(glyph)).resize(660, 660).png().toBuffer();
await sharp(blank(1024, transparent))
  .composite([{ input: fg, gravity: "center" }])
  .png()
  .toFile("assets/icon-foreground.png");

// Splash screens — centered glyph on brand backgrounds.
const splashMark = await sharp(Buffer.from(glyph)).resize(820, 820).png().toBuffer();
await sharp(blank(2732, BLUE))
  .composite([{ input: splashMark, gravity: "center" }])
  .png()
  .toFile("assets/splash.png");
await sharp(blank(2732, DARK))
  .composite([{ input: splashMark, gravity: "center" }])
  .png()
  .toFile("assets/splash-dark.png");

console.log("Generated assets/: icon-only, icon-background, icon-foreground, splash, splash-dark");
