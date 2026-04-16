/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0f13",
        panel: "#121820",
        panelSoft: "#1b2430",
        border: "#2a3544",
        success: "#22c55e",
        danger: "#f43f5e",
        text: "#e5e7eb",
        muted: "#94a3b8"
      }
    }
  },
  plugins: []
};
