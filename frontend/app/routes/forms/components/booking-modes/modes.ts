import { modeFor, type ModeName } from '@internal/booking';
import type { EditorMode } from './editor-mode';
import { individualEditor } from './individual';
import { servicesEditor } from './services';

export const editors: Record<ModeName, EditorMode> = {
  individual: individualEditor,
  services: servicesEditor,
};

export const editorModes = Object.values(editors);

export const editorFor = (name?: string): EditorMode =>
  editors[modeFor(name).name];
