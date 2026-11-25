/* ========================================
   Scoreboard Text Helpers
   ======================================== */

// This module provides helper functions for scoreboard text elements.
// The main text creation/editing happens via App state + controls.js

/**
 * Get sorted text elements by collection_index
 */
function getScoreboardTexts() {
    return App.elements
        .filter(e => e.type === 'text')
        .sort((a, b) => a.collection_index - b.collection_index);
}

/**
 * Auto-reassign collection indices (0, 1, 2, ...)
 */
function reindexScoreboards() {
    const texts = getScoreboardTexts();
    texts.forEach((t, i) => {
        t.collection_index = i;
    });
}

/**
 * Get the max collection index in use
 */
function getMaxCollectionIndex() {
    const texts = getScoreboardTexts();
    if (texts.length === 0) return -1;
    return Math.max(...texts.map(t => t.collection_index));
}
