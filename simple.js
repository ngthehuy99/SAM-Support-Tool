// ==UserScript==
// @name         SAM Support (Simple Pattern)
// @version      1.0
// @match        *://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    const patterns = ['wil'];
    const loaded = new Set();

    new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.tagName === 'SCRIPT' && node.src?.includes('cdn.shopify.com/extensions/') &&
                patterns.some(p => node.src.includes(p))) {

                const filename = node.src.match(/\/assets\/(.+?)(?:\?|$)/)?.[1];
                if (filename && !loaded.has(filename)) {
                    loaded.add(filename);
                    node.remove();

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: `http://localhost:50011/${filename}?t=${Date.now()}`,
                        onload: r => {
                            if (r.status === 200) {
                                document.head.appendChild(
                                    Object.assign(document.createElement('script'), {textContent: r.responseText})
                                );
                                console.log('✅ Loaded:', filename);
                            }
                        }
                    });
                }
            }
        }));
    }).observe(document.documentElement, {childList: true, subtree: true});

})();
