import React from 'react';
import { TerminalPlugin } from './Terminal';
import { CalculatorPlugin } from './Calculator';
import { ConnectionPlugin } from './Connection';

export interface PluginDefinition {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
}

export const PLUGINS: PluginDefinition[] = [
  TerminalPlugin,
  CalculatorPlugin,
  ConnectionPlugin,
];

export const getPluginById = (id: string | null) => {
    return PLUGINS.find(p => p.id === id);
};
