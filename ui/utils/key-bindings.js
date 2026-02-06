// Key binding management for TUI
export class KeyBindings {
  constructor(screen) {
    this.screen = screen;
    this.bindings = new Map();
  }

  // Add a key binding
  add(key, callback) {
    this.bindings.set(key, callback);

    // Bind to screen
    this.screen.key([key], callback);
  }

  // Remove a key binding
  remove(key) {
    if (this.bindings.has(key)) {
      this.screen.unkey([key], this.bindings.get(key));
      this.bindings.delete(key);
    }
  }

  // Get all current bindings
  getBindings() {
    return Array.from(this.bindings.keys());
  }

  // Clear all bindings
  clear() {
    for (const [key, callback] of this.bindings) {
      this.screen.unkey([key], callback);
    }
    this.bindings.clear();
  }

  // Enable/disable all bindings
  setEnabled(enabled) {
    // Note: Blessed doesn't have a direct enable/disable,
    // but we can track state and conditionally execute
    this.enabled = enabled;
  }

  // Execute a binding manually (for testing or programmatic use)
  execute(key) {
    if (this.bindings.has(key) && this.enabled !== false) {
      this.bindings.get(key)();
    }
  }
}

// Common key combinations
export const KeyCombos = {
  TAB: 'tab',
  ESCAPE: 'escape',
  ENTER: 'enter',
  SPACE: 'space',
  BACKSPACE: 'backspace',
  DELETE: 'delete',

  // Control combinations
  CTRL_C: 'C-c',
  CTRL_P: 'C-p',
  CTRL_F: 'C-f',
  CTRL_L: 'C-l',
  CTRL_S: 'C-s',
  CTRL_Q: 'C-q',
  CTRL_R: 'C-r',

  // Alt combinations
  ALT_1: 'M-1',
  ALT_2: 'M-2',
  ALT_3: 'M-3',

  // Function keys
  F1: 'f1',
  F2: 'f2',
  F3: 'f3',
  F4: 'f4',
  F5: 'f5',
  F6: 'f6',
  F7: 'f7',
  F8: 'f8',
  F9: 'f9',
  F10: 'f10',
  F11: 'f11',
  F12: 'f12',

  // Arrow keys
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',

  // Page keys
  PAGE_UP: 'pageup',
  PAGE_DOWN: 'pagedown',
  HOME: 'home',
  END: 'end'
};