(() => {
  const MERMAID_SELECTOR = "pre > code.language-mermaid";
  const PROCESSED_ATTR = "data-markdown-toolkit-mermaid-processed";
  const BODY_FOCUS_CLASS = "markdown-toolkit-mermaid-focus-active";
  const WRAPPER_FOCUS_CLASS = "is-focus-mode";
  const SCALE_MIN = 0.25;
  const SCALE_MAX = 4;
  const SCALE_STEP = 1.2;
  const MAX_TEXT_SIZE = 200000;
  const FLOWCHART_WRAPPING_WIDTH = 360;

  let mermaidReady = false;
  let diagramId = 0;
  let isScheduled = false;
  let activeFocusState = null;

  function ensureMermaid() {
    if (mermaidReady) {
      return true;
    }

    if (typeof mermaid === "undefined") {
      return false;
    }

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      maxTextSize: MAX_TEXT_SIZE,
      markdownAutoWrap: true,
      flowchart: {
        htmlLabels: true,
        wrappingWidth: FLOWCHART_WRAPPING_WIDTH,
      },
    });

    mermaidReady = true;
    return true;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function parseSize(sizeText) {
    if (!sizeText) {
      return Number.NaN;
    }

    const size = Number.parseFloat(sizeText);
    return Number.isFinite(size) ? size : Number.NaN;
  }

  function resolveSvgSize(svg) {
    const box = svg.viewBox && svg.viewBox.baseVal;
    const viewBoxWidth = box && Number.isFinite(box.width) ? box.width : Number.NaN;
    const viewBoxHeight = box && Number.isFinite(box.height) ? box.height : Number.NaN;

    const attributeWidth = parseSize(svg.getAttribute("width"));
    const attributeHeight = parseSize(svg.getAttribute("height"));

    const measuredRect = svg.getBoundingClientRect();
    const measuredWidth = measuredRect.width;
    const measuredHeight = measuredRect.height;

    const baseWidth =
      (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0 && viewBoxWidth) ||
      (Number.isFinite(attributeWidth) && attributeWidth > 0 && attributeWidth) ||
      (Number.isFinite(measuredWidth) && measuredWidth > 0 && measuredWidth) ||
      800;

    const baseHeight =
      (Number.isFinite(viewBoxHeight) && viewBoxHeight > 0 && viewBoxHeight) ||
      (Number.isFinite(attributeHeight) && attributeHeight > 0 && attributeHeight) ||
      (Number.isFinite(measuredHeight) && measuredHeight > 0 && measuredHeight) ||
      400;

    return { baseWidth, baseHeight };
  }

  function updateScale(state) {
    state.svg.style.width = `${state.baseWidth * state.scale}px`;
    state.svg.style.height = `${state.baseHeight * state.scale}px`;
    state.scaleLabel.textContent = `${Math.round(state.scale * 100)}%`;
  }

  function setScale(state, viewport, targetScale, anchorX, anchorY) {
    const nextScale = clamp(targetScale, SCALE_MIN, SCALE_MAX);
    if (nextScale === state.scale) {
      return;
    }

    const contentWidthBefore = state.baseWidth * state.scale;
    const contentHeightBefore = state.baseHeight * state.scale;
    const contentXRatio = (viewport.scrollLeft + anchorX) / contentWidthBefore;
    const contentYRatio = (viewport.scrollTop + anchorY) / contentHeightBefore;

    state.scale = nextScale;
    updateScale(state);

    const contentWidthAfter = state.baseWidth * state.scale;
    const contentHeightAfter = state.baseHeight * state.scale;

    viewport.scrollLeft = contentXRatio * contentWidthAfter - anchorX;
    viewport.scrollTop = contentYRatio * contentHeightAfter - anchorY;
  }

  function createButton(label, title, clickHandler) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "markdown-toolkit-mermaid-button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", clickHandler);
    return button;
  }

  function resetViewport(state, viewport) {
    state.scale = 1;
    updateScale(state);
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
  }

  function fitViewport(state, viewport) {
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, viewport.clientHeight - 24);
    const fitScale = clamp(Math.min(availableWidth / state.baseWidth, availableHeight / state.baseHeight), SCALE_MIN, SCALE_MAX);

    state.scale = fitScale;
    updateScale(state);

    const scaledWidth = state.baseWidth * state.scale;
    const scaledHeight = state.baseHeight * state.scale;
    viewport.scrollLeft = Math.max(0, (scaledWidth - viewport.clientWidth) / 2);
    viewport.scrollTop = Math.max(0, (scaledHeight - viewport.clientHeight) / 2);
  }

  function setFocusButtonState(state, isFocused) {
    state.focusButton.textContent = isFocused ? "Exit Focus" : "Focus";
    state.focusButton.title = isFocused
      ? "Exit focus mode (Esc)"
      : "Enter focus mode";
  }

  function exitFocusMode() {
    if (!activeFocusState) {
      return;
    }

    const {
      state,
      wrapper,
      overlay,
      sourceParent,
      sourceNextSibling,
      onKeyDown,
      onResize,
      onOverlayClick,
    } = activeFocusState;

    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("resize", onResize);
    overlay.removeEventListener("click", onOverlayClick);

    document.body.classList.remove(BODY_FOCUS_CLASS);
    wrapper.classList.remove(WRAPPER_FOCUS_CLASS);
    setFocusButtonState(state, false);

    if (sourceParent && sourceParent.isConnected) {
      if (sourceNextSibling && sourceNextSibling.parentNode === sourceParent) {
        sourceParent.insertBefore(wrapper, sourceNextSibling);
      } else {
        sourceParent.appendChild(wrapper);
      }
    }

    overlay.remove();
    activeFocusState = null;
  }

  function enterFocusMode(state, wrapper, viewport) {
    if (activeFocusState) {
      if (activeFocusState.wrapper === wrapper) {
        return;
      }
      exitFocusMode();
    }

    if (!wrapper.parentNode) {
      return;
    }

    const sourceParent = wrapper.parentNode;
    const sourceNextSibling = wrapper.nextSibling;
    const overlay = document.createElement("div");
    overlay.className = "markdown-toolkit-mermaid-focus-overlay";

    const hint = document.createElement("div");
    hint.className = "markdown-toolkit-mermaid-focus-hint";
    hint.textContent = "Double-click or press Esc to exit focus mode";
    overlay.append(hint);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        exitFocusMode();
      }
    };

    const onResize = () => {
      if (!activeFocusState || activeFocusState.wrapper !== wrapper) {
        return;
      }
      fitViewport(state, viewport);
    };

    const onOverlayClick = (event) => {
      if (event.target === overlay) {
        exitFocusMode();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onResize);
    overlay.addEventListener("click", onOverlayClick);

    document.body.classList.add(BODY_FOCUS_CLASS);
    wrapper.classList.add(WRAPPER_FOCUS_CLASS);
    setFocusButtonState(state, true);

    document.body.append(overlay);
    overlay.append(wrapper);

    activeFocusState = {
      state,
      wrapper,
      overlay,
      sourceParent,
      sourceNextSibling,
      onKeyDown,
      onResize,
      onOverlayClick,
    };

    window.requestAnimationFrame(() => {
      if (!activeFocusState || activeFocusState.wrapper !== wrapper) {
        return;
      }
      fitViewport(state, viewport);
    });
  }

  function toggleFocusMode(state, wrapper, viewport) {
    if (activeFocusState && activeFocusState.wrapper === wrapper) {
      exitFocusMode();
      return;
    }

    enterFocusMode(state, wrapper, viewport);
  }

  function attachInteraction(wrapper, viewport, svg) {
    const { baseWidth, baseHeight } = resolveSvgSize(svg);

    const toolbar = document.createElement("div");
    toolbar.className = "markdown-toolkit-mermaid-toolbar";

    const state = {
      baseWidth,
      baseHeight,
      scale: 1,
      svg,
      scaleLabel: document.createElement("span"),
      focusButton: document.createElement("button"),
    };

    state.scaleLabel.className = "markdown-toolkit-mermaid-scale";

    const minusButton = createButton("-", "Zoom out", () => {
      setScale(state, viewport, state.scale / SCALE_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
    });
    const plusButton = createButton("+", "Zoom in", () => {
      setScale(state, viewport, state.scale * SCALE_STEP, viewport.clientWidth / 2, viewport.clientHeight / 2);
    });
    const resetButton = createButton("Reset", "Reset zoom and position", () => {
      resetViewport(state, viewport);
    });
    state.focusButton = createButton("Focus", "Enter focus mode", () => {
      toggleFocusMode(state, wrapper, viewport);
    });
    state.focusButton.classList.add("markdown-toolkit-mermaid-focus-button");

    toolbar.append(minusButton, plusButton, state.scaleLabel, resetButton, state.focusButton);
    wrapper.prepend(toolbar);

    updateScale(state);

    viewport.addEventListener(
      "wheel",
      (event) => {
        if (!(event.ctrlKey || event.metaKey)) {
          return;
        }

        event.preventDefault();

        const zoomFactor = event.deltaY < 0 ? SCALE_STEP : 1 / SCALE_STEP;
        const rect = viewport.getBoundingClientRect();
        setScale(
          state,
          viewport,
          state.scale * zoomFactor,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
      },
      { passive: false },
    );

    let dragging = null;

    viewport.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      dragging = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };

      viewport.classList.add("is-dragging");
      viewport.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragging.startX;
      const deltaY = event.clientY - dragging.startY;
      viewport.scrollLeft = dragging.scrollLeft - deltaX;
      viewport.scrollTop = dragging.scrollTop - deltaY;
    });

    const stopDragging = (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      if (viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      viewport.classList.remove("is-dragging");
      dragging = null;
    };

    viewport.addEventListener("pointerup", stopDragging);
    viewport.addEventListener("pointercancel", stopDragging);
    viewport.addEventListener("pointerleave", (event) => {
      if (dragging && event.pointerId === dragging.pointerId && !(event.buttons & 1)) {
        stopDragging(event);
      }
    });

    viewport.addEventListener("dblclick", (event) => {
      event.preventDefault();
      toggleFocusMode(state, wrapper, viewport);
    });
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

      attachInteraction(wrapper, viewport, svg);
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
    if (!ensureMermaid()) {
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

    if (activeFocusState) {
      exitFocusMode();
    }

    isScheduled = true;
    window.requestAnimationFrame(() => {
      isScheduled = false;
      void renderAllMermaid();
    });
  }

  window.addEventListener("DOMContentLoaded", scheduleRender);
  window.addEventListener("load", scheduleRender);
  document.addEventListener("vscode.markdown.updateContent", scheduleRender);
})();
