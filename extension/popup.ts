// extension/popup.ts
// Popup script with refactored manual paper tracking

import { PaperMetadata } from './papers/types';
import { browser } from './utils/browser-api';

console.log('Popup script starting...');

// Function to get paper data from background script
async function getCurrentPaper(): Promise<PaperMetadata | null> {
  return new Promise((resolve) => {
    browser.runtime.sendMessage({type: 'getCurrentPaper'}, (response) => {
      console.log('Got paper data from background:', response);
      resolve(response as PaperMetadata | null);
    });
  });
}

// Interface for message response
interface MessageResponse {
  success: boolean;
  error?: string;
  metadata?: PaperMetadata;
}

// Function to update UI with paper data
function updateUI(paperData: PaperMetadata | null): void {
  const titleElement = document.getElementById('paperTitle');
  const authorsElement = document.getElementById('paperAuthors');
  const statusElement = document.getElementById('status');
  const manualLogSection = document.getElementById('manualLogSection');

  if (!titleElement || !authorsElement || !statusElement || !manualLogSection) {
    console.error('Required DOM elements not found');
    return;
  }

  if (paperData) {
    // Show detected paper data
    titleElement.textContent = paperData.title || paperData.paperId;
    authorsElement.textContent = paperData.authors;
    statusElement.textContent = 'Paper tracked! Issue created on GitHub.';
    
    // Enable rating buttons
    const thumbsUpButton = document.getElementById('thumbsUp') as HTMLButtonElement;
    const thumbsDownButton = document.getElementById('thumbsDown') as HTMLButtonElement;
    
    if (thumbsUpButton && thumbsDownButton) {
      thumbsUpButton.disabled = false;
      thumbsDownButton.disabled = false;
      
      // Set active state on rating buttons
      thumbsUpButton.classList.toggle('active', paperData.rating === 'thumbsup');
      thumbsDownButton.classList.toggle('active', paperData.rating === 'thumbsdown');
    }
    
    // Hide manual log section
    manualLogSection.style.display = 'none';
  } else {
    // No paper detected - show manual log option
    titleElement.textContent = 'No paper detected';
    authorsElement.textContent = '';
    statusElement.textContent = 'Current page not recognized as a paper';
    
    // Disable rating buttons
    const thumbsUpButton = document.getElementById('thumbsUp') as HTMLButtonElement;
    const thumbsDownButton = document.getElementById('thumbsDown') as HTMLButtonElement;
    
    if (thumbsUpButton && thumbsDownButton) {
      thumbsUpButton.disabled = true;
      thumbsDownButton.disabled = true;
    }
    
    // Show manual log section
    manualLogSection.style.display = 'block';
  }
}

// Function to ensure content script is loaded
async function ensureContentScriptLoaded(tabId: number): Promise<boolean> {
  try {
    // Try to ping the content script
    return new Promise((resolve) => {
      browser.tabs.sendMessage(tabId, { type: 'ping' }, (response) => {
        if (browser.runtime.lastError) {
          // Content script not loaded, try to inject it
          console.log('Content script not loaded, injecting...');
          browser.scripting.executeScript({
            target: { tabId },
            files: ['dist/content-script.js']
          }).then(() => {
            console.log('Content script injected successfully');
            // Wait a bit for the script to initialize
            setTimeout(() => resolve(true), 500);
          }).catch((err) => {
            console.error('Failed to inject content script:', err);
            resolve(false);
          });
        } else {
          // Content script is already loaded
          resolve(true);
        }
      });
    });
  } catch (err) {
    console.error('Error ensuring content script:', err);
    return false;
  }
}

