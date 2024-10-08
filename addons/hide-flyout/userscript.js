export default async function ({ addon, console, msg }) {
  let placeHolderDiv = null;
  let lockObject = null;
  let lockButton = null;
  let lockIcon = null;

  let flyOut = null;
  let scrollBar = null;

  let toggle = false;
  let flyoutLocked = false;
  let closeOnMouseUp = false;
  let scrollAnimation = true;

  const SVG_NS = "http://www.w3.org/2000/svg";

  const Blockly = await addon.tab.traps.getBlockly();

  function getSpeedValue() {
    let data = {
      none: "0",
      short: "0.2",
      default: "0.3",
      long: "0.5",
    };
    return data[addon.settings.get("speed")];
  }

  function getToggleSetting() {
    return addon.settings.get("toggle");
  }

  function setTransition(speed) {
    for (let element of [flyOut, scrollBar]) {
      element.style.transitionDuration = `${speed}s`;
    }
  }

  function removeTransition() {
    for (let element of [flyOut, scrollBar]) {
      element.style.removeProperty("transition-duration");
    }
  }

  function updateLockDisplay() {
    lockObject.classList.toggle("locked", flyoutLocked);
    lockButton.title = flyoutLocked ? msg("unlock") : msg("lock");
    lockIcon.src = addon.self.dir + `/${flyoutLocked ? "" : "un"}lock.svg`;
  }

  function initFlyoutState() {
    const option = addon.settings.get("lockLoad");
    if (option) {
      if (getToggleSetting() === "category") {
        toggle = true;
      } else {
        flyoutLocked = true;
        updateLockDisplay();
      }
      flyOut.classList.remove("sa-flyoutClose");
      scrollBar.classList.remove("sa-flyoutClose");
    }
  }

  function openFlyout(e, speed = {}) {
    // If a mouse event was passed, only open flyout if the workspace isn't being dragged
    if (
      !e ||
      e.buttons === 0 ||
      document.querySelector(".blocklyToolboxDiv").className.includes("blocklyToolboxDelete")
    ) {
      speed = typeof speed === "object" ? getSpeedValue() : speed;
      setTransition(speed);
      flyOut.classList.remove("sa-flyoutClose");
      scrollBar.classList.remove("sa-flyoutClose");
      setTimeout(() => {
        addon.tab.traps.getWorkspace()?.recordCachedAreas();
        removeTransition();
      }, speed * 1000);
    }
    closeOnMouseUp = false; // only close if the mouseup event happens outside the flyout
  }

  function closeFlyout(e, speed = getSpeedValue()) {
    // locked palette, inputting text, and hovering over dropdown menu do not close palette
    const widget = Blockly.WidgetDiv.owner_;
    const dropdown = Blockly.DropDownDiv.owner_;
    const widgetOpenedFromFlyout =
      (widget === Blockly.ContextMenu && widget.currentBlock?.isInFlyout) ||
      (widget instanceof Blockly.Field && widget.sourceBlock_?.isInFlyout);
    const dropdownOpenedFromFlyout =
      dropdown?.isInFlyout || (dropdown instanceof Blockly.Field && dropdown.sourceBlock_?.isInFlyout);
    const widgetOrDropdownOpenedFromFlyout = widgetOpenedFromFlyout || dropdownOpenedFromFlyout;
    // Don't forget to close when the mouse leaves the flyout even when clicking off of a dropdown or input
    if (widgetOrDropdownOpenedFromFlyout) closeOnMouseUp = true;
    if (
      flyoutLocked ||
      ((Blockly.WidgetDiv.isVisible() || Blockly.DropDownDiv.isVisible()) && widgetOrDropdownOpenedFromFlyout) // If the dropdown or input came outside of the flyout, do not keep open the flyout when cursor leaves
    )
      return;
    if (e && e.buttons) {
      // dragging a block or scrollbar
      closeOnMouseUp = true;
      return;
    }
    setTransition(speed);
    flyOut.classList.add("sa-flyoutClose");
    scrollBar.classList.add("sa-flyoutClose");
    setTimeout(() => {
      addon.tab.traps.getWorkspace()?.recordCachedAreas();
      removeTransition();
    }, speed * 1000);
  }

  const updateIsFullScreen = () => {
    const isFullScreen = addon.tab.redux.state.scratchGui.mode.isFullScreen;
    document.documentElement.classList.toggle("sa-hide-flyout-not-fullscreen", !isFullScreen);
  };
  updateIsFullScreen();

  let didOneTimeSetup = false;
  function doOneTimeSetup() {
    if (didOneTimeSetup) {
      return;
    }
    didOneTimeSetup = true;

    addon.tab.redux.initialize();
    addon.tab.redux.addEventListener("statechanged", (e) => {
      switch (e.detail.action.type) {
        // Event casted when you switch between tabs
        case "scratch-gui/navigation/ACTIVATE_TAB": {
          // always 0, 1, 2
          const toggleSetting = getToggleSetting();
          if (
            e.detail.action.activeTabIndex === 0 &&
            !addon.self.disabled &&
            (toggleSetting === "hover" || toggleSetting === "cathover")
          ) {
            closeFlyout(null, 0);
            toggle = false;
          }
          break;
        }
        case "scratch-gui/mode/SET_FULL_SCREEN":
          updateIsFullScreen();
          break;
      }
    });

    document.body.addEventListener("mouseup", () => {
      if (closeOnMouseUp) {
        closeOnMouseUp = false;
        closeFlyout();
      }
    });

    if (addon.self.enabledLate && getToggleSetting() === "category" && !addon.settings.get("lockLoad")) {
      Blockly.getMainWorkspace().getToolbox().selectedItem_.setSelected(false);
    }
    addon.self.addEventListener("disabled", () => {
      Blockly.getMainWorkspace().getToolbox().selectedItem_.setSelected(true);
    });
    addon.self.addEventListener("reenabled", () => {
      if (getToggleSetting() === "category" && !addon.settings.get("lockLoad")) {
        Blockly.getMainWorkspace().getToolbox().selectedItem_.setSelected(false);
        closeFlyout(null, 0);
        toggle = false;
      }
    });

    addon.settings.addEventListener("change", () => {
      if (addon.self.disabled) return;
      if (getToggleSetting() === "category") {
        // switching to category click mode
        // close the flyout unless it's locked
        if (flyoutLocked) {
          toggle = true;
          flyoutLocked = false;
          updateLockDisplay();
        } else {
          Blockly.getMainWorkspace().getToolbox().selectedItem_.setSelected(false);
          closeFlyout(null, 0);
          toggle = false;
        }
      } else {
        // switching from category click to a different mode
        if (addon.settings.get("lockLoad")) {
          flyoutLocked = true;
          updateLockDisplay();
        } else {
          closeFlyout();
        }
        Blockly.getMainWorkspace().getToolbox().selectedItem_.setSelected(true);
      }
    });

    const oldShowPositionedByBlock = Blockly.DropDownDiv.showPositionedByBlock;
    Blockly.DropDownDiv.showPositionedByBlock = function (owner, block, ...args) {
      const result = oldShowPositionedByBlock.call(this, owner, block, ...args);
      // Scratch incorrectly sets owner_ to the DropDownDiv itself
      if (owner instanceof Blockly.Field) Blockly.DropDownDiv.owner_ = owner;
      else Blockly.DropDownDiv.owner_ = block;
      return result;
    };

    // category click mode
    const oldSetSelectedItem = Blockly.Toolbox.prototype.setSelectedItem;
    Blockly.Toolbox.prototype.setSelectedItem = function (item, shouldScroll = true) {
      const previousSelection = this.selectedItem_;
      oldSetSelectedItem.call(this, item, shouldScroll);
      if (addon.self.disabled || getToggleSetting() !== "category") return;
      if (!shouldScroll) {
        // ignore initial selection when updating the toolbox
        item.setSelected(toggle);
      } else if (item === previousSelection) {
        toggle = !toggle;
        if (toggle) openFlyout();
        else {
          closeFlyout();
          item.setSelected(false);
        }
      } else if (!toggle) {
        scrollAnimation = false;
        toggle = true;
        openFlyout();
      }
    };

    const oldSelectCategoryById = Blockly.Toolbox.prototype.selectCategoryById;
    Blockly.Toolbox.prototype.selectCategoryById = function (...args) {
      // called after populating the toolbox
      // ignore if the palette is closed
      if (!addon.self.disabled && getToggleSetting() === "category" && !toggle) return;
      return oldSelectCategoryById.call(this, ...args);
    };

    const oldStepScrollAnimation = Blockly.Flyout.prototype.stepScrollAnimation;
    Blockly.Flyout.prototype.stepScrollAnimation = function () {
      // scrolling should not be animated when opening the flyout in category click mode
      if (!scrollAnimation) {
        this.scrollbar_.set(this.scrollTarget);
        this.scrollTarget = null;
        scrollAnimation = true;
        return;
      }
      oldStepScrollAnimation.call(this);
    };
  }

  while (true) {
    flyOut = await addon.tab.waitForElement(".blocklyFlyout", {
      markAsSeen: true,
      reduxEvents: [
        "scratch-gui/mode/SET_PLAYER",
        "scratch-gui/locales/SELECT_LOCALE",
        "scratch-gui/theme/SET_THEME",
        "fontsLoaded/SET_FONTS_LOADED",
      ],
      reduxCondition: (state) => !state.scratchGui.mode.isPlayerOnly,
    });
    scrollBar = document.querySelector(".blocklyFlyoutScrollbar");
    const blocksWrapper = document.querySelector('[class*="gui_blocks-wrapper_"]');
    const injectionDiv = document.querySelector(".injectionDiv");

    // Code editor left border
    const borderElement1 = document.createElement("div");
    borderElement1.className = "sa-flyout-border-1";
    addon.tab.displayNoneWhileDisabled(borderElement1);
    injectionDiv.appendChild(borderElement1);
    const borderElement2 = document.createElement("div");
    borderElement2.className = "sa-flyout-border-2";
    addon.tab.displayNoneWhileDisabled(borderElement2);
    injectionDiv.appendChild(borderElement2);

    // Placeholder Div
    if (placeHolderDiv) placeHolderDiv.remove();
    placeHolderDiv = document.createElement("div");
    blocksWrapper.appendChild(placeHolderDiv);
    placeHolderDiv.className = "sa-flyout-placeHolder";
    placeHolderDiv.style.display = "none"; // overridden by userstyle if the addon is enabled

    // Lock image
    if (lockObject) lockObject.remove();
    lockObject = document.createElementNS(SVG_NS, "foreignObject");
    lockObject.setAttribute("class", "sa-lock-object");
    lockObject.style.display = "none"; // overridden by userstyle if the addon is enabled
    lockButton = document.createElement("button");
    lockButton.className = "sa-lock-button";
    lockIcon = document.createElement("img");
    lockIcon.alt = "";
    updateLockDisplay();
    lockButton.onclick = () => {
      flyoutLocked = !flyoutLocked;
      updateLockDisplay();
    };
    lockButton.appendChild(lockIcon);
    lockObject.appendChild(lockButton);
    flyOut.appendChild(lockObject);

    closeFlyout(null, 0);
    toggle = false;

    const toolbox = document.querySelector(".blocklyToolboxDiv");
    const addExtensionButton = document.querySelector("[class^=gui_extension-button-container_]");

    for (let element of [toolbox, addExtensionButton, flyOut, scrollBar]) {
      element.onmouseenter = (e) => {
        const toggleSetting = getToggleSetting();
        if (!addon.self.disabled && (toggleSetting === "hover" || toggleSetting === "cathover")) openFlyout(e);
      };
      element.onmouseleave = (e) => {
        const toggleSetting = getToggleSetting();
        if (!addon.self.disabled && (toggleSetting === "hover" || toggleSetting === "cathover")) closeFlyout(e);
      };
    }
    placeHolderDiv.onmouseenter = (e) => {
      if (!addon.self.disabled && getToggleSetting() === "hover") openFlyout(e);
    };
    placeHolderDiv.onmouseleave = (e) => {
      if (!addon.self.disabled && getToggleSetting() === "hover") closeFlyout(e);
    };

    doOneTimeSetup();
    initFlyoutState();
    Blockly.svgResize(Blockly.getMainWorkspace());
  }
}
