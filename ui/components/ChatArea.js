import React, { useEffect, useRef } from 'react';
import { Box, Text } from 'ink';

export function ChatArea({ messages }) {
  const scrollRef = useRef();

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      // Ink doesn't have direct scroll control, but we can manage message display
    }
  }, [messages]);

  const formatMessage = (message) => {
    const prefix = getMessagePrefix(message.type);
    return `${prefix}${message.content}`;
  };

  const getMessagePrefix = (type) => {
    switch (type) {
      case 'user':
        return 'You: ';
      case 'assistant':
        return 'Grok: ';
      case 'system':
        return 'System: ';
      default:
        return '';
    }
  };

  const getMessageColor = (type) => {
    switch (type) {
      case 'user':
        return 'white';
      case 'assistant':
        return '#E0E0E0';
      case 'system':
        return '#00CED1';
      default:
        return 'white';
    }
  };

  return React.createElement(
    Box,
    { flexDirection: "column", flexGrow: 1, paddingX: 1 },
    messages.slice(-50).map((message) =>
      React.createElement(
        Box,
        { key: message.id, marginY: 0.5 },
        React.createElement(
          Text,
          { color: getMessageColor(message.type) },
          formatMessage(message)
        )
      )
    )
  );
}