import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        border: "var(--border)",
        neon: "var(--neon)",
        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",
        text: "var(--text)",
        "text-mute": "var(--text-mute)",
        mute: "var(--mute)",
        danger: "var(--danger)"
      }
    }
  },
  plugins: []
};

export default config;
