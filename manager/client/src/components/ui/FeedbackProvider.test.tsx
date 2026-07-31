import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import i18n from '../../i18n';
import { useFeedback } from '../../contexts/feedback-context';
import { FeedbackProvider } from './FeedbackProvider';

const Harness = () => {
  const { confirm, notify } = useFeedback();
  const [result, setResult] = useState('pending');
  return (
    <>
      <button type="button" onClick={() => notify('Operation complete', 'success')}>Notify</button>
      <button type="button" onClick={() => void confirm({ title: 'Confirm action', message: 'Continue now?', confirmLabel: 'Proceed' }).then(value => setResult(String(value)))}>Open confirm</button>
      <output aria-label="result">{result}</output>
    </>
  );
};

describe('FeedbackProvider', () => {
  beforeAll(async () => { await i18n.changeLanguage('en'); });

  it('renders and dismisses an accessible notification', () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Operation complete').closest('[role="status"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByText('Operation complete')).not.toBeInTheDocument();
  });

  it('renders error and default informational notifications', () => {
    const Kinds = () => {
      const { notify } = useFeedback();
      return <>
        <button type="button" onClick={() => notify('Failure', 'error')}>Error notice</button>
        <button type="button" onClick={() => notify('Information')}>Info notice</button>
      </>;
    };
    render(<FeedbackProvider><Kinds /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Error notice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Info notice' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Failure');
    expect(screen.getByText('Information').closest('[role="status"]')).toBeInTheDocument();
  });

  it('automatically expires notifications', () => {
    vi.useFakeTimers();
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('Operation complete')).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it('resolves confirmation actions without a native browser dialog', async () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Continue now?');
    fireEvent.click(screen.getByRole('button', { name: 'Proceed' }));
    expect(await screen.findByLabelText('result')).toHaveTextContent('true');
  });

  it('cancels the dialog with Escape', async () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByLabelText('result')).toHaveTextContent('false');
  });

  it('uses translated defaults and supports button cancellation', async () => {
    const Defaults = () => {
      const { confirm } = useFeedback();
      const [result, setResult] = useState('pending');
      return <>
        <button type="button" onClick={() => void confirm({ message: 'Delete permanently?', destructive: true }).then(value => setResult(String(value)))}>Delete item</button>
        <output aria-label="default-result">{result}</output>
      </>;
    };
    render(<FeedbackProvider><Defaults /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Confirm');
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('danger');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByLabelText('default-result')).toHaveTextContent('false');
  });

  it('keeps the dialog open for content clicks and closes it from the backdrop', async () => {
    render(<FeedbackProvider><Harness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Open confirm' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.mouseDown(dialog);
    expect(dialog).toBeInTheDocument();
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(await screen.findByLabelText('result')).toHaveTextContent('false');
  });

  it('rejects hook usage outside the provider', () => {
    expect(() => render(<Harness />)).toThrow('useFeedback must be used within FeedbackProvider');
  });
});
