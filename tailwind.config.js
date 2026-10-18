/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Exact Design Tokens from design/stitch_/ittihad_trust_mobile/DESIGN.md & code.html
        "surface": "#f8f9ff",
        "surface-dim": "#cbdbf5",
        "surface-bright": "#f8f9ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#eff4ff",
        "surface-container": "#e5eeff",
        "surface-container-high": "#dce9ff",
        "surface-container-highest": "#d3e4fe",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#45474c",
        "inverse-surface": "#213145",
        "inverse-on-surface": "#eaf1ff",
        "outline": "#75777d",
        "outline-variant": "#c5c6cd",
        "surface-tint": "#545f73",
        "primary": "#091426",
        "on-primary": "#ffffff",
        "primary-container": "#1e293b",
        "on-primary-container": "#8590a6",
        "inverse-primary": "#bcc7de",
        "secondary": "#006c49",
        "on-secondary": "#ffffff",
        "secondary-container": "#6cf8bb",
        "on-secondary-container": "#00714d",
        "tertiary": "#201100",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#3c2300",
        "on-tertiary-container": "#c88000",
        "error": "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        "primary-fixed": "#d8e3fb",
        "primary-fixed-dim": "#bcc7de",
        "on-primary-fixed": "#111c2d",
        "on-primary-fixed-variant": "#3c475a",
        "secondary-fixed": "#6ffbbe",
        "secondary-fixed-dim": "#4edea3",
        "on-secondary-fixed": "#002113",
        "on-secondary-fixed-variant": "#005236",
        "tertiary-fixed": "#ffddb8",
        "tertiary-fixed-dim": "#ffb95f",
        "on-tertiary-fixed": "#2a1700",
        "on-tertiary-fixed-variant": "#653e00",
        "background": "#f8f9ff",
        "on-background": "#0b1c30",
        "surface-variant": "#d3e4fe",
        "status-unpaid": "#EF4444",
        "status-pending": "#F97316",
        "status-paid": "#10B981",
        "status-upcoming": "#F59E0B",
        "surface-canvas": "#F8FAFC",
        "surface-card": "#FFFFFF",
        "border-subtle": "#E2E8F0"
      },
      borderRadius: {
        DEFAULT: "4px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
        full: "9999px"
      },
      spacing: {
        gutter: "16px",
        margin: "16px",
        "space-xs": "4px",
        "space-sm": "8px",
        "space-md": "16px",
        "space-lg": "24px",
        "space-xl": "32px"
      }
    }
  },
  plugins: []
};
