import React from 'react';
import { CalculatorPlugin } from './Calculator';
import { ConnectionPlugin } from './Connection';

export interface PluginDefinition {
  id: string;
  title: string;
  icon: React.ReactNode;
  component: React.ComponentType<any>;
}

export const PLUGINS: PluginDefinition[] = [
  CalculatorPlugin,
  ConnectionPlugin,
];

export const getPluginById = (id: string | null) => {
    return PLUGINS.find(p => p.id === id);
};
