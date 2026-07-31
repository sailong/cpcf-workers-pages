import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configureLoader: vi.fn(),
  editorWorker: vi.fn(),
  cssWorker: vi.fn(),
  htmlWorker: vi.fn(),
  jsonWorker: vi.fn(),
  typeScriptWorker: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
  loader: { config: mocks.configureLoader },
}));
vi.mock('monaco-editor', () => ({ editor: {} }));
vi.mock('monaco-editor/editor/editor.worker?worker', () => ({ default: mocks.editorWorker }));
vi.mock('monaco-editor/language/css/css.worker?worker', () => ({ default: mocks.cssWorker }));
vi.mock('monaco-editor/language/html/html.worker?worker', () => ({ default: mocks.htmlWorker }));
vi.mock('monaco-editor/language/json/json.worker?worker', () => ({ default: mocks.jsonWorker }));
vi.mock('monaco-editor/language/typescript/ts.worker?worker', () => ({ default: mocks.typeScriptWorker }));

import * as localMonaco from 'monaco-editor';
import './monaco';

type TestMonacoEnvironment = {
  getWorker: (moduleId: string, label: string) => Worker;
};

const environment = () => (globalThis as typeof globalThis & {
  MonacoEnvironment: TestMonacoEnvironment;
}).MonacoEnvironment;

describe('local Monaco configuration', () => {
  beforeEach(() => {
    mocks.editorWorker.mockClear();
    mocks.cssWorker.mockClear();
    mocks.htmlWorker.mockClear();
    mocks.jsonWorker.mockClear();
    mocks.typeScriptWorker.mockClear();
  });

  it('provides the bundled Monaco instance to the React loader', () => {
    expect(mocks.configureLoader).toHaveBeenCalledOnce();
    expect(mocks.configureLoader).toHaveBeenCalledWith({ monaco: localMonaco });
  });

  it.each([
    ['json', mocks.jsonWorker],
    ['css', mocks.cssWorker],
    ['scss', mocks.cssWorker],
    ['less', mocks.cssWorker],
    ['html', mocks.htmlWorker],
    ['handlebars', mocks.htmlWorker],
    ['razor', mocks.htmlWorker],
    ['typescript', mocks.typeScriptWorker],
    ['javascript', mocks.typeScriptWorker],
    ['plaintext', mocks.editorWorker],
  ])('uses a bundled worker for the %s language', (label, WorkerConstructor) => {
    environment().getWorker('', label);
    expect(WorkerConstructor).toHaveBeenCalledOnce();
  });
});
