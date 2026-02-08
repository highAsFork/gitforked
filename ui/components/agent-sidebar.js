import blessed from 'blessed';
import { EventEmitter } from 'events';

class AgentSidebar extends EventEmitter {
  constructor(parent, options = {}) {
    super();
    this.parent = parent;
    this.agents = [];
    this.selectedIndex = 0;

    this.box = blessed.list({
      parent,
      top: options.top || 3,
      left: options.left || 0,
      width: options.width || '20%',
      height: options.height || '100%-7',
      label: ' Agents ',
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        bg: 'black',
        fg: 'white',
        border: { fg: 'cyan' },
        label: { fg: 'cyan', bold: true },
        selected: { bg: 'cyan', fg: 'black', bold: true }
      },
      scrollbar: {
        ch: '█',
        track: { bg: 'gray' },
        style: { bg: 'cyan', fg: 'cyan' }
      },
      mouse: true,
      keys: true,
      vi: true,
      tags: true,
      scrollable: true,
      focusable: true
    });

    this.box.on('select', (item, index) => {
      this._handleSelect(index);
    });

    this.box.key(['enter'], () => {
      this._handleSelect(this.box.selected);
    });

    this.updateList();
  }

  updateAgentList(agents) {
    this.agents = agents;
    this.updateList();
  }

  updateList() {
    const items = [];

    // Team channel entry (always first)
    items.push('{bold}{cyan-fg}# Team Channel{/}');

    // Agent entries
    for (const agent of this.agents) {
      const statusIcon = this.getStatusIcon(agent.status);
      items.push(`${statusIcon} {white-fg}${agent.name}{/}`);
      items.push(`  {gray-fg}${agent.role || agent.provider}{/}`);
    }

    // Add agent action
    items.push('{cyan-fg}[+ Add Agent]{/}');

    this.box.setItems(items);
  }

  getStatusIcon(status) {
    switch (status) {
      case 'idle': return '{green-fg}o{/}';
      case 'thinking': return '{yellow-fg}*{/}';
      case 'tool': return '{cyan-fg}>{/}';
      case 'error': return '{red-fg}!{/}';
      default: return '{gray-fg}o{/}';
    }
  }

  // Map list index → agent array index (each agent = 2 lines starting at index 1)
  _agentFromListIndex(listIndex) {
    if (listIndex <= 0) return null; // team channel
    const addBtnIndex = 1 + this.agents.length * 2;
    if (listIndex >= addBtnIndex) return null; // add button
    const agentIdx = Math.floor((listIndex - 1) / 2);
    return agentIdx < this.agents.length ? this.agents[agentIdx] : null;
  }

  _handleSelect(listIndex) {
    this.selectedIndex = listIndex;
    if (listIndex === 0) {
      this.emit('select-team-channel');
    } else {
      const addBtnIndex = 1 + this.agents.length * 2;
      if (listIndex >= addBtnIndex) {
        this.emit('add-agent');
      } else {
        const agent = this._agentFromListIndex(listIndex);
        if (agent) this.emit('select-agent', agent);
      }
    }
  }

  getSelectedAgent() {
    return this._agentFromListIndex(this.selectedIndex);
  }

  focus() {
    this.box.focus();
  }

  show() {
    this.box.show();
  }

  hide() {
    this.box.hide();
  }
}

export { AgentSidebar };
