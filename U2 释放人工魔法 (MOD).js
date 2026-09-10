// ==UserScript==
// @name         U2 释放人工魔法 (MOD)
// @namespace    https://u2.dmhy.org/
// @version      0.0.2
// @description  U2 释放人工魔法 (MOD)
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/torrents.php*
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @downloadURL  https://gist.githubusercontent.com/kysdm/0083eacdad63a4cb15c6d14088b8d89c/raw
// @updateURL    https://gist.githubusercontent.com/kysdm/0083eacdad63a4cb15c6d14088b8d89c/raw
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

    function sendPromotionPostRequest(formData) {
        return fetch('https://u2.dmhy.org/promotion.php?action=specify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams(formData),
            redirect: 'manual'
        })
            .then(response => {
                console.log(response);
                if (!response.ok) {
                    throw new Error(response.status);
                }
                return response.text();
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
