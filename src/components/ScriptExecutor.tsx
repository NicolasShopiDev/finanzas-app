'use client';

import { useEffect } from 'react';

/**
 * ScriptExecutor Component
 * Listens for postMessage events from parent window (Angular totalum-frontend)
 * and executes JavaScript code sent via postMessage to enable dynamic iframe control
 */
export function ScriptExecutor() {
  useEffect(() => {

    const handleMessage = (event: MessageEvent) => {
      // Security: Validate origin
      // Accept from totalum-app.com domains and localhost for development
      const validOrigins = [
        'https://web.totalum.app',
        'https://totalum-frontend-test.web.app',
        'https://www.totalum-app.com',
        'https://www.totalum-project.com',
        'http://localhost:8100'
      ];

      const isValidOrigin = validOrigins.some(origin => event.origin.includes(origin)) ||
                           event.origin.startsWith('http://localhost');

      if (!isValidOrigin) {
        console.warn('[SCRIPT-EXECUTOR] ⚠️ Rejected message from invalid origin:', event.origin);
        return;
      }

      const { type, code, styles, id } = event.data;

      // Handle script injection
      if (type === 'inject-editor-script') {

        try {
          // Inject styles first if provided
          if (styles) {
            injectStyles(styles);
          }

          // Inject and execute the script
          if (code) {
            executeScript(code);
          }

          // Send success response
          sendResponse(event.source as Window, {
            type: 'script-injected',
            id,
            success: true
          });

        } catch (error) {
          console.error('[SCRIPT-EXECUTOR] ❌ Error injecting script:', error);
          sendResponse(event.source as Window, {
            type: 'script-injected',
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Handle script removal
      else if (type === 'remove-editor-script') {

        try {
          removeInjectedScript();
          removeInjectedStyles();

          sendResponse(event.source as Window, {
            type: 'script-removed',
            id,
            success: true
          });

        } catch (error) {
          console.error('[SCRIPT-EXECUTOR] ❌ Error removing script:', error);
          sendResponse(event.source as Window, {
            type: 'script-removed',
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Handle arbitrary script execution (for future features)
      else if (type === 'execute-script') {

        try {
          const result = executeScript(code);

          sendResponse(event.source as Window, {
            type: 'script-result',
            id,
            success: true,
            result
          });

        } catch (error) {
          console.error('[SCRIPT-EXECUTOR] ❌ Error executing script:', error);
          sendResponse(event.source as Window, {
            type: 'script-result',
            id,
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    };

    // Listen for messages from parent
    window.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      window.removeEventListener('message', handleMessage);
      removeInjectedScript();
      removeInjectedStyles();
    };
  }, []);

  return null; // This component renders nothing
}

/**
 * Execute JavaScript code safely
 */
function executeScript(code: string): any {
  // Use Function constructor (safer than eval, creates new scope)
  // Provide access to window and document
  const fn = new Function('window', 'document', code);
  return fn(window, document);
}

/**
 * Inject CSS styles into document
 */
function injectStyles(styles: string): void {
  // Remove existing styles if any
  removeInjectedStyles();

  const styleElement = document.createElement('style');
  styleElement.id = 'visual-editor-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);

}

/**
 * Remove injected styles
 */
function removeInjectedStyles(): void {
  const existingStyles = document.getElementById('visual-editor-styles');
  if (existingStyles) {
    existingStyles.remove();
  }
}

/**
 * Remove injected script (cleanup)
 */
function removeInjectedScript(): void {
  const existingScript = document.getElementById('visual-editor-script');
  if (existingScript) {
    existingScript.remove();
  }

  // Call cleanup function if it exists
  if (typeof (window as any).cleanupVisualEditor === 'function') {
    (window as any).cleanupVisualEditor();
  }
}

/**
 * Send response back to parent window
 */
function sendResponse(targetWindow: Window, message: any): void {
  targetWindow.postMessage(message, '*');
}
