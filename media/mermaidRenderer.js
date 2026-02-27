(() => {
  const mermaidToolkit = (window.MarkdownToolkitMermaid = window.MarkdownToolkitMermaid || {});
  const MERMAID_SELECTOR = "pre > code.language-mermaid";
  const PROCESSED_ATTR = "data-markdown-toolkit-mermaid-processed";

  let diagramId = 0;
  let isScheduled = false;
  let isInstalled = false;
  let ensureMermaid = null;

  function getInteractionApi() {
    return mermaidToolkit.interaction || null;
  }

  function createDiagramWrapper(preElement, svgText) {
    const wrapper = document.createElement("div");
    wrapper.className = "markdown-toolkit-mermaid";

    const line = preElement.getAttribute("data-line");
    if (line) {
      wrapper.setAttribute("data-line", line);
    }

    const viewport = document.createElement("div");
    viewport.className = "markdown-toolkit-mermaid-viewport";

    const stage = document.createElement("div");
    stage.className = "markdown-toolkit-mermaid-stage";
    stage.innerHTML = svgText;

    viewport.append(stage);
    wrapper.append(viewport);

    return { wrapper, viewport, stage };
  }

  function createErrorBlock(message) {
    const error = document.createElement("div");
    error.className = "markdown-toolkit-mermaid-error";
    error.textContent = message;
    return error;
  }

  function enableMermaidSourceWrap(preElement) {
    preElement.classList.add("markdown-toolkit-mermaid-source");
    const codeElement = preElement.querySelector("code");
    if (codeElement) {
      codeElement.classList.add("markdown-toolkit-mermaid-source-code");
    }
  }

  async function renderMermaidPre(preElement, source) {
    try {
      const renderId = `markdown-toolkit-mermaid-${diagramId++}`;
      const renderResult = await mermaid.render(renderId, source);

      if (!preElement.isConnected) {
        return;
      }

      const { wrapper, viewport, stage } = createDiagramWrapper(preElement, renderResult.svg);
      const svg = stage.querySelector("svg");
      if (!svg) {
        throw new Error("Mermaid did not produce SVG output.");
      }

      svg.removeAttribute("height");
      svg.removeAttribute("width");
      svg.style.maxWidth = "none";

      preElement.replaceWith(wrapper);

      if (typeof renderResult.bindFunctions === "function") {
        renderResult.bindFunctions(wrapper);
      }

      const interactionApi = getInteractionApi();
      if (interactionApi && typeof interactionApi.attachInteraction === "function") {
        interactionApi.attachInteraction(wrapper, viewport, svg);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorBlock = createErrorBlock(`Mermaid render failed: ${message}`);
      if (preElement.isConnected) {
        enableMermaidSourceWrap(preElement);
        preElement.insertAdjacentElement("afterend", errorBlock);
      }
    }
  }

  async function renderAllMermaid() {
    if (typeof ensureMermaid !== "function" || !ensureMermaid()) {
      return;
    }

    const codeBlocks = Array.from(document.querySelectorAll(MERMAID_SELECTOR));
    for (const codeElement of codeBlocks) {
      const preElement = codeElement.parentElement;
      if (!preElement || preElement.tagName !== "PRE") {
        continue;
      }
      if (preElement.getAttribute(PROCESSED_ATTR) === "true") {
        continue;
      }

      const source = codeElement.textContent ? codeElement.textContent.trim() : "";
      if (!source) {
        continue;
      }

      preElement.setAttribute(PROCESSED_ATTR, "true");
      await renderMermaidPre(preElement, source);
    }
  }

  function scheduleRender() {
    if (isScheduled) {
      return;
    }

    const interactionApi = getInteractionApi();
    if (interactionApi && typeof interactionApi.exitFocusMode === "function") {
      interactionApi.exitFocusMode();
    }

    isScheduled = true;
    window.requestAnimationFrame(() => {
      isScheduled = false;
      void renderAllMermaid();
    });
  }

  function install(options) {
    if (isInstalled) {
      return;
    }
    if (!options || typeof options.ensureMermaid !== "function") {
      return;
    }

    ensureMermaid = options.ensureMermaid;

    const interactionApi = getInteractionApi();
    if (interactionApi && typeof interactionApi.installPreviewDoubleClickGuard === "function") {
      interactionApi.installPreviewDoubleClickGuard();
    }

    window.addEventListener("DOMContentLoaded", scheduleRender);
    window.addEventListener("load", scheduleRender);
    document.addEventListener("vscode.markdown.updateContent", scheduleRender);
    isInstalled = true;
  }

  mermaidToolkit.renderer = {
    install,
    scheduleRender,
  };
})();
