module.exports = {
  manifest: {
    name: "VideoReader",
    version: "1.0.0",
    description: "YouTube Video Reader with subtitle translation",
    permissions: ["storage", "tabs"],
    host_permissions: ["https://*.youtube.com/*", "http://localhost:5000/*"],
    action: {
      default_title: "VideoReader",
      default_icon: {
        16: "assets/logo.png",
        32: "assets/logo.png",
        48: "assets/logo.png",
        128: "assets/logo.png"
      }
    },
    icons: {
      16: "assets/logo.png",
      32: "assets/logo.png",
      48: "assets/logo.png",
      128: "assets/logo.png"
    }
  }
}
