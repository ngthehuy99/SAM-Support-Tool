// ==UserScript==
// @name         SAM Support (Hash Init Config)
// @version      1.0
// @description  Clean version - config only
// @author       SAM
// @match        *://*/*
// @run-at       document-start
// @grant        GM_xmlhttpRequestConfig
// @connect      localhost
// @connect      *.myshopify.com
// @connect      myshopify.com
// ==/UserScript==

(function() {
    'use strict';

    console.log('🚀 SAM Support Starting...');

    const patterns = ['wil'];
    const loaded = new Set();

    // Load config từ file
    function loadConfig() {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `http://localhost:50011/config.json?t=${Date.now()}`,
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const config = JSON.parse(response.responseText);
                            console.log('✅ Config loaded for:', config.shopify.shop);
                            resolve(config);
                        } catch (e) {
                            console.error('❌ Config parse error:', e.message);
                            resolve(null);
                        }
                    } else {
                        console.error('❌ Config not found');
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    // Fetch shop data và app metafields
    function fetchShopData(config) {
        return new Promise((resolve) => {
            const query = `
                query {
                    shop {
                        name
                    }
                    currentAppInstallation {
                        metafields(first: 10, namespace: "${config.shopify.appNamespace}") {
                            edges {
                                node {
                                    key
                                    value
                                    type
                                }
                            }
                        }
                    }
                }
            `;

            GM_xmlhttpRequest({
                method: 'POST',
                url: `https://${config.shopify.shop}/admin/api/2024-10/graphql.json`,
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': config.shopify.adminToken
                },
                data: JSON.stringify({ query }),
                onload: (response) => {
                    if (response.status === 200) {
                        try {
                            const data = JSON.parse(response.responseText);
                            if (data.errors) {
                                console.error('❌ API errors:', data.errors);
                                resolve(null);
                            } else {
                                console.log('✅ Data fetched:', data.data.shop.name);
                                resolve(data.data);
                            }
                        } catch (e) {
                            console.error('❌ Parse error:', e.message);
                            resolve(null);
                        }
                    } else {
                        console.error(`❌ HTTP ${response.status}`);
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    // Parse metafields
    function parseMetafields(data) {
        const metafields = {};
        data?.currentAppInstallation?.metafields?.edges?.forEach(edge => {
            const { key, value, type } = edge.node;
            try {
                metafields[key] = (type === 'json' || value.startsWith('{') || value.startsWith('['))
                    ? JSON.parse(value) : value;
            } catch (e) {
                metafields[key] = value;
            }
        });
        return metafields;
    }

    // Init SAM config
    function initSAMConfig(shopData, metafields, shopDomain) {
        const script = document.createElement('script');
        script.id = 'sam-protect-config';
        script.textContent = `
            var __SAM = {
                shopFormatMoney: "{{amount}}",
                shopFormatMoneyWithCurrency: "{{amount}} USD",
                shopSetting: ${JSON.stringify(metafields.shop_info)},
                protectConfig: ${JSON.stringify(metafields.widget_config || null)},
                claim: {},
                widget: {},
                settingData: {
                    protectInited: false,
                    customPricing: ${JSON.stringify(metafields.custom_price || null)},
                    variantFixedBasePriceId: ${JSON.stringify(metafields.variant_fixed_base_price_id || null)}
                },
                customization: ${JSON.stringify(metafields.customization || null)},
                hashInitial: true
            };
        `;
        document.head.appendChild(script);
        console.log('✅ SAM config initialized');
        console.log('📊 Metafields:', Object.keys(metafields));
    }

    // Fallback config
    function initFallbackConfig() {
        const script = document.createElement('script');
        script.id = 'sam-protect-config';
        script.textContent = `
            var __SAM = {
                shopFormatMoney: "{{amount}}",
                shopFormatMoneyWithCurrency: "{{amount}} USD",
                shopSetting: null,
                protectConfig: null,
                claim: {},
                widget: {},
                settingData: { protectInited: false, customPricing: null, variantFixedBasePriceId: null },
                customization: null,
                hashInitial: true
            };
        `;
        document.head.appendChild(script);
        console.log('⚠️ Fallback config initialized');
    }

    // Load local files
    function loadLocalFiles() {
        ['widget.css', 'wil-widget.js'].forEach(file => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `http://localhost:50011/${file}?t=${Date.now()}`,
                onload: (r) => {
                    if (r.status === 200) {
                        const element = file.endsWith('.css')
                            ? Object.assign(document.createElement('style'), {textContent: r.responseText})
                            : Object.assign(document.createElement('script'), {textContent: r.responseText});

                        element.setAttribute('data-source', 'localhost');
                        document.head.appendChild(element);
                        console.log('✅ Loaded:', file);
                    }
                }
            });
        });
    }

    // Block CDN scripts
    function setupScriptBlocking() {
        new MutationObserver(mutations => {
            mutations.forEach(m => m.addedNodes.forEach(node => {
                if (node.tagName === 'SCRIPT' && node.src?.includes('cdn.shopify.com/extensions/') &&
                    patterns.some(p => node.src.includes(p))) {

                    const filename = node.src.match(/\/assets\/(.+?)(?:\?|$)/)?.[1];
                    if (filename && !loaded.has(filename)) {
                        loaded.add(filename);
                        node.remove();
                        console.log('🚫 Blocked:', filename);
                    }
                }
            }));init
        }).observe(document.documentElement, {childList: true, subtree: true});
    }

    // Main init
    async function init() {
        const config = await loadConfig();

        if (config?.shopify?.shop && config?.shopify?.adminToken) {
            const shopData = await fetchShopData(config);

            if (shopData) {
                const metafields = parseMetafields(shopData);
                initSAMConfig(shopData, metafields, config.shopify.shop);
            } else {
                initFallbackConfig();
            }
        } else {
            console.log('❌ Invalid config');
            initFallbackConfig();
        }

        loadLocalFiles();
        setupScriptBlocking();
        console.log('🏁 SAM Support ready');
    }

    init();
})();
