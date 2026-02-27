(() => {
  const mermaidToolkit = (window.MarkdownToolkitMermaid = window.MarkdownToolkitMermaid || {});
  const MERMAID_VIEWPORT_SELECTOR = ".markdown-toolkit-mermaid-viewport";
  const SCALE_MIN = 0.25;
  const SCALE_MAX = 4;
  const SCALE_STEP = 1.2;
  const DRAG_THRESHOLD_PX = 4;

  const mermaidDoubleClickHandlers = new WeakMap();

  function getFocusModeApi() {
    return mermaidToolkit.focusMode || null;
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

  function toggleFocusMode(state, wrapper, viewport) {
    const focusModeApi = getFocusModeApi();
    if (!focusModeApi || typeof focusModeApi.toggleFocusMode !== "function") {
      return;
    }

    focusModeApi.toggleFocusMode(state, wrapper, viewport, fitViewport);
  }

  function exitFocusMode() {
    const focusModeApi = getFocusModeApi();
    if (focusModeApi && typeof focusModeApi.exitFocusMode === "function") {
      focusModeApi.exitFocusMode();
    }
  }

  function installPreviewDoubleClickGuard() {
    window.addEventListener(
      "dblclick",
      (event) => {
        if (event.button !== 0) {
          return;
        }

        const target = event.target;
        if (target instanceof Element) {
          const mermaidViewport = target.closest(MERMAID_VIEWPORT_SELECTOR);
          if (mermaidViewport) {
            const handler = mermaidDoubleClickHandlers.get(mermaidViewport);
            if (typeof handler === "function") {
              event.preventDefault();
              event.stopPropagation();
              handler();
            }
            return;
          }
        }

        // Keep Markdown preview in read mode without overriding global settings.
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );
  }

  function isInteractivePointerTarget(target, viewport) {
    if (!(target instanceof Element)) {
      return false;
    }

    const interactiveElement = target.closest(
      "a, button, input, select, textarea, [role='button'], [role='link'], .clickable, [onclick], [href]",
    );

    return Boolean(interactiveElement && viewport.contains(interactiveElement));
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
    let suppressClick = false;

    viewport.addEventListener("pointerdown", (event) => {
      suppressClick = false;

      if (event.button !== 0 || event.defaultPrevented) {
        return;
      }

      if (isInteractivePointerTarget(event.target, viewport)) {
        return;
      }

      dragging = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
        didDrag: false,
      };
    });

    viewport.addEventListener("pointermove", (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      const deltaX = event.clientX - dragging.startX;
      const deltaY = event.clientY - dragging.startY;

      if (!dragging.didDrag) {
        if (Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD_PX) {
          return;
        }

        dragging.didDrag = true;
        viewport.classList.add("is-dragging");
        viewport.setPointerCapture(event.pointerId);
      }

      event.preventDefault();
      viewport.scrollLeft = dragging.scrollLeft - deltaX;
      viewport.scrollTop = dragging.scrollTop - deltaY;
    });

    const stopDragging = (event) => {
      if (!dragging || event.pointerId !== dragging.pointerId) {
        return;
      }

      const didDrag = dragging.didDrag;

      if (didDrag && viewport.hasPointerCapture(event.pointerId)) {
        viewport.releasePointerCapture(event.pointerId);
      }

      if (didDrag) {
        viewport.classList.remove("is-dragging");
        suppressClick = true;
      }
      dragging = null;
    };

    viewport.addEventListener("pointerup", stopDragging);
    viewport.addEventListener("pointercancel", stopDragging);
    viewport.addEventListener("pointerleave", (event) => {
      if (dragging && event.pointerId === dragging.pointerId && !(event.buttons & 1)) {
        stopDragging(event);
      }
    });
    viewport.addEventListener(
      "click",
      (event) => {
        if (!suppressClick) {
          return;
        }

        suppressClick = false;
        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );

    mermaidDoubleClickHandlers.set(viewport, () => {
      toggleFocusMode(state, wrapper, viewport);
    });
  }

  mermaidToolkit.interaction = {
    attachInteraction,
    exitFocusMode,
    installPreviewDoubleClickGuard,
  };
})();
