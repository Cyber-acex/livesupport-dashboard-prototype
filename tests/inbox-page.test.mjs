import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import InboxPage from '../src/pages/InboxPage.jsx';
import { NotificationProvider } from '../src/contexts/NotificationContext.jsx';

class MockAudio {
  constructor() {}
  preload = '';
}

globalThis.Audio = MockAudio;

test('InboxPage renders without throwing during server-side render', () => {
  assert.doesNotThrow(() => {
    renderToStaticMarkup(
      <MemoryRouter>
        <NotificationProvider>
          <InboxPage />
        </NotificationProvider>
      </MemoryRouter>
    );
  });
});
