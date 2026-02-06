import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

interface ModelSelectorProps {
  onSelect: (model: string) => void;
  onCancel: () => void;
}

const AVAILABLE_MODELS = [
  'grok-4-1-fast-reasoning',
  'grok-4-latest',
  'grok-4-1-fast-non-reasoning',
  'grok-4-1-fast',
  'grok-4',
  'grok-beta'
];

export function ModelSelector({ onSelect, onCancel }: ModelSelectorProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (value: string) => {
    const model = value.trim();
    if (model === 'cancel') {
      onCancel();
    } else if (AVAILABLE_MODELS.includes(model)) {
      onSelect(model);
    } else {
      // Invalid model, just cancel
      onCancel();
    }
  };

  return React.createElement(
    Box,
    {
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: 0,
      left: 0
    },
    React.createElement(
      Box,
      {
        borderStyle: "single",
        borderColor: "#00CED1",
        paddingX: 2,
        paddingY: 1,
        backgroundColor: "#000000"
      },
      React.createElement(
        Text,
        { bold: true, color: "#00CED1", textWrap: "wrap" },
        "Select Model"
      ),
      React.createElement(Text, {}, " "),
      AVAILABLE_MODELS.map((model, index) =>
        React.createElement(
          Box,
          { key: model },
          React.createElement(
            Text,
            {
              color: index === selectedIndex ? '#00CED1' : 'white',
              backgroundColor: index === selectedIndex ? '#001a1a' : undefined
            },
            `${index === selectedIndex ? '▶ ' : '  '}${model}`
          )
        )
      ),
      React.createElement(Text, {}, " "),
      React.createElement(
        Text,
        { dimColor: true },
        "Type a model name below to select it, or 'cancel' to close"
      ),
      React.createElement(Box, { marginTop: 1 },
        React.createElement(Text, { color: "cyan" }, "Model: "),
        React.createElement(TextInput, {
          value: inputValue,
          onChange: setInputValue,
          onSubmit: handleSubmit,
          placeholder: "grok-4-1-fast-reasoning"
        })
      )
    )
  );
}