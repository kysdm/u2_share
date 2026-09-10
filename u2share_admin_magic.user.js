// ==UserScript==
// @name         U2 释放人工魔法 (MOD)
// @namespace    https://u2.dmhy.org/
// @version      0.0.2
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
    var uid = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i) || ['', '']; if (uid[1] !== '') uid = uid[1]; // 当前用户ID
    var db = localforage.createInstance({ name: "history" });
    var token = await db.getItem('token');
    if (token === null || token.length !== 96) { log('未找到有效 API Token，将无法使用此脚本。') };


    function log(text) {
        let currentTime = new Date();
        let hours = currentTime.getHours().toString().padStart(2, '0');
        let minutes = currentTime.getMinutes().toString().padStart(2, '0');
        let seconds = currentTime.getSeconds().toString().padStart(2, '0');
        let formattedTime = hours + ':' + minutes + ':' + seconds;

        if ($('table.torrents').prev().prop('nodeName').toLowerCase() !== 'br') {
            $('table.torrents').before(`<p class="promotion_log">${formattedTime} - ${text}</p><br>`);
        } else {
            $('table.torrents').prev().before(`<p class="promotion_log">${formattedTime} - ${text}</p>`);
        }

    }

    // 站点改版后 POST 需要带上页面里的 csrf-token：
    // <meta name="csrf-token" content="v1.xxx.yyy.hash.hash" />
    function getCsrfToken() {
        let csrf = $('meta[name="csrf-token"]').attr('content')  // 页面 meta（首选）
            || $('input[name="_csrf"]').val();                   // 兜底：表单隐藏域
        return typeof csrf === 'string' ? csrf.trim() : '';
    }

    // token 带有效期（v1.<生效时间>.<失效时间>.<hash>.<hash>），页面开太久就会过期；
    // 过期时站点返回 403 + 纯文本 "Invalid or expired link"，这时重新拉一次表单页取新 token。
    function fetchFreshCsrfToken(tid) {
        const url = 'https://u2.dmhy.org/promotion.php?action=specify&torrent=' + encodeURIComponent(tid);

        return fetch(url)
            .then(response => response.ok ? response.text() : '')
            .then(html => {
                const matched = html.match(/<meta[^>]+name=["']csrf-token["'][^>]*content=["']([^"']+)["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf-token["']/i)
                    || html.match(/name=["']_csrf["'][^>]*value=["']([^"']+)["']/i);
                return matched !== null ? matched[1] : '';
            })
            .catch(() => '');
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

        return fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body,
            redirect: 'manual'
        });
    }

    function sendPromotionPostRequest(formData) {
        const postWith = (csrf, retried) => postPromotionOnce(formData, csrf).then(async response => {
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
        });

        const csrf = getCsrfToken();
        if (csrf !== '') return postWith(csrf, false);

        // 页面上找不到就直接去表单页取一个
        return fetchFreshCsrfToken(formData.torrent).then(fresh => {
            if (fresh === '') throw new Error('页面中未找到 csrf-token');
            return postWith(fresh, false);
        });
    }

    function queryModPromotion(tid) {
        return fetch(`https://u2.kysdm.com/api/v1/promotion_specific?token=${token}&uid=${uid}&torrent_id=${tid}`, { method: 'GET' })
            .then(response => {
                if (!response.ok) {
                    throw new Error(response.status);
                }
                return response.json();
            });
    }

    async function checkPromotion(tid) {
        let api = await queryModPromotion(tid);

        if (api.state == 200 && api.msg === 'success') {
            const promotion = api.data.promotion;
            let promotion_state = false;  // 初始化魔法是否状态
            let promotion_id, user_name, user_id;
            promotion.forEach(item => {
                if (item.promotion_type === '管理' && item.remarks.includes('by owner self.')) {
                    promotion_state = true;
                    promotion_id = item.promotion_id;
                    user_name = item.user_name;
                    user_id = item.user_id;
                    return;
                }
            })
            return { "promotion_state": promotion_state, "promotion_id": promotion_id, "user_name": user_name, "user_id": user_id };
        }
    }


    $('table.torrents').before('<button id="promotion_self_rip">原创压制</button>')
        .before('&nbsp;<button id="promotion_self_dump">原创抓取</button><p></p>');

    $('<style>.promotion_mod_select { background-color: #FFDCA2; }</style>').appendTo('head');
    $('<style>.promotion_log { margin: 0; padding: 0; }</style>').appendTo('head');

    $('table.torrentname').parent().parent().click(function () {
        $(this).toggleClass('promotion_mod_select');
        $(this).find('.torrentname').toggleClass('promotion_mod_select');
    });

    $('#promotion_self_dump,#promotion_self_rip').click(function () {
        const shortcut = $(this).attr('id') === 'promotion_self_dump' ? 'self-dump' : 'self-rip';
        const tasks = [];

        $('table.promotion_mod_select').each(function () {
            let url = $(this).find('a.tooltip').attr('href');
            let tid = url.match(/id=(\d+)/)[1];
            log(`#${tid} 添加到队列`)

            const formData = { action: 'admin', torrent: tid, shortcut: shortcut };

            const task = checkPromotion(tid)
                .then((data) => {
                    return new Promise((resolve, reject) => {
                        if (data.promotion_state) {
                            log(`#${tid} 已经释放过魔法 ${data.user_name}(${data.user_id})`);
                            resolve();
                        } else {
                            log(`#${tid} 还未释放魔法`);
                            sendPromotionPostRequest(formData)
                                .then(() => {
                                    log(`#${tid} 释放成功`);
                                    resolve();
                                })
                                .catch(error => {
                                    log(`#${tid} 释放失败 [${error}]`);
                                    reject(error);
                                });
                        }
                    });
                })
                .catch(error => {
                    log(`#${tid} 获取 API 信息发生错误 [${error}]`);
                });

            tasks.push(task);
        });

        Promise.all(tasks)
            .then(() => {
                log(`任务完成`);
            });
    });

})()
