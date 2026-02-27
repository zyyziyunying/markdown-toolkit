(() => {
  const mermaidToolkit = (window.MarkdownToolkitMermaid = window.MarkdownToolkitMermaid || {});
  const BODY_FOCUS_CLASS = "markdown-toolkit-mermaid-focus-active";
  const WRAPPER_FOCUS_CLASS = "is-focus-mode";

  let activeFocusState = null;

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

  function enterFocusMode(state, wrapper, viewport, fitViewport) {
    if (typeof fitViewport !== "function") {
      return;
    }

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

  function toggleFocusMode(state, wrapper, viewport, fitViewport) {
    if (activeFocusState && activeFocusState.wrapper === wrapper) {
      exitFocusMode();
      return;
    }

    enterFocusMode(state, wrapper, viewport, fitViewport);
  }

  mermaidToolkit.focusMode = {
    exitFocusMode,
    toggleFocusMode,
  };
})();
