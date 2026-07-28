import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import InboxPage from '../src/pages/InboxPage.jsx';
import WhatsAppInboxPage from '../src/pages/WhatsAppInboxPage.jsx';
import { NotificationProvider } from '../src/contexts/NotificationContext.jsx';

function renderWithProviders(ui) {
  return renderToStaticMarkup(
    React.createElement(MemoryRouter, null,
      React.createElement(NotificationProvider, null, ui)
    )
  );
}

class MockAudio {
  constructor() {}
  preload = '';
}

globalThis.Audio = MockAudio;

test('InboxPage renders without throwing during server-side render', () => {
  assert.doesNotThrow(() => {
    renderWithProviders(React.createElement(InboxPage));
  });
});

test('WhatsApp inbox page renders without throwing during server-side render', () => {
  assert.doesNotThrow(() => {
    renderWithProviders(React.createElement(WhatsAppInboxPage));
  });
});
