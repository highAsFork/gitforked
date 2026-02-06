import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import fs from 'fs/promises';
import path from 'path';

export function FileTree({ directory, focused, onDirectoryChange }) {
  const [files, setFiles] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    loadDirectory();
  }, [directory]);

  const loadDirectory = async () => {
    try {
      const items = await fs.readdir(directory, { withFileTypes: true });
      const fileItems = [
        {
          name: '..',
          path: path.dirname(directory),
          isDirectory: true
        },
        ...items.map(item => ({
          name: item.name,
          path: path.join(directory, item.name),
          isDirectory: item.isDirectory()
        }))
      ];
      setFiles(fileItems);
      setSelectedIndex(0);
    } catch (error) {
      // Handle error
    }
  };

  useInput((input, key) => {
    if (!focused) return;

    if (key.upArrow) {
      setSelectedIndex(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => Math.min(files.length - 1, prev + 1));
    } else if (key.return) {
      const selectedFile = files[selectedIndex];
      if (selectedFile?.isDirectory) {
        onDirectoryChange(selectedFile.path);
      }
    }
  });

  const getIcon = (item) => {
    if (item.name === '..') return '⬆️';
    if (item.isDirectory) return '📁';
    return '📄';
  };

  const getDisplayName = (item) => {
    return item.isDirectory ? `${item.name}/` : item.name;
  };

  return React.createElement(
    Box,
    { flexDirection: "column", paddingX: 1 },
    React.createElement(
      Text,
      { bold: true, color: "#00CED1" },
      `Files: ${path.basename(directory) || '/'}`
    ),
    React.createElement(
      Box,
      { flexDirection: "column", marginTop: 1 },
      files.map((file, index) =>
        React.createElement(
          Box,
          { key: `${file.path}-${index}` },
          React.createElement(
            Text,
            {
              color: focused && index === selectedIndex ? '#00CED1' : 'white',
              backgroundColor: focused && index === selectedIndex ? '#001a1a' : undefined
            },
            `${getIcon(file)} ${getDisplayName(file)}`
          )
        )
      )
    )
  );
}