// ==UserScript==
// @name         U2 释放人工魔法 (MOD)
// @namespace    https://u2.dmhy.org/
// @version      0.0.4
// @description  U2 释放人工魔法 (MOD)
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/torrents.php*
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @downloadURL  https://raw.githubusercontent.com/kysdm/u2_share/main/u2share_admin_magic.user.js
// @updateURL    https://raw.githubusercontent.com/kysdm/u2_share/main/u2share_admin_magic.user.js
// @icon         https://u2.dmhy.org/favicon.ico
// ==/UserScript==

'use strict';

(async () => {
    // 日志面板固定在左上角：脱离文档流，写日志不会引起页面重排
    const logBox = $('<div class="promotion_log_box"></div>').appendTo('body');
    $('<style>.promotion_log { margin: 0; padding: 0; }' +
        '.promotion_log_box { position: fixed; left: 12px; top: 12px; width: 360px; max-height: 30vh;' +
        ' overflow-y: auto; z-index: 9999; padding: 6px 8px; font-size: 12px; line-height: 1.5;' +
        ' background: rgba(255, 255, 255, .95); border: 1px solid #d0d7de; border-radius: 6px;' +
        ' box-shadow: 0 2px 8px rgba(0, 0, 0, .15); }' +
        '.promotion_log_box:empty { display: none; }</style>').appendTo('head');

    function log(text) {
        const currentTime = new Date();
        const formattedTime = [currentTime.getHours(), currentTime.getMinutes(), currentTime.getSeconds()]
            .map(value => value.toString().padStart(2, '0'))
            .join(':');

        logBox.append(`<p class="promotion_log">${formattedTime} - ${text}</p>`);
        logBox[0].scrollTop = logBox[0].scrollHeight;
    }

    const db = localforage.createInstance({ name: 'history' });
    const token = await db.getItem('token');
    if (token === null || token.length !== 96) {
        log('未找到有效 API Token，将无法使用此脚本。');
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 站点与 API 都有限流：任意 1 秒窗口内最多发出 REQUESTS_PER_WINDOW 个请求
    const REQUEST_WINDOW_MS = 1000;
    const REQUESTS_PER_WINDOW = 4;
    const recentRequests = [];

    /** 限流版 fetch：排队等待，保证任意 1 秒窗口内的请求数不超过上限。 */
    async function request(url, options) {
        while (true) {
            const now = Date.now();
            while (recentRequests.length > 0 && now - recentRequests[0] > REQUEST_WINDOW_MS) {
                recentRequests.shift();
            }
            if (recentRequests.length < REQUESTS_PER_WINDOW) {
                recentRequests.push(now);
                break;
            }
            await sleep(REQUEST_WINDOW_MS - (now - recentRequests[0]));
        }
        return fetch(url, options);
    }

    // token 带有效期（v1.<生效时间>.<失效时间>.<hash>.<hash>），页面开太久就会过期；
    // 过期时站点返回 403 + 纯文本 "Invalid or expired link"，这时重新拉一次表单页取新 token。
    async function fetchFreshCsrfToken(tid) {
        const url = 'https://u2.dmhy.org/promotion.php?action=specify&torrent=' + encodeURIComponent(tid);

        try {
            const response = await request(url);
            if (!response.ok) return '';

            const html = await response.text();
            const matched = html.match(/<meta name="csrf-token" content="([^"]+)"/i);
            return matched !== null ? matched[1] : '';
        } catch (error) {
            return '';
        }
    }

    /** 压成一行摘要，用于日志。 */
    function briefBody(text) {
        return String(text).replace(/\s+/g, ' ').trim().slice(0, 120);
    }

    function postPromotionOnce(formData, csrf) {
        const { action, torrent, shortcut } = formData;  // 调用方必定传入这三个字段

        // 改版后 torrent 同时出现在 query 与 body 中
        const url = new URL('https://u2.dmhy.org/promotion.php');
        url.searchParams.set('action', 'specify');
        url.searchParams.set('torrent', torrent);

        // 站点需要的四个 key：_csrf、action、torrent、shortcut（无顺序要求）
        const body = new URLSearchParams({ _csrf: csrf, action, torrent, shortcut });

        return request(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body,
            redirect: 'manual'
        });
    }

    async function sendPromotionPostRequest(formData) {
        const postWith = async (csrf, retried) => {
            const response = await postPromotionOnce(formData, csrf);

            // 站点受理成功时返回 200 + 一段 JS 跳转脚本（不是 302）：
            //   <script type="text/javascript">
            //       window.location.href = '?action=torrent&id=64563';
            //   </script>
            // 302 分支保留：fetch 在 redirect: 'manual' 下得到 opaqueredirect、status 为 0。
            if (response.type === 'opaqueredirect') {
                return { target: '', html: '' };
            }

            const html = await response.text();

            // _csrf 失效：403 + 纯文本 "Invalid or expired link"，取新 token 重试一次（只重试一次）
            if ((response.status === 403 || /invalid or expired link/i.test(html)) && !retried) {
                const fresh = await fetchFreshCsrfToken(formData.torrent);
                if (fresh !== '') {
                    log('csrf-token 已失效，已重新获取并重试一次');
                    return postWith(fresh, true);
                }
            }

            if (!response.ok) {
                throw new Error('HTTP ' + response.status + (html === '' ? '' : '：' + briefBody(html)));
            }

            const matched = html.match(/window\.location\.href\s*=\s*['"]([^'"]*)['"]/i);
            const target = matched !== null ? matched[1] : '';
            if (target === '') {
                // 没有跳转脚本说明站点返回的是提示/错误页面，把内容摘要带进日志
                throw new Error('站点未返回跳转脚本，响应内容：' + briefBody(html));
            }
            return { target: target, html: html };
        };

        // 站点用 <meta name="csrf-token" content="v1.xxx.yyy.hash.hash" /> 承载 csrf-token；
        // 取不到或已过期时，由上面的 403 分支去表单页取新 token 重试
        return postWith($('meta[name="csrf-token"]').attr('content'), false);
    }

    // API V2：鉴权用 Authorization: Bearer，用户由 token 决定，uid 不再作为参数
    async function queryModPromotion(tid) {
        const response = await request(`https://u2.kysdm.com/api/v2/promotions/active?torrent_id=${tid}`, {
            headers: { Authorization: 'Bearer ' + token }
        });
        const api = await response.json();
        if (api.code !== 200) {
            throw new Error(`API 返回异常：code=${api.code} message=${api.message}`);
        }
        return api;
    }

    /** 查询某个种子是否已经释放过魔法（管理施放 + by owner self.）。抓取与压制互斥，命中任一即视为已释放。 */
    async function checkPromotion(tid) {
        const api = await queryModPromotion(tid);

        const promotion = api.data.items;
        let promotionState = false;  // 是否已经释放过魔法
        let promotionId, userName, userId;
        promotion.forEach(item => {
            if (item.promotion_type === '管理' && item.remarks.includes('by owner self.')) {
                promotionState = true;
                promotionId = item.promotion_id;
                userName = item.user_name;
                userId = item.user_id;
            }
        });

        return { promotion_state: promotionState, promotion_id: promotionId, user_name: userName, user_id: userId };
    }

    /** 处理单个种子：已经释放过就跳过，否则提交一次释放魔法。 */
    async function releaseMagic(tid, shortcut) {
        let data;
        try {
            data = await checkPromotion(tid);
        } catch (error) {
            log(`#${tid} 获取 API 信息发生错误 [${error}]`);
            return;
        }

        if (data.promotion_state) {
            log(`#${tid} 已经释放过魔法 ${data.user_name}(${data.user_id})`);
            return;
        }

        try {
            await sendPromotionPostRequest({ action: 'admin', torrent: tid, shortcut: shortcut });
            log(`#${tid} 释放成功`);
        } catch (error) {
            log(`#${tid} 释放失败 [${error}]`);
        }
    }

    $('table.torrents').before('<button id="promotion_self_rip">原创压制</button>')
        .before('&nbsp;<button id="promotion_self_dump">原创抓取</button><p></p>');

    $('<style>.promotion_mod_select { background-color: #FFDCA2; }</style>').appendTo('head');
    $('table.torrentname').parent().parent().click(function () {
        $(this).toggleClass('promotion_mod_select');
        $(this).find('.torrentname').toggleClass('promotion_mod_select');
    });

    $('#promotion_self_dump,#promotion_self_rip').click(async function () {
        const shortcut = $(this).attr('id') === 'promotion_self_dump' ? 'self-dump' : 'self-rip';

        const tids = $('table.promotion_mod_select').map(function () {
            return $(this).find('a.tooltip').attr('href').match(/id=(\d+)/)[1];
        }).get();

        tids.forEach(tid => log(`#${tid} 添加到队列`));
        log(`共 ${tids.length} 个种子，每秒最多 ${REQUESTS_PER_WINDOW} 个请求`);

        for (const tid of tids) {
            await releaseMagic(tid, shortcut);
        }
        log('任务完成');
    });

})();
