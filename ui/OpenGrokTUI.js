// Simple TUI demo that works without complex components
import React, { useState, useCallback, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import TextInput from 'ink-text-input';
import { grokAPI } from '../lib/grok-api.js';
import { Theme } from './styles/theme.js';
import { config } from '../config/config.js';

const getAvailableModels = (provider) => {
  switch (provider) {
    case 'grok':
      return [
        'grok-4-1-fast-reasoning',
        'grok-4-1-fast-reasoning',
        'grok-4-latest',
        'grok-4-1-fast-non-reasoning',
        'grok-4-1-fast',
        'grok-4',
        'grok-beta'
      ];
    case 'groq':
      return [
        'llama3-8b-8192',
        'llama3-70b-8192',
        'mixtral-8x7b-32768',
        'gemma-7b-it'
      ];
    case 'gemini':
      return ['gemini-pro', 'gemini-pro-vision'];
    case 'claude':
      return ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
    default:
      return ['grok-4-1-fast-reasoning'];
  }
};

function SimpleTUI({ initialModel = 'grok-4-1-fast-reasoning' }) {
  const [currentProvider, setCurrentProvider] = useState('grok'); // Default, but should load from config
  const [currentModel, setCurrentModel] = useState(initialModel);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      type: 'system',
      content: `🎉 Welcome to OpenGrok TUI!\n\nCurrent provider: ${currentProvider}, model: ${currentModel}\n\nType "model" to change model, or start chatting!\nType "exit" to quit.`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [showModels, setShowModels] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { exit } = useApp();

  useEffect(() => {
    const loadConfig = async () => {
      const provider = await config.getProvider();
      const model = await config.getModel();
      setCurrentProvider(provider);
      setCurrentModel(model);
      setMessages(prev => prev.map(msg => msg.id === 'welcome' ? {
        ...msg,
        content: `🎉 Welcome to OpenGrok TUI!\n\nCurrent provider: ${provider}, model: ${model}\n\nType "model" to change model, or start chatting!\nType "exit" to quit.`
      } : msg));
    };
    loadConfig();
  }, []);

  // Function to render message with highlighted bullet points and numbers
  const renderMessage = (content, type) => {
    const lines = content.split('\n');
    const messageTheme = Theme.chatMessage[type] || Theme.chatMessage.assistant;
    return lines.map((line, index) => {
      if (line.match(/^(\s*)([-*•]|\d+\.)/)) {
        // Highlight bullet points or numbered lists
        return React.createElement(
          Text,
          { key: index, backgroundColor: Theme.highlight.bg, color: Theme.highlight.fg },
          line + '\n'
        );
      }
      return React.createElement(Text, { key: index, color: messageTheme.fg }, line + '\n');
    });
  };

  const handleSubmit = useCallback((value) => {
    if (!value.trim()) return;

    // Add user message
    setMessages(prev => [...prev, {
      id: `user-${Date.now()}`,
      type: 'user',
      content: value,
      timestamp: new Date()
    }]);

    setInputValue('');

    if (value.toLowerCase() === 'exit') {
      exit();
      return;
    }

    if (value.toLowerCase() === 'model') {
      setShowModels(true);
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          type: 'system',
          content: '📋 Available Models:\n' + getAvailableModels(currentProvider).map(m => `• ${m}`).join('\n') + '\n\nType a model name to select it, or "cancel" to exit.',
          timestamp: new Date()
        }]);
      return;
    }

    // Check if it's a model selection
    if (showModels) {
      const trimmedValue = value.trim().toLowerCase();
      if (trimmedValue === 'cancel') {
        setShowModels(false);
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          type: 'system',
          content: '❌ Model selection cancelled. Back to normal chat.',
          timestamp: new Date()
        }]);
        return;
      }

      if (getAvailableModels(currentProvider).includes(value.trim())) {
        const selectedModel = value.trim();
        setCurrentModel(selectedModel);
        setShowModels(false);
        setMessages(prev => [...prev, {
          id: `system-${Date.now()}`,
          type: 'system',
          content: `✅ Model changed to: ${selectedModel}\n\nYou can now chat normally!`,
          timestamp: new Date()
        }]);
        return;
      }

      // If in model selection mode but input is not a valid model or cancel, show error
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        type: 'system',
        content: `❌ "${value}" is not a valid model. Type a model name from the list above, or "cancel" to exit model selection.`,
        timestamp: new Date()
      }]);
      return;
    }

    // Send message to Grok API
    setIsLoading(true);

    // Simulate API delay
    setTimeout(async () => {
      try {
         const response = await grokAPI.chat(value, {
           model: currentModel,
           directory: process.cwd(),
           mode: 'Plan'
         });

        setMessages(prev => [...prev, {
          id: `grok-${Date.now()}`,
          type: 'assistant',
          content: response,
          timestamp: new Date()
        }]);
      } catch (error) {
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: 'system',
          content: `❌ Error communicating with Grok: ${error.message}`,
          timestamp: new Date()
        }]);
      } finally {
        setIsLoading(false);
      }
    }, 100);
  }, [showModels, currentModel, currentProvider, exit]);

  return React.createElement(
    Box,
    { flexDirection: 'column', height: '100%', backgroundColor: '#000000' },
    React.createElement(
      Box,
      { borderStyle: 'single', borderColor: Theme.border.fg, paddingX: 1, backgroundColor: Theme.statusBar.bg },
      React.createElement(Text, { color: Theme.statusBar.fg, bold: true }, '🎨 OpenGrok TUI')
    ),
    React.createElement(
      Box,
      { flexGrow: 1, paddingX: 1, flexDirection: 'column', backgroundColor: Theme.chatPanel.bg },
      messages.slice(-10).map(msg =>
        React.createElement(
          Box,
          { key: msg.id, marginY: 0.5 },
          renderMessage(msg.content, msg.type)
        )
      )
    ),
    React.createElement(
      Box,
      { borderStyle: 'single', borderColor: Theme.border.fg, backgroundColor: Theme.chatInput.bg },
      React.createElement(Text, { color: 'cyan' }, isLoading ? '⏳ ' : '> '),
      isLoading
        ? React.createElement(Text, { color: 'yellow' }, `Thinking with ${currentProvider}/${currentModel}...`)
        : React.createElement(TextInput, {
            value: inputValue,
            onChange: setInputValue,
            onSubmit: handleSubmit,
            placeholder: showModels ? 'Type a model name or "cancel"...' : 'Ask Grok anything...'
          })
    )
  );
}

// CLI entry point
export async function runTUI(options = {}) {
  console.log('🎯 Starting Simple TUI Demo...');

  // Skip raw mode check for this demo
  console.log('🎨 Rendering Simple TUI Demo...');

  render(React.createElement(SimpleTUI, {
    initialModel: options.model || 'grok-4-1-fast-reasoning'
  }));
}