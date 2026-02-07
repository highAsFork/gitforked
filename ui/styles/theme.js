// gitforked TUI Theme - Teal Blue on Dark Background
export const Theme = {
  // Main screen settings
  screen: {
    bg: '#000000', // Pure black background
    fg: '#FFFFFF'  // White text
  },

  // Main container
  mainContainer: {
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    bg: '#000000'
  },

  // Content area (chat + file browser)
  contentBox: {
    top: 3, // Below status bar
    left: 0,
    width: '100%',
    height: '100%-3',
    bg: '#000000'
  },

  // Status bar
  statusBar: {
    top: 0,
    left: 0,
    width: '100%',
    height: 3,
    bg: '#000000', // Black background
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1' // Teal blue border
    }
  },

  // Chat panel
  chatPanel: {
    bg: '#000000', // Black for main chat area
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1' // Teal blue border
    },
    scrollbar: {
      bg: '#333333',
      fg: '#00CED1'
    }
  },

  // Chat input
  chatInput: {
    bg: '#333333', // Grey for input area
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1'
    },
    focus: {
      border: {
        fg: '#40E0D0' // Lighter teal for focus
      }
    }
  },

  // Chat messages
  chatMessage: {
    user: {
      fg: '#FFFFFF',
      bg: '#000000'
    },
    assistant: {
      fg: '#FFFFFF', // White for AI
      bg: '#000000'
    },
    system: {
      fg: '#00CED1', // Teal for system messages
      bg: '#000000'
    },
    task: {
      fg: '#FFFFFF',
      bg: '#333333', // Darker grey for task boxes
      border: {
        fg: '#00CED1'
      }
    }
  },

  // File browser
  fileBrowser: {
    bg: '#000000',
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1'
    },
    selected: {
      bg: '#00CED1',
      fg: '#000000',
      bold: true
    },
    directory: {
      fg: '#00CED1'
    },
    file: {
      fg: '#FFFFFF'
    }
  },

  // Model selector
  modelSelector: {
    bg: '#000000',
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1'
    },
    selected: {
      bg: '#00CED1',
      fg: '#000000',
      bold: true
    }
  },

  // Syntax highlighting colors (for code in chat)
  syntax: {
    keyword: '#FF6B6B',    // Red for keywords
    string: '#98FB98',     // Light green for strings
    comment: '#696969',    // Dim gray for comments
    number: '#DDA0DD',     // Plum for numbers
    function: '#00CED1',   // Teal for functions
    variable: '#FFFFFF',   // White for variables
    operator: '#FFD700'    // Gold for operators
  },

  // Error and success colors
  error: {
    fg: '#FF6B6B', // Red
    bg: '#000000'
  },
  success: {
    fg: '#51CF66', // Green
    bg: '#000000'
  },
  warning: {
    fg: '#FFD700', // Gold
    bg: '#000000'
  },

  // Highlight colors for bullet points and numbers
  highlight: {
    fg: '#FFFFFF', // White text
    bg: '#00CED1'  // Teal blue background
  },

  // Agent sidebar
  agentSidebar: {
    bg: '#000000',
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1'
    },
    selected: {
      bg: '#00CED1',
      fg: '#000000',
      bold: true
    },
    teamChannel: {
      fg: '#00CED1',
      bold: true
    },
    agentIdle: '#51CF66',
    agentThinking: '#FFD700',
    agentError: '#FF6B6B'
  },

  // Team channel
  teamChannel: {
    bg: '#000000',
    fg: '#FFFFFF',
    border: {
      type: 'line',
      fg: '#00CED1'
    },
    agentColors: [
      '#00CED1', // Teal
      '#51CF66', // Green
      '#FFD700', // Gold
      '#FF6B6B', // Red
      '#DDA0DD', // Plum
      '#87CEEB', // Sky blue
      '#FFA500', // Orange
      '#98FB98', // Pale green
      '#FF69B4'  // Hot pink
    ]
  },

  // Border styles
  border: {
    fg: '#00CED1',
    type: 'line'
  },

  // Focus styles
  focus: {
    border: {
      fg: '#40E0D0' // Lighter teal
    }
  }
};

// Utility function to apply theme to blessed elements
export function applyTheme(element, themeKey) {
  const theme = Theme[themeKey];
  if (theme) {
    Object.assign(element, theme);
  }
  return element;
}