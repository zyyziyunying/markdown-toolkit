(() => {
  const mermaidToolkit = (window.MarkdownToolkitMermaid = window.MarkdownToolkitMermaid || {});
  const MAX_TEXT_SIZE = 200000;
  const FLOWCHART_WRAPPING_WIDTH = 360;
  const MERMAID_LIGHT_THEME = "default";
  const MERMAID_DARK_THEME = "dark";

  let mermaidReady = false;
  let currentTheme = null;

  function resolveMermaidTheme() {
    const classes = document.body ? document.body.classList : null;
    if (!classes) {
      return MERMAID_LIGHT_THEME;
    }

    if (classes.contains("vscode-light") || classes.contains("vscode-high-contrast-light")) {
      return MERMAID_LIGHT_THEME;
    }

    return MERMAID_DARK_THEME;
  }

  function ensureMermaid() {
    if (typeof mermaid === "undefined") {
      return false;
    }

    const theme = resolveMermaidTheme();
    if (mermaidReady && currentTheme === theme) {
      return true;
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme,
      maxTextSize: MAX_TEXT_SIZE,
      markdownAutoWrap: true,
      flowchart: {
        htmlLabels: true,
        wrappingWidth: FLOWCHART_WRAPPING_WIDTH,
      },
    });

    mermaidReady = true;
    currentTheme = theme;
    return true;
  }

  const rendererApi = mermaidToolkit.renderer || null;
  if (rendererApi && typeof rendererApi.install === "function") {
    rendererApi.install({ ensureMermaid });
  }
})();