// Function to log current page as a paper (using content script extraction)
async function logCurrentPage(): Promise<void> {
  console.log("attempting to log paper");

  // Get the active tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0] || !tabs[0].id) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = 'Error: Could not access current tab';
    }
    return;
  }

  const tabId = tabs[0].id;
  const tabUrl = tabs[0].url || '';

  // Check if this is a special page we can't access
  if (tabUrl.startsWith('chrome://') || tabUrl.startsWith('chrome-extension://') ||
      tabUrl.startsWith('about:') || tabUrl.startsWith('edge://') ||
      tabUrl.startsWith('moz-extension://')) {
    const statusElement = document.getElementById('status');
    if (statusElement) {
      statusElement.textContent = 'Error: Cannot access this type of page';
    }
    return;
  }

  // Show loading state
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = 'Extracting paper metadata...';
  }

  // Ensure content script is loaded
  const contentScriptLoaded = await ensureContentScriptLoaded(tabId);
  if (!contentScriptLoaded) {
    if (statusElement) {
      statusElement.textContent = 'Error: Could not load content script on this page';
    }
    return;
  }

  // Send message to content script requesting extraction
  browser.tabs.sendMessage(tabId, {
    type: 'extractPaperMetadata'
  }, (response: MessageResponse) => {
    if (browser.runtime.lastError) {
      // Handle error
      if (statusElement) {
        statusElement.textContent = 'Error: ' + browser.runtime.lastError.message;
      }
      return;
    }

    if (!response || !response.success || !response.metadata) {
      // Handle extraction failure
      if (statusElement) {
        statusElement.textContent = 'Error: ' + (response?.error || 'Failed to extract metadata');
      }
      return;
    }

    // Metadata extracted, now explicitly send to background to store in GitHub
    browser.runtime.sendMessage({
      type: 'manualPaperLog',
      metadata: response.metadata
    }, (storeResponse: MessageResponse) => {
      if (storeResponse && storeResponse.success) {
        // Success - update UI
        updateUI(response.metadata!);
        if (statusElement) {
          statusElement.textContent = 'Paper tracked and saved to GitHub!';
        }
      } else {
        // GitHub storage failed but we still have the metadata
        updateUI(response.metadata!);
        if (statusElement) {
          const errorMsg = storeResponse?.error || 'Could not save to GitHub';
          statusElement.textContent = 'Paper detected but: ' + errorMsg;
          statusElement.style.color = '#d97706'; // Warning color
        }
      }
    });

    // Hide manual log section
    const manualLogSection = document.getElementById('manualLogSection');
    if (manualLogSection) {
      manualLogSection.style.display = 'none';
    }

    // Enable rating buttons
    const thumbsUpButton = document.getElementById('thumbsUp') as HTMLButtonElement;
    const thumbsDownButton = document.getElementById('thumbsDown') as HTMLButtonElement;
    if (thumbsUpButton && thumbsDownButton) {
      thumbsUpButton.disabled = false;
      thumbsDownButton.disabled = false;
    }
  });
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup opened');
  
  // Get paper from the session tracker
  let paperData: PaperMetadata | null = null;
  let retries = 3;
  
  while (retries > 0 && !paperData) {
    paperData = await getCurrentPaper();
    if (!paperData) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
      retries--;
    }
  }
  
  updateUI(paperData);
  
  // Set up rating handlers
  const thumbsUpButton = document.getElementById('thumbsUp');
  if (thumbsUpButton) {
    thumbsUpButton.addEventListener('click', () => {
      browser.runtime.sendMessage({
        type: 'updateRating',
        rating: 'thumbsup'
      }, (response: MessageResponse) => {
        const statusElement = document.getElementById('status');
        const thumbsUpButton = document.getElementById('thumbsUp');
        const thumbsDownButton = document.getElementById('thumbsDown');
        
        if (!statusElement || !thumbsUpButton || !thumbsDownButton) return;
        
        if (response && response.success) {
          statusElement.textContent = 'Rating updated to: thumbs up';
          thumbsUpButton.classList.add('active');
          thumbsDownButton.classList.remove('active');
          setTimeout(() => window.close(), 1500);
        } else {
          statusElement.textContent = 'Error: ' + (response?.error || 'Unknown error');
        }
      });
    });
  }
  
  const thumbsDownButton = document.getElementById('thumbsDown');
  if (thumbsDownButton) {
    thumbsDownButton.addEventListener('click', () => {
      browser.runtime.sendMessage({
        type: 'updateRating',
        rating: 'thumbsdown'
      }, (response: MessageResponse) => {
        const statusElement = document.getElementById('status');
        const thumbsUpButton = document.getElementById('thumbsUp');
        const thumbsDownButton = document.getElementById('thumbsDown');
        
        if (!statusElement || !thumbsUpButton || !thumbsDownButton) return;
        
        if (response && response.success) {
          statusElement.textContent = 'Rating updated to: thumbs down';
          thumbsDownButton.classList.add('active');
          thumbsUpButton.classList.remove('active');
          setTimeout(() => window.close(), 1500);
        } else {
          statusElement.textContent = 'Error: ' + (response?.error || 'Unknown error');
        }
      });
    });
  }
  
  // Set up one-click logging button
  const logPageButton = document.getElementById('logPageButton');
  if (logPageButton) {
    console.log("Attaching logPageButton event listener...");
    logPageButton.addEventListener('click', () => {
      console.log("logPageButton clicked...");
      logCurrentPage();
    });
  }
});
