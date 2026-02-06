import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  mode: 'Plan' | 'Build';
  model: string;
  directory: string;
  focusTarget: 'chat' | 'files';
}

export function StatusBar({ mode, model, directory, focusTarget }: StatusBarProps) {
  const dirName = directory.split('/').pop() || '/';

  return React.createElement(
    Box,
    {
      borderStyle: "single",
      borderColor: "#00CED1",
      paddingX: 1,
      backgroundColor: "#001a1a"
    },
    React.createElement(
      Text,
      { color: "white" },
      "🔄 Mode: ",
      React.createElement(Text, { bold: true, color: "#00CED1" }, mode),
      " | 🤖 Model: ",
      React.createElement(Text, { bold: true }, model),
      " | 📁 Dir: ",
      dirName,
      " | 🎯 Focus: ",
      React.createElement(
        Text,
        { color: focusTarget === 'chat' ? '#00CED1' : '#FFFFFF' },
        focusTarget === 'chat' ? 'Chat' : 'Files'
      ),
      " | ⌨️ Use commands (shortcuts disabled)"
    )
  );
}