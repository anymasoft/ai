import type { PlasmoCSConfig } from "plasmo"
import "../content-script.js"
import "../styles.css"

export const config: PlasmoCSConfig = {
  matches: ["https://www.youtube.com/*"],
  all_frames: false,
  run_at: "document_idle"
}

// Content script (бывший youtube.js) загружается автоматически
// flags.js встроен в content-script.js
