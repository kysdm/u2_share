// ==UserScript==
// @name         U2历史记录
// @namespace    https://u2.dmhy.org/
// @version      0.5.1
// @description  查看种子历史记录
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/details.php?*
// @match        *://u2.dmhy.org/offers.php?*
// @match        *://u2.dmhy.org/forums.php?action=viewtopic*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @require      https://unpkg.com/thenby@1.3.4/thenBy.min.js
// @license      Apache-2.0
// ==/UserScript==

/*
本脚本基于 Bamboo Green 界面风格进行修改
/*

/*
GreasyFork 地址
    https://greasyfork.org/zh-CN/scripts/428545
*/

/*
使用说明
    https://u2.dmhy.org/forums.php?action=viewtopic&topicid=13495&page=p150133#pid150133
*/

/*
更新日志
    https://github.com/kysdm/u2_share/commits/main/u2share_history.user.js
*/

'use strict';

// 声明全局变量
var lang, torrent_id, db, user_id, topicid, key, token;

(async () => {
    // 初始化
    lang = new lang_init($('#locale_selection').val()); // 获取当前网页语言
    let em = /.*id=(?<tid>\d{3,5})/i.exec(location.search); if (em) torrent_id = em.groups.tid; else torrent_id = null; // 当前种子ID
    topicid = location.href.match(/topicid=(\d+)/i) || ['', '']; if (topicid[1] !== '') topicid = topicid[1];
    user_id = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i) || ['', '']; if (user_id[1] !== '') user_id = user_id[1]; // 当前用户ID
    db = localforage.createInstance({ name: "history" });
    // key = await db.getItem('key');
    token = await db.getItem('token');
    if (token === null || token.length !== 96) { new auth(); return; };
    if (torrent_id && /\/(offers|details)\.php/i.test(location.pathname) && $('#outer').find('h2').text().match(/错误|錯誤|Ошибка|error/i)) { torrentInfoHistoryReset(); torrentCommentHistoryReset(); }// 为已经删除的种子显示历史
    else if (torrent_id && '/offers.php' === location.pathname && !/(cmtpage|offer_vote|vote)=(1|p)/i.test(location.href) && /off_details=1/i.test(location.href)) { torrentInfoHistory(); torrentCommentHistory(); } // 为正常种子显示历史
    else if (torrent_id && '/details.php' === location.pathname && !/(cmtpage|offer_vote|vote)=(1|p)/i.test(location.href)) { torrentInfoHistory(); torrentCommentHistory(); } // 为正常种子显示历史
    else if (torrent_id && /\/(offers|details)\.php/i.test(location.pathname) && /cmtpage=1/i.test(location.href)) { torrentCommentHistory(); } // 为正常种子显示历史 <仅评论>
    else if (/\/forums\.php\?action=viewtopic/i.test(location.href) && $('#outer').find('h2').text().match(/错误|錯誤|Ошибка|error/i)) { forumCommentHistoryReset(); } // 为被删除的论坛帖子显示历史
    else if (/\/forums\.php\?action=viewtopic/i.test(location.href)) { forumCommentHistory(); }; // 为论坛帖子显示历史
})();

function auth() {

    $('#outer').html(`<h1 align="center">U2种子历史记录 自动鉴权工具</h1>
    <table border="0" align="center" cellspacing="0" cellpadding="5">
        <tbody>
            <tr>
                <td valign="top" width="500" align="center"><span style="word-break: break-all; word-wrap: break-word;">
                        <bdo dir="ltr">点击开始按钮，将自动进行鉴权，提示完成请刷新界面。<br>(建议手动备份下个人说明)<br></bdo></span></td>
            </tr>
            <tr>
                <td valign="top" align="left"><span style="word-break: break-all; word-wrap: break-word;">
                        <bdo id="auth_log" dir="ltr"></bdo></span></td>
            </tr>
            <tr>
                <td align="center">
                    <button id="auth_token" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button">开始鉴权</button>
                    <button id="auth_token_d" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button">已有TOKEN</button>
                </td>
            </tr>
        </tbody>
    </table>`);

    $("#auth_token_d").click(async function () {
        let __token = window.prompt("请输入Token"); // 弹窗提示输入Token
        if (__token === null || __token.length === 0) return; // 没有任何输入时 无视本次操作
        else if (__token.length !== 96) {
            await outPutLog(`Token: ${__token}`);
            await outPutLog(`Token长度不正确`);
            return;
        } // TOKEN长度不正确时 无视本次操作
        else {
            await db.setItem('token', __token);
            await outPutLog(`Token: ${__token}`);
            await outPutLog('鉴权结束');
        };
    });

    function getProfile() {
        return new Promise(async (resolve, reject) => {
            $.ajax({
                type: 'get',
                url: 'https://u2.dmhy.org/usercp.php?action=personal',
                cache: false,
                success: async r => {
                    const usercp = $.parseHTML(r)
                    // const profile = $(usercp).find('[name="info"]').text(); // 获取用户信息
                    const profile = {
                        "action": "personal",
                        "type": "save",
                        "acceptpms": $(usercp).find('[name="acceptpms"]:checked').val(), // 接受以下短讯
                        // 如果不需要开启对应功能，则不发送该参数
                        "deletepms": $(usercp).find('[name="deletepms"]').is(':checked') ? 'on' : '',  // 回复后删除短讯
                        "savepms": $(usercp).find('[name="savepms"]').is(':checked') ? 'on' : '', // 保存短讯至发件箱
                        "commentpm": $(usercp).find('[name="commentpm"]').is(':checked') ? 'yes' : '', // 我发布的种子有新评论时通知我
                        "atpm": $(usercp).find('[name="atpm"]').is(':checked') ? '1' : '',// 有人在群聊区@我时通知
                        "quotepm": $(usercp).find('[name="quotepm"]').is(':checked') ? '1' : '',// 有人在论坛、种子评论或候选评论引用我时通知。
                        // 如果不需要开启对应功能，则不发送该参数
                        "country": $(usercp).find('[name="country"]').val(),  // 国家/地区
                        "download": $(usercp).find('[name="download"]').val(),// 下行带宽
                        "upload": $(usercp).find('[name="upload"]').val(),// 上行带宽
                        "isp": $(usercp).find('[name="isp"]').val(),// 互联网服务提供商
                        "savatar": $(usercp).find('[name="savatar"]').val(), // 选择头像
                        "avatar": $(usercp).find('[name="avatar"]').val(), // 自定义头像
                        "info": $(usercp).find('[name="info"]').text() // 个人说明
                    };
                    let profileAuth = { ...profile }; // 复制
                    profileAuth.info = `-----BEGIN API KEY-----\n${key}\n-----END API KEY-----\n\n${profile.info}`; // 在个人说明加入鉴权信息
                    const p = profileAuth.info.replace(/\r\n/g, () => { return '<br>' }).replace(/\n/g, () => { return '<br>' }).replace(/\r/g, () => { return '<br>' });
                    await outPutLog(`请检查准备写入个人说明的BBCODE是否正确<br><br><table class="spoiler" width="100%">
                   <tbody>
                       <tr>
                           <td class="colhead">个人说明&nbsp;&nbsp;<button class="spoiler-button-show" style="">检查一下</button>
                                <button id="auth_profile_check" class="spoiler-button-hide" style="display: none;">检查完成</button></td>
                       </tr>
                       <tr>
                           <td><span class="spoiler-content" style="display: none;">${p}</span></td>
                       </tr>
                   </tbody>
               </table>`);
                    await db.setItem('profile', profile); // 存储用户信息
                    $("#auth_profile_check").click(async function (ev) {
                        $(this).hide();
                        $(this).siblings(".spoiler-button-show").show();
                        $(this).parentsUntil(".spoiler").find("span.spoiler-content:first").hide();
                        ev.preventDefault();
                        return resolve(profileAuth);
                    });
                },
                error: async d => {
                    await outPutLog('获取个人说明BBCODE失败');
                    await outPutLog(`错误信息: ${d.responseText}`);
                    return reject(Error(d.responseText));
                },
            });
        });
    };

    function postProfile(data) {
        return new Promise(async (resolve, reject) => {
            $.ajax({
                type: 'post',
                url: 'https://u2.dmhy.org/usercp.php',
                cache: false,
                contentType: "application/x-www-form-urlencoded",
                data: data,
                success: async r => {
                    await outPutLog('修改个人说明BBCODE成功');
                    return resolve(key);
                },
                error: async d => {
                    await outPutLog('修改个人说明BBCODE失败');
                    await outPutLog(`错误信息: ${d.responseText}`);
                    return reject(Error(d.responseText));
                },
            });
        });
    };

    function getAuthKey() {
        return new Promise(async (resolve, reject) => {
            $.ajax({
                type: 'post',
                url: 'https://u2.kysdm.com/api/v1/token',
                contentType: "application/json",
                dataType: 'json',
                // async: false,
                data: JSON.stringify({ "uid": user_id }),
                success: async function (d) {
                    if (d.msg === 'success') {
                        key = d.data.key
                        db.setItem('key', key);
                        await outPutLog('获取Key成功');
                        await outPutLog(`Key: ${key}`);
                        return resolve(key);
                    } else {
                        await outPutLog('获取Key失败');
                        await outPutLog(`错误信息: ${JSON.stringify(d)}`);
                        return reject(Error('获取Key失败'));
                    };
                },
                error: async function (d) {
                    await outPutLog('获取Key失败');
                    await outPutLog(`错误信息: ${d.responseText}`);
                    return reject(Error('获取Key失败'));
                },
            });
        });
    };

    function getToken() {
        return new Promise(async (resolve, reject) => {
            $.ajax({
                type: 'post',
                url: 'https://u2.kysdm.com/api/v1/token',
                contentType: "application/json",
                dataType: 'json',
                data: JSON.stringify({ "uid": user_id, "key": key }),
                success: async function (d) {
                    if (d.msg === 'success') {
                        let __token = d.data.token
                        await outPutLog('获取Token成功');
                        await outPutLog(`Token: ${__token}`);
                        await db.setItem('token', __token);
                        return resolve(__token);
                    } else {
                        await outPutLog('获取Token失败');
                        await outPutLog(`错误信息: ${JSON.stringify(d)}`);
                        return reject(Error('获取Token失败'));
                    };
                },
                error: async function (d) {
                    await outPutLog('获取Token失败');
                    await outPutLog(`错误信息: ${d.responseText}`);
                    return reject(Error('获取Token失败'));
                },
            });
        });
    };

    function outPutLog(text) {
        return new Promise(async (resolve, reject) => {
            const log = $('#auth_log').html();
            $('#auth_log').html(`${log}${getDateString()} - ${text}<br>`);
            resolve(await sleep(0));
        });
    };

    async function sleep(interval) {
        return new Promise(resolve => {
            setTimeout(resolve, interval);
        })
    };

    $("#auth_token").click(async function () {
        await outPutLog('鉴权开始');
        await outPutLog('获取鉴权所需的Key');
        getAuthKey()
            .then(async () => {
                await outPutLog('获取个人说明BBCODE');
                return getProfile();
            })
            .then(async data => {
                await outPutLog('修改个人说明BBCODE');
                await postProfile(data);
            })
            .then(async () => {
                await outPutLog('获取鉴权所需的Token');
                await getToken();
            })
            .then(async () => {
                await outPutLog('还原个人说明BBCODE');
                await postProfile(await db.getItem('profile'));
            })
            .catch(async err => {
                await outPutLog(err);
            })
            .finally(async () => {
                await outPutLog('鉴权结束');
            });
    });
};

async function forumCommentHistoryReset() {
    const errorstr = $('#outer').find('td.text').text();
    // 正在努力加载中...
    $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>' + lang['history_text_loading'] + '</i>');

    $.ajax({
        type: 'post',
        url: 'https://u2.kysdm.com/api/v1/comment',
        contentType: "application/json",
        dataType: 'json',
        data: JSON.stringify({ "uid": user_id, "token": token, "topicid": topicid, "type": "forum" }),
        success: function (d) {
            if (d.msg === 'success') {
                console.log('获取论坛评论成功');
                let __comment = d.data.comment[topicid].sort(firstBy((a, b) => a.pid - b.pid).thenBy((a, b) => b.self - a.self)); // 如果用self排序，消息顺序不正确，则改用编辑日期排序

                if (__comment.length === 0) { // 没有评论 可以说不会出现这种情况
                    console.log('没有历史记录.');
                    $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + lang['history_text_empty'] + '</i>');
                    return;
                };

                // 计算pid出现次数
                let pidList = __comment.map(x => x.pid);
                let counts = new Object();
                pidList.forEach(x => counts[x] = counts[x] ? counts[x] + 1 : 1);
                const pidListSet = [...new Set(pidList)]; // 去重

                // 还原网页
                $('#outer').html(`
                <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
                    <tbody>
                        <tr>
                            <td class="embedded" align="center">
                                <h1 align="center"><span id="top"></span></h1><br><br>
                            </td>
                        </tr>
                    </tbody>
                </table>
                <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
                    <tbody>
                        <tr>
                            <td class="embedded">
                                <table width="100%" border="1" cellspacing="0" cellpadding="10">
                                    <tbody>
                                        <tr>
                                            <td id="comments" class="text">
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </td>
                        </tr>
                    </tbody>
                </table>`
                );

                // 还原标题
                $('span[id="top"]').html(__comment[0]['topics']);

                __comment.forEach(x => {
                    const bbcode_html = `<div style="margin-top: 8pt; margin-bottom: 8pt;">
            <table id="pid${x.pid}" border="0" cellspacing="0" cellpadding="0" width="100%">
                <tbody>
                    <tr>
                        <td class="embedded" width="99%">
                            <a href="forums.php?action=viewtopic&amp;topicid=${x.topicid}&amp;page=p${x.pid}#pid${x.pid}">#${x.pid}</a>
                            <!-- 论坛应该不能匿名发帖吧 -->
                            <span class="nowrap"><a href="userdetails.php?id=${x.userid}"><b>
                                        <bdo dir="ltr">${x.username}</bdo></b></a></span>&nbsp;
                            <time>${x.edit_time.replace('T', ' ')}</time>
                        </td>
                        <td class="embedded nowrap" width="1%">
                            <font class="big">#<b>${pidListSet.findIndex((a) => a == x.pid) + 1}</b> 楼&nbsp;&nbsp;</font>
                            <a href="#top"><img class="top" src="pic/trans.gif" alt="Top" title="${lang['back_to_top']}"></a>&nbsp;&nbsp;
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <table class="main-inner" border="1" cellspacing="0" cellpadding="5">
            <tbody>
                <tr>
                    <td class="rowfollow" width="150" valign="top" align="left" style="padding: 0px">
                        <img src="//u2.dmhy.org/pic/default_avatar.png" alt="avatar" width="150px">
                    </td>
                    <td class="rowfollow" valign="top"><br>
                        <div class="post-body" id="pid${x.pid}body">
                            <span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">
                            ${(() => {
                            if (x.action === 'edit') {
                                return `${bbcode2html(x.bbcode)}</bdo></span>
                                                ${(() => {
                                        if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                        else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                        else return `<p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p><br><br>`;
                                    })()}`;
                            } else {
                                return `${bbcode2html(x.bbcode)}<br><br></bdo></span>`;
                            };
                        })()}
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>`

                    if (counts[x.pid] > 1) {
                        console.log('有编辑记录 直接添加下拉菜单');
                        // 插入下拉菜单基本框架
                        if ($(`#history_comment${x.pid}_select`).length === 0) {
                            $('#comments').append(bbcode_html); // 先插入整体框架
                            console.log('添加下拉菜单基本框架');
                            $(`[id="pid${x.pid}"]`).find('td:last').before(`<td class="embedded nowrap" width="1%"><select name="type" id="history_comment${x.pid}_select" style="margin-top: 1px;"></select>&nbsp;&nbsp;</td>`);

                        };
                        // 向下拉菜单写入信息
                        $(`#history_comment${x.pid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                </option>`)
                    } else {
                        $('#comments').append(bbcode_html);
                    };
                });

                $("[id^=history_comment]").change(function () { // 监听菜单选择
                    let self = $(this).val();
                    for (let i = 0, len = __comment.length; i < len; i++) {
                        if (self != __comment[i].self) continue;
                        let html;
                        let x = __comment[i];
                        if (x.action === 'edit') {
                            html = `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>
                                    ${(() => {
                                    if ($('#locale_selection').val() === 'en_US') return `<p><font class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</font></p>`;
                                    else if ($('#locale_selection').val() === 'ru_RU') return `<p><font class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</font></p>`;
                                    else return `<br><p><font class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </font></p>`;
                                })()}`;
                        } else {
                            html = `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>`;
                        };
                        $(this).parents('[id^=pid]').parent().next().find('.post-body').html(html);
                        return;
                    };
                });

            } else {
                console.log('获取论坛评论错误');
                $('#outer').find('td.text').html(`${errorstr}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>${lang['history_text_error']}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a id="apifailure" href="javascript:void(0);" style="color:#FF1212">${lang['reset_token']}</a></i>`);
                $("#apifailure").click(function () {
                    let confirm = prompt("输入 YES 确认本次操作 (大写)");
                    if (confirm === 'YES') {
                        db.removeItem('key');
                        db.removeItem('token');
                        alert("成功");
                    };
                });
            };
        },
        error: function (d) {

        },
    });
};

async function forumCommentHistory() {
    db = localforage.createInstance({ name: "history" });

    $.ajax({
        type: 'post',
        url: 'https://u2.kysdm.com/api/v1/comment',
        contentType: "application/json",
        dataType: 'json',
        data: JSON.stringify({ "uid": user_id, "token": token, "topicid": topicid, "type": "forum" }),
        success: async function (d) {
            if (d.msg === 'success') {
                console.log('获取论坛评论成功');
                let __comment = d.data.comment[topicid].sort((a, b) => b.self - a.self);
                let pid_list = __comment.map(x => x.pid);
                let counts = new Object();
                pid_list.forEach(x => counts[x] = counts[x] ? counts[x] + 1 : 1);

                let pid_list_unique = Array.from(new Set(pid_list)).sort((a, b) => a - b); // 去重排序
                console.log(pid_list_unique);
                let p = $('#outer').find('p[align="center"]:first').text().replace(/\n/g, '<br>');
                let pg = /(?<p>\d+)<br>$/i.exec(p);
                let page_total = Number(pg.groups.p);  // 有多少页评论
                let page_now = Number($('#outer').find('p:first').find('.gray b:last').text());
                console.log(`现在在评论第 ${page_now} 页 | ${page_total}`);
                var pid_each = await db.getItem('forum_pid_each') || 0;; // 每页最大显示楼层数量 <当数据库没有值时，pid_list_valid会是空值，>

                if (page_now < page_total) {
                    // 评论完整填满一个页面时，计算单个页面最大显示评论数量
                    // 后期改动最大显示评论数量的数值后，直接进入帖子最后一页可能会出现不属于当前页面的评论
                    console.log(`页面评论数量达到最大值`);
                    pid_each = $('table[id^=pid]').length;
                    await db.setItem('forum_pid_each', pid_each);
                };

                var pid_list_valid = pid_list_unique.slice(pid_each * page_now - pid_each, pid_each * page_now);  // 截取属于当前页面的PID
                console.log(pid_list_valid);

                __comment.forEach(x => {
                    let del_tag = 1;
                    $('[id^="pid"]').each(function () {
                        let pid = $(this).find('[class="embedded"]').children('a').first().text().replace('#', '');  // 获取网页上每个评论的PID
                        if (x.pid == pid) {
                            del_tag = 0;  // 标记网页上有对应的PID
                            if (counts[pid] > 1) {
                                if ($(`#history_comment${pid}_select`).length === 0) $(this).find('td:last').before(`<td class="embedded nowrap" width="1%"><select name="type" id="history_comment${x.pid}_select" style="margin-top: 1px;"></select>&nbsp;&nbsp;</td>`);
                                $(`#history_comment${pid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                                ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                                ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                                </option>`);
                            };
                        };
                    });

                    if (del_tag === 1) {
                        // console.log(`${x.pid} | 被删除`);
                        if (!pid_list_valid.includes(x.pid)) return;  // 不属于当前页面的PID直接跳出
                        // 只看该作者 启用时，仅还原改用户的记录
                        let em = /authorid=(?<authorid>\d{1,5})/i.exec(location.search);
                        if (em && x.userid != em.groups.authorid) return true;

                        if ($('[id="pid10000000000"]').length === 0) {
                            $('[id="outer"]').find('td.text:first').append(
                                `<div style="margin-top: 8pt; margin-bottom: 8pt; display:none;">
                                    <table id="pid10000000000" border="0" cellspacing="0" cellpadding="0" width="100%">
                                        <tbody>
                                            <tr>
                                                <td class="embedded" width="99%">
                                                    <a href="javascript:void(0);">#10000000000</a>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>`
                            );
                        };

                        $('[id^="pid"]').each(function () {
                            let pid = $(this).find('[class="embedded"]').children('a').first().text().replace('#', '');  // 获取网页上每个评论的PID

                            if (x.pid < Number(pid)) {

                                const bbcode_html = `<div style="margin-top: 8pt; margin-bottom: 8pt;">
                                <table id="pid${x.pid}" border="0" cellspacing="0" cellpadding="0" width="100%">
                                    <tbody>
                                        <tr>
                                            <td class="embedded" width="99%">
                                                <a href="forums.php?action=viewtopic&amp;topicid=${x.topicid}&amp;page=p${x.pid}#pid${x.pid}">#${x.pid}</a>
                                                <!-- 论坛应该不能匿名发帖吧 -->
                                                <span class="nowrap">
                                                    <a href="userdetails.php?id=${x.userid}"><b>
                                                    <bdo dir="ltr">${x.username}</bdo></b></a></span>&nbsp;
                                                <time>${x.edit_time.replace('T', ' ')}</time>
                                            </td>
                                            <td class="embedded nowrap" width="1%">
                                                <a href="#top"><img class="top" src="pic/trans.gif" alt="Top" title="${lang['back_to_top']}"></a>&nbsp;&nbsp;
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <table class="main-inner" border="1" cellspacing="0" cellpadding="5">
                                <tbody>
                                    <tr>
                                        <td class="rowfollow" width="150" valign="top" align="left" style="padding: 0px">
                                            <img src="//u2.dmhy.org/pic/default_avatar.png" alt="avatar" width="150px">
                                        </td>
                                        <td class="rowfollow" valign="top"><br>
                                            <div class="post-body" id="pid${x.pid}body">
                                                <span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">
                                                ${(() => {
                                        if (x.action === 'edit') {
                                            return `${bbcode2html(x.bbcode)}</bdo></span>
                                                                    ${(() => {
                                                    if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                    else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                    else return `<p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p><br><br>`;
                                                })()}`;
                                        } else {
                                            return `${bbcode2html(x.bbcode)}<br><br></bdo></span>`;
                                        };
                                    })()}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>`

                                $(`[id="pid${pid}"]`).parent().before(bbcode_html);

                                if (counts[x.pid] > 1) {
                                    if ($(`#history_comment${x.pid}_select`).length === 0) $(`[id="pid${x.pid}"]`).find('td:last').before(`<td class="embedded nowrap" width="1%"><select name="type" id="history_comment${x.pid}_select"></td>`);
                                    $(`#history_comment${x.pid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                                ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                                ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                                </option>`);
                                };

                                return false;
                            };
                        });

                    };
                });

                $("[id^=history_comment]").change(function () { // 监听菜单选择
                    let self = $(this).val();
                    for (let i = 0, len = __comment.length; i < len; i++) {
                        if (self != __comment[i].self) continue;
                        let html;
                        let x = __comment[i];
                        if (x.action === 'edit') {
                            html = `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>
                                    ${(() => {
                                    if ($('#locale_selection').val() === 'en_US') return `<p><font class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</font></p>`;
                                    else if ($('#locale_selection').val() === 'ru_RU') return `<p><font class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</font></p>`;
                                    else return `<br><p><font class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </font></p>`;
                                })()}`;
                        } else {
                            html = `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>`;
                        };
                        $(this).parents('[id^=pid]').parent().next().find('.post-body').html(html);
                        return;
                    };
                });
            } else {
                console.log('获取论坛评论错误');
            };
        },
        error: function (d) {

        },
    });
};

async function torrentCommentHistory() {
    $.ajax({
        type: 'post',
        url: 'https://u2.kysdm.com/api/v1/comment',
        contentType: "application/json",
        dataType: 'json',
        data: JSON.stringify({ "uid": user_id, "token": token, "torrent_id": torrent_id, "type": "torrent" }),
        success: function (d) {
            if (d.msg === 'success') {
                console.log('获取种子评论成功');
                let __comment = d.data.comment[torrent_id].sort((a, b) => b.self - a.self);
                let cid_list = __comment.map(x => x.cid);
                let counts = new Object();
                cid_list.forEach(x => counts[x] = counts[x] ? counts[x] + 1 : 1);

                // let startcomments = $('#startcomments').text();
                if ($('[id^="cid"]').length === 0) {
                    // 候选没有评论 || 通过的种子没有评论
                    console.log('完全没有评论');
                    var cid_list_valid = Array.from(new Set(cid_list));
                } else {
                    // 有评论
                    let x = $('#startcomments').nextAll('p:first').text();
                    let pg = /(?<p>\d+)$/i.exec(x);
                    let page_total = Math.ceil(pg.groups.p / 10); // 有多少页评论
                    let cid_list_unique = Array.from(new Set(cid_list)).sort((a, b) => a - b);  // 去重排序
                    console.log(cid_list_unique);
                    let page_now = $('#startcomments').nextAll('p:first').find('.gray:last').text();
                    pg = /(?<p>\d+)$/i.exec(page_now);
                    for (let i = 1; i <= page_total; i++) {
                        if (Number(pg.groups.p) <= 10 * i) {
                            console.log(`现在在评论第 ${i} 页`);
                            var cid_list_valid = cid_list_unique.slice(10 * i - 10, 10 * i);  // 截取属于当前页面的评论
                            console.log(cid_list_valid);
                            break;
                        };
                    };
                };

                __comment.forEach(x => {
                    let del_tag = 1;
                    $('[id^="cid"]').each(function () {
                        let cid = $(this).find('[class="embedded"]').children('a').attr('name');
                        if (x.cid == cid) {
                            del_tag = 0; // 标记网页上有对应的CID
                            if (x.cid == cid && counts[cid] > 1) {
                                if ($(`#history_comment${cid}_select`).length === 0) $(this).find('td:last').before(`<td class="embedded nowrap" width="1%"><select name="type" id="history_comment${cid}_select" ></select>&nbsp;&nbsp;</td>`);
                                $(`#history_comment${cid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                        ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                        ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                        </option>`);
                            };
                        };
                    });

                    if (del_tag === 1) {
                        // console.log(`${x.cid} | 被删除`);
                        if (!cid_list_valid.includes(x.cid)) return;  // 不属于当前页面的评论直接跳出
                        if ($('[id^="cid"]').length === 0) {
                            // 所有评论都被删除
                            console.log('所有评论都被删除');
                            $('#outer').find('table:last').hide();
                            $('#outer').find('table:last').prevAll('br').remove();
                            $('#startcomments').remove();
                            $('#outer').find('table:last').before('<br><h1 id="startcomments" align="center">用户评论</h1>');
                            $('#outer').find('table:last').after(`<br>
                            <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
                                <tbody>
                                    <tr>
                                        <td class="embedded">
                                            <table width="100%" border="1" cellspacing="0" cellpadding="10">
                                                <tbody>
                                                    <tr>
                                                        <td class="text">
                                                            <div style="margin-top: 8pt; margin-bottom: 8pt; display:none;">
                                                                <table id="cid1000000000" border="0" cellspacing="0" cellpadding="0" width="100%">
                                                                    <tbody>
                                                                        <tr>
                                                                            <td class="embedded" width="99%">
                                                                                <a href="javascript:void(0);" name="1000000000">#1000000000</a>
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>`
                            );
                        } else if ($('[id="cid1000000000"]').length === 0) {
                            $('#startcomments').nextAll('table.main:first').find('.text').append(
                                `<div style="margin-top: 8pt; margin-bottom: 8pt; display:none;">
                                    <table id="cid1000000000" border="0" cellspacing="0" cellpadding="0" width="100%">
                                        <tbody>
                                            <tr>
                                                <td class="embedded" width="99%">
                                                    <a href="javascript:void(0);" name="1000000000">#1000000000</a>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>`);
                        };

                        $('[id^="cid"]').each(function () {
                            let cid = $(this).find('[class="embedded"]').children('a').attr('name'); // 获取网页上每个评论的CID

                            if (x.cid < Number(cid)) {
                                if (x.userid === null && x.username === null) {
                                    var userInfo = `<span style="color: gray">&nbsp;<i>${lang['anonymous']}</i>&nbsp;</span>`
                                } else {
                                    var userInfo = `<span style="color: gray">&nbsp;<span class="nowrap"><a href="userdetails.php?id=${x.userid}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span>`
                                }

                                const bbcode_html = `<div style="margin-top: 8pt; margin-bottom: 8pt;">
                                <table id="cid${x.cid}" border="0" cellspacing="0" cellpadding="0" width="100%">
                                    <tbody>
                                    <tr>
                                        <td class="embedded" width="99%">
                                            <a href="${cidUrl(x.torrent_id, x.cid)}" name="${x.cid}">#${x.cid}</a>
                                            ${userInfo}
                                            <span style="color: gray">&nbsp;<time>${x.edit_time.replace('T', ' ')}</time></span></span>
                                        </td>
                                        <td class="embedded nowrap" width="1%">
                                            <a href="#top"><img class="top" src="pic/trans.gif" alt="Top" title="Top"></a>&nbsp;&nbsp;
                                        </td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                            <table class="main-inner" width="100%" border="0" cellspacing="0" cellpadding="5">
                                <tbody>
                                    <tr>
                                        <td class="rowfollow" width="150" valign="top" style="padding: 0">
                                            <img src="//u2.dmhy.org/pic/default_avatar.png" alt="avatar" width="150px"></td>
                                        <td class="rowfollow" valign="top"><br>
                                        ${(() => {
                                        if (x.action === 'edit') {
                                            return `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>
                                                        ${(() => {
                                                    if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                    else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                    else return `<p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p><br><br>`;
                                                })()}`;
                                        } else {
                                            return `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}<br><br></bdo></span>`;
                                        };
                                    })()}
                                        </td>
                                        </tr>
                                        </tbody>
                                        </table>`;

                                $(`[id="cid${cid}"]`).parent().before(bbcode_html); // 先插入整体框架

                                if (counts[x.cid] > 1) {
                                    console.log('有编辑记录 直接添加下拉菜单');
                                    // 插入下拉菜单基本框架
                                    if ($(`#history_comment${x.cid}_select`).length === 0) {
                                        console.log('添加下拉菜单基本框架');
                                        $(`[id="cid${x.cid}"]`).find('td:last').before(`<td class="embedded nowrap" width="1%"><select name="type" id="history_comment${x.cid}_select" ></select>&nbsp;&nbsp;</td>`);
                                    };
                                    // 向下拉菜单写入信息
                                    $(`#history_comment${x.cid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                                                ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                                                ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                                                </option>`);
                                };

                                return false;
                            };

                        });
                    };

                });

                $("[id^=history_comment]").change(function () { // 监听菜单选择
                    let self = $(this).val();

                    for (let i = 0, len = __comment.length; i < len; i++) {
                        if (self != __comment[i].self) continue;
                        let html;
                        let x = __comment[i];
                        if (x.action === 'edit') {
                            html = `<br>
                            <span style="word-break: break-all; word-wrap: break-word;">
                                <bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo>
                            </span>
                                    ${(() => {
                                    if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p>`;
                                    else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p>`;
                                    else return `<br><p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p>`;
                                })()}`;

                        } else {
                            html = `<br>
                            <span style="word-break: break-all; word-wrap: break-word;">
                                <bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo>
                            </span>`;
                        };
                        $(this).parents('[id^=cid]').parent().next().find('[class="rowfollow"]:last').html(html);
                        return;
                    };
                });

            } else {
                console.log('获取种子评论错误');
            };
        },
        error: function (d) {

        },
    });
};


async function torrentInfoHistory() {
    if ($('h3').length === 1) { // 插入 select 基本框架
        const right = ($('#outer').width() - $('h3').next().width()) / 2 + 5; // 计算偏移量
        $('#top').after('<div id="hsty" style="position: relative;"><div id="history" style="position: absolute; right:' + right + 'px; margin-top: 4px;"><select name="type" id="history_select"></div></div>');
        $(window).resize(function () { $('#history').css("right", ($('#outer').width() - $('h3').next().width()) / 2 + 5); });
    } else {
        const right = ($('#outer').width() - $('#top').next().width()) / 2 + 5; // 计算偏移量
        $('#top').after('<div id="history" style="position: relative; float: right; margin-bottom: 10px; margin-right: ' + right + 'px"><select name="type" id="history_select"></div>');
        $(window).resize(function () { $('#history').css("margin-right", ($('#outer').width() - $('#history').next().width()) / 2 + 5 + 'px'); });
    };

    $("#history_select").append("<option>" + lang['history_select_loading'] + "</option>");

    const __json = await getapi(); // 从 API 获取数据

    if (__json.msg !== 'success') { // 加载失败时
        console.log('获取历史记录失败.');
        $("#history_select").empty(); // 插入前先清空 option
        $("#history_select").append('<option value="80000">' + lang['history_select_error'] + '</option>'); // 希望你不要看到这个 (ノДＴ)
        $("#history_select").append(`<option value="90000">${lang['reset_token']}</option>`); // 删除本地授权信息
        $("#history_select").change(function () { // 监听菜单选择
            let self = Number($(this).val());
            if (self === 90000) {
                let confirm = prompt("输入 YES 确认本次操作 (大写)");
                if (confirm === 'YES') {
                    db.removeItem('key');
                    db.removeItem('token');
                    $('#history_select').val(80000); // 将焦点设置到 80000
                    $('#history_select').change(); // 手动触发列表更改事件
                    alert("成功");
                } else {
                    $('#history_select').val(80000); // 将焦点设置到 80000
                    $('#history_select').change(); // 手动触发列表更改事件
                };
            };
        });
        return;
    };

    console.log('获取历史记录成功.');
    let history_data = __json.data.history;

    $("#history_select").empty(); // 插入前先清空 option
    for (let i = 0, len = history_data.length; i < len; i++) { // 循环插入到选择列表中
        $("#history_select").append("<option value='" + history_data[i].self + "'>"
            + history_data[i].get_time.replace('T', ' ')
            + ((edited_type) => {
                switch (edited_type) {
                    case 0: return ' H';  // 添加候选
                    case 1: return ' E';  // 普通用户编辑
                    case 2: return ' M';  // MOD编辑
                    case 3: return ' T';  // 允许候选
                    case 4: return ' U';  // 上传种子
                    case 5: return ' R';  // 还原被删除的种子
                    default: return ' ';  // 早期记录
                };
            })(history_data[i].edited_type)
            + (() => {
                if (history_data[i].self === 0) return lang['current_time']
                else if (history_data[i].edited_name === null && history_data[i].edited_id === null) return ''
                else if (history_data[i].edited_name === '匿名' && history_data[i].edited_id === null) return lang['anonymous_user']
                else if (history_data[i].edited_name !== null && history_data[i].edited_id !== null) return ' ' + history_data[i].edited_name + '(' + history_data[i].edited_id + ')'
                else return ' @BUG@'
            })()
            + "</option>");
    };

    // 草 为什么会这样呢 明明原来很整齐的
    $("#history_select").change(function () { // 监听菜单选择
        let self = Number($(this).val());
        for (let i = 0, len = history_data.length; i < len; i++) {
            if (self !== history_data[i].self) continue;
            history_data[i].banned === 1 ? $('#top').html(history_data[i].title + '&nbsp;&nbsp;&nbsp; <b>[<font class="striking">' + lang['banned'] + '</font>]</b>') : $('#top').text(history_data[i].title);
            // 检查副标题一栏是否存在
            if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 0 && history_data[i].subtitle !== null) {
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").parent().before('<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['subtitle'] + '</td><td class="rowfollow" valign="top" align="left"></td></tr>');
            }
            else if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 1 && history_data[i].subtitle === null) {
                $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").parent().remove();
            };
            $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").next().text(history_data[i].subtitle); // 副标题
            $("td[class='rowhead nowrap']:contains(" + lang['description'] + ")").last().next().html('<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">' + bbcode2html(history_data[i].description_info) + '</bdo></span>'); // 描述
            if ($('h3').length === 1) { // 已经通过候选的种子
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").next().html(((p) => {
                    if (p.uploader_id === null && p.uploader_name === '匿名') return '<i>' + lang['anonymous'] + '</i>'; // 匿名发布
                    if (p.uploader_id === null && p.uploader_name !== '匿名') return p.uploader_name; // 自定义署名 不带UID
                    if (p.uploader_id !== null && p.uploader_name !== '匿名') return '<a href="userdetails.php?id=' + p.uploader_id + '"><b>' + p.uploader_name + '</b></a>'; // 正常显示 || 自定义署名 带UID
                })(history_data[i])); // 发布人
                $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html('<b>' + lang['uploaded_at'] + ':</b> ' + history_data[i].uploaded_at.replace('T', ' ')
                    + (() => { if (history_data[i].torrent_size) { return '&nbsp;&nbsp;&nbsp;<b>' + lang['size'] + ':</b>&nbsp;' + convert(history_data[i].torrent_size) } else { return ''; } })()
                    + '&nbsp;&nbsp;&nbsp;<b>' + lang['category'] + ':</b> ' + history_data[i].category)
            } else { // 还在候选的种子
                $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html('<b>' + lang['submitted_by'] + '</b>:&nbsp;'
                    + ((p) => {
                        if (p.uploader_id === null && p.uploader_name === '匿名') return '<i>' + lang['anonymous'] + '</i>'; // 匿名发布
                        if (p.uploader_id !== null && p.uploader_name !== '匿名') return '<a href="userdetails.php?id=' + p.uploader_id + '"><b>' + p.uploader_name + '</b></a>'; // 正常显示
                    })(history_data[i])
                    + '&nbsp;&nbsp;&nbsp;<b>' + lang['submitted_at'] + '</b>:&nbsp;<time>'
                    + history_data[i].uploaded_at.replace('T', ' ')
                    + '</time>&nbsp;&nbsp;&nbsp;<b>'
                    + (() => { if (history_data[i].torrent_size) { return `${lang['size']}</b>:&nbsp;${convert(history_data[i].torrent_size)}&nbsp;&nbsp;&nbsp;<b>` } else { return ''; } })()
                    + lang['category'] + '</b>:&nbsp;'
                    + history_data[i].category
                );
            };
        };
    });
};

async function torrentCommentHistoryReset() {

    const callback = (mutations, observer) => {
        mutations.forEach(function (mutation) {
            if (mutation.addedNodes.length === 0) return;

            console.log('检测到种子页面已经完成加载');
            observer.disconnect(); // 停止监听

            $('#description').after(`<br><br><h1 align="center" id="startcomments" style="font-weight:normal; font-style: italic">正在加载用户评论...</h1><br>`);
            $.ajax({
                type: 'post',
                url: 'https://u2.kysdm.com/api/v1/comment',
                contentType: "application/json",
                dataType: 'json',
                data: JSON.stringify({ "uid": user_id, "token": token, "torrent_id": torrent_id, "type": "torrent" }),
                success: function (d) {
                    if (d.msg !== 'success') { console.log('获取种子评论错误'); }
                    else {
                        console.log('获取种子评论成功');
                        let __comment = d.data.comment[torrent_id].sort(firstBy((a, b) => a.cid - b.cid).thenBy((a, b) => b.self - a.self)); // 如果用self排序，消息顺序不正确，则改用编辑日期排序
                        if (__comment.length === 0) { // 没有评论
                            $('#startcomments').text('没有评论');
                            $('#startcomments').removeAttr("style");
                            return;
                        } else {
                            $('#startcomments').text('用户评论');
                            $('#startcomments').removeAttr("style");
                        };

                        let cidList = __comment.map(x => x.cid);
                        let counts = new Object();
                        cidList.forEach(x => counts[x] = counts[x] ? counts[x] + 1 : 1);

                        $('#startcomments').after(`<br>
                        <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
                            <tbody>
                                <tr>
                                    <td class="embedded">
                                        <table width="100%" border="1" cellspacing="0" cellpadding="10">
                                            <tbody>
                                                <tr>
                                                    <td id="comments" class="text"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>`
                        );

                        __comment.forEach(x => {
                            if (x.userid === null && x.username === null) {
                                var userInfo = `<span style="color: gray">&nbsp;<i>${lang['anonymous']}</i>&nbsp;</span>`
                            } else {
                                var userInfo = `<span style="color: gray">&nbsp;<span class="nowrap"><a href="userdetails.php?id=${x.userid}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span>`
                            }

                            const bbcode_html = `<div style="margin-top: 8pt; margin-bottom: 8pt;">
                            <table id="cid${x.cid}" border="0" cellspacing="0" cellpadding="0" width="100%">
                                <tbody>
                                <tr>
                                    <td class="embedded" width="99%">
                                        <a href="${cidUrl(x.torrent_id, x.cid)}" name="${x.cid}">#${x.cid}</a>
                                        ${userInfo}
                                        <span style="color: gray">&nbsp;<time>${x.edit_time.replace('T', ' ')}</time></span></span>
                                    </td>
                                    <td class="embedded nowrap" width="1%">
                                        <a href="#top"><img class="top" src="pic/trans.gif" alt="Top" title="Top"></a>&nbsp;&nbsp;
                                    </td>
                                </tr>
                                </tbody>
                            </table>
                        </div>
                        <table class="main-inner" width="100%" border="0" cellspacing="0" cellpadding="5">
                            <tbody>
                                <tr>
                                    <td class="rowfollow" width="150" valign="top" style="padding: 0">
                                        <img src="//u2.dmhy.org/pic/default_avatar.png" alt="avatar" width="150px"></td>
                                    <td class="rowfollow" valign="top"><br>
                                    ${(() => {
                                    if (x.action === 'edit') {
                                        return `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo></span>
                                                    ${(() => {
                                                if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                                else return `<p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p><br><br>`;
                                            })()}`;
                                    } else {
                                        return `<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">${bbcode2html(x.bbcode)}<br><br></bdo></span>`;
                                    };
                                })()}
                                    </td>
                                    </tr>
                                    </tbody>
                                    </table>`;

                            if (counts[x.cid] > 1) {
                                console.log('有编辑记录 直接添加下拉菜单');
                                // 插入下拉菜单基本框架
                                if ($(`#history_comment${x.cid}_select`).length === 0) {
                                    $('#comments').append(bbcode_html); // 先插入整体框架
                                    console.log('添加下拉菜单基本框架');
                                    $(`[id="cid${x.cid}"]`).find('[class="embedded nowrap"]').before(`<div id="hsty" style="position: relative;">
                                                                                                    <div id="history_comment" style="position: absolute; right:10px; margin-top: -2px;">
                                                                                                    <select name="type" id="history_comment${x.cid}_select">
                                                                                                    </div>
                                                                                                    </div>`);
                                };
                                // 向下拉菜单写入信息
                                $(`#history_comment${x.cid}_select`).append(`<option value="${x.self}">${x.edit_time.replace('T', ' ')}
                                    ${(() => { return x.action === 'edit' ? ' E' : x.action === 'reply' ? ' R' : ' N' })()}
                                    ${(() => { return x.username === null && x.userid === null ? lang['anonymous_user'] : ` ${x.username}(${x.userid})` })()}
                                    </option>`)
                            } else {
                                $('#comments').append(bbcode_html);
                            };
                        });

                        $("[id^=history_comment]").change(function () { // 监听菜单选择
                            let self = $(this).val();
                            for (let i = 0, len = __comment.length; i < len; i++) {
                                if (self != __comment[i].self) continue;
                                let html;
                                let x = __comment[i];
                                if (x.action === 'edit') {
                                    html = `<br>
                                    <span style="word-break: break-all; word-wrap: break-word;">
                                    <bdo dir="ltr">${bbcode2html(x.bbcode)}</bdo>
                                    </span>
                                            ${(() => {
                                            if ($('#locale_selection').val() === 'en_US') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> at <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                            else if ($('#locale_selection').val() === 'ru_RU') return `<p class="small">${lang['last_edited']} <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> в <time>${x.edit_time.replace('T', ' ')}</time>.</p><br><br>`;
                                            else return `<br><p class="small">[<time>${x.edit_time.replace('T', ' ')}</time>] <span class="nowrap"><a href="userdetails.php?id=${x.user_id}"><b><bdo dir="ltr">${x.username}</bdo></b></a></span> ${lang['last_edited']} </p><br><br>`;
                                        })()}`;
                                } else {
                                    html = `<br>
                                    <span style="word-break: break-all; word-wrap: break-word;">
                                    <bdo dir="ltr">${bbcode2html(x.bbcode)}<br><br></bdo>
                                    </span>`;
                                };
                                $(this).parents('[id^=cid]').parent().next().find('[class="rowfollow"]:last').html(html);
                                return;
                            };
                        });
                    };
                },
                error: function (d) {
                },
            });
        })
    };

    const MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    const element = document.getElementById("outer");
    var observer = new MutationObserver(callback);
    observer.observe(element, { childList: true });
};

async function torrentInfoHistoryReset() {
    const errorstr = $('#outer').find('td.text').text();
    // 正在努力加载中...
    $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>' + lang['history_text_loading'] + '</i>');

    const __json = await getapi(); // 从 API 获取数据

    if (__json.msg !== 'success') { // 加载失败时
        console.log('获取历史记录失败.');
        $('#outer').find('td.text').html(`${errorstr}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>${lang['history_text_error']}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<a id="apifailure" href="javascript:void(0);" style="color:#FF1212">${lang['reset_token']}</a></i>`);
        $("#apifailure").click(function () {
            let confirm = prompt("输入 YES 确认本次操作 (大写)");
            if (confirm === 'YES') {
                db.removeItem('key');
                db.removeItem('token');
                alert("成功");
            };
        });

        return;
    } else if (__json.data.history.length === 0) { // 获取成功 但没有历史记录时
        console.log('没有历史记录.');
        $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + lang['history_text_empty'] + '</i>');
        return;
    };

    console.log('获取历史记录成功.');
    let history_data = __json.data.history;
    // let gdListObj = JSON.parse(localStorage.getItem("u2_gd_list")); // 读取谷歌备份列表
    // 还原网页
    $('#outer').html('<h1 align="center" id="top">'
        + (() => { return history_data[0].banned === 1 ? history_data[0].title + '&nbsp;&nbsp;&nbsp; <b>[<font class="striking">' + lang['banned'] + '</font>]</b>' : history_data[0].title; })()
        + '</h1>'
        + '<div id="hsty" style="position: relative;"><div id="history" style="position: absolute; right:75px; margin-top: 4px;">'
        + '<select name="type" id="history_select" style="visibility: visible;"></select></div></div>'
        + '<h3>(#' + torrent_id + ')</h3>'
        + '<table id="description" width="90%" min-width="940px" cellspacing="0" cellpadding="5"><tbody><tr><td class="rowhead" width="13%">' + lang['torrent_title'] + '</td>'
        + '<td class="rowfollow" width="87%" align="left">'
        + '<b>[U2].' + history_data[0].torrent_name + '.torrent</b></td></tr>'
        + (() => { return history_data[0].subtitle ? '<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['subtitle'] + '</td><td class="rowfollow" valign="top" align="left">' + history_data[0].subtitle + '</td></tr></td></tr>' : '' })()
        + '<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['basic_info'] + '</td>'
        + '<td class="rowfollow" valign="top" align="left"><b>' + lang['submitted_by'] + '</b>:&nbsp;'
        + ((p) => {
            if (p.uploader_id === null && p.uploader_name === '匿名') return '<i>' + lang['anonymous'] + '</i>'; // 匿名发布
            if (p.uploader_id !== null && p.uploader_name !== '匿名') return '<a href="userdetails.php?id=' + p.uploader_id + '"><b>' + p.uploader_name + '</b></a>'; // 正常显示
        })(history_data[0])
        + '&nbsp;&nbsp;&nbsp;<b>' + lang['submitted_at'] + '</b>:&nbsp;<time>' + history_data[0].uploaded_at.replace('T', ' ')
        + '</time>'
        + (() => { if (history_data[0].torrent_size) { return '&nbsp;&nbsp;&nbsp;<b>大小:</b>&nbsp;' + convert(history_data[0].torrent_size) } else { return ''; } })()
        + '&nbsp;&nbsp;&nbsp;<b>' + lang['category'] + '</b>:&nbsp;' + history_data[0].category
        // + (() => {
        //     const r = '&nbsp;&nbsp;&nbsp;<b>' + lang['google_backup'] + '</b>:&nbsp;'
        //     if (gdListObj === null) return ``; // 列表不存在时，直接返回
        //     const gdList = gdListObj.list; // 载入种子列表
        //     let d = gdList.findIndex((value) => value == Number(torrent_id)); // 查找数据库中是否有备份，没有返回-1
        //     if (d === -1) return r + `×`;  // 没有备份时
        //     return `${r}<a href="sendmessage.php?receiver=45940#${torrent_id}" target="_blank" title="${lang['google_send']}">√</a>`
        // })()
        + '</td></tr>'
        + '<tr><td class="rowhead nowrap" valign="top" align="right">'
        + '<a href="javascript: klappe_news(\'descr\')"><span class="nowrap">'
        + '<img class="minus" src="pic/trans.gif" alt="Show/Hide" id="picdescr" title="' + lang['show_or_hide'] + '"> ' + lang['description'] + '</span></a></td>'
        + '<td class="rowfollow" valign="top" align="left">'
        + '<div id="kdescr"><span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">'
        + bbcode2html(history_data[0].description_info) + '</bdo></span></div></td></tr><tr>'
        + '<td class="rowhead nowrap" valign="top" align="right">' + lang['torrent_info'] + '</td>'
        + `<td id="file_tree" class="rowfollow" valign="top" align="left"></td></tr></tbody></table></td></tr></tbody></table><br><br></br>`
    );

    const putFileTree = (__json) => {
        // 插入ID
        let counter = 0;
        const InsertSeq = (data) => {
            for (key in data) {
                data[key]['id'] = counter;
                counter++;
                if (data[key]['type'] == 'directory') InsertSeq(data[key]['children']);
            };
            return data;
        };
        // 获取文件ID
        const getFile = (data) => {
            let a = []
            for (key in data) {
                if (data[key]['type'] == 'file') a.push(data[key]['id']);
            };
            a = a.concat(getDirectory(data));
            return a;
        };
        // 获取文件夹ID
        const getDirectory = (data, directory = []) => {
            for (key in data) {
                if (data[key]['type'] == 'directory') directory.push(data[key]['id']);
            };
            return directory;
        };
        // 获取文件体积
        const getSize = (data, size = 0) => {
            // console.log(data);
            for (key in data) {
                if (data[key]['type'] == 'file') {
                    size = size + data[key]['length'];
                } else {
                    size = getSize(data[key]['children'], size);
                };
            }
            return size;
        };
        // 遍历JSON
        const tree = (j, i) => {
            for (let key in j) {
                // console.log(j);
                // console.log(j['key']);
                if (j[key]['type'] == 'directory') {
                    let children = j[key]['children'];
                    let f_id_sh = getFile(children);  // 获取文件夹需要的id
                    let f_size = convert(getSize(children))  // 文件夹大小
                    if (f_id === 0) {
                        f_html = f_html + `<tr id="f_id_0" tag="closed"><td class="rowfollow"><a href="javascript:void(0)" onclick="showorhide([${f_id_sh}],0)" class="faqlink">${key}</a></td><td class="rowfollow dir_size" align="right">[${f_size}]</td></tr>`;
                    } else {
                        f_html = f_html + `<tr id="f_id_${f_id}" style="display: none;" tag="closed"><td class="rowfollow">${space.repeat(i)}<a href="javascript:void(0)" onclick="showorhide([${f_id_sh}],${f_id})" class="faqlink">${key}</a></td><td class="rowfollow dir_size" align="right">[${f_size}]</td></tr>`;
                    };
                    f_id++;
                    tree(children, i + 1);
                }
                else {
                    if (f_id === 0) {
                        // 单文件种子
                        f_html = f_html + `<tr id="f_id_${f_id}"><td class="rowfollow">${space.repeat(i)}${key}</td><td class="rowfollow" align="right">${convert(j[key]['length'])}</td></tr>`;
                    } else {
                        f_html = f_html + `<tr id="f_id_${f_id}" style="display: none;"><td class="rowfollow">${space.repeat(i)}${key}</td><td class="rowfollow" align="right">${convert(j[key]['length'])}</td></tr>`;
                    };
                    f_id++;
                };
            };
        };

        // let __json = history_data[0].torrent_tree;
        if (__json === null) {
            // console.log('tree 为空');
            $('#file_tree').html(
                `<table>
                    <tbody>
                        <tr>
                            <td class="no_border_wide"><b>${lang['files']}</b>: ${history_data[0].torrent_files_qty}<br></td>
                            <td class="no_border_wide"><b>${lang['info_hash']}:</b>&nbsp;${history_data[0].torrent_hash}</td>
                        </tr>
                    </tbody>
                </table>`
            );
            return;
        };
        __json = stringify(__json, function (a, b) {
            // 对keys排序
            if (typeof (a.value) !== 'object' || typeof (b.value) !== 'object') return 0;
            if (a.value.type === 'directory' && b.value.type === 'file') {
                return -1;
            } else if (a.value.type === 'file' && b.value.type === 'directory') {
                return 1;
            } else {
                return a.key.toLowerCase() < b.key.toLowerCase() ? -1 : 1;
            };
        });
        __json = JSON.parse(__json);
        __json = InsertSeq(__json);
        // console.log(__json);
        let f_id = 0;  // 元素id
        let f_html = '';  // 文件列表
        const space = '&nbsp;&nbsp;&nbsp;&nbsp;';  // 缩进
        tree(__json, 0);
        // $('#filelist').find('tr').after(f_html);
        $('#file_tree').html(
            `<table>
                <tbody>
                    <tr>
                        <td class="no_border_wide"><b>${lang['files']}</b>: ${history_data[0].torrent_files_qty}<br>
                        <span id="showfl" style="display: inline;">
                            <a href="javascript: viewfilelist()">[查看列表]</a>
                        </span>
                        <span id="hidefl" style="display: none;">
                            <a href="javascript: hidefilelist()">[隐藏列表]</a>
                        </span>
                        ${(() => {
                return f_id > 1
                    ? `<span id="expandall" style="display: none;"><a href="javascript: expandall(true)">[全部展开]</a></span>
                            <span id="closeall" style="display: none;"><a href="javascript: expandall(false)">[全部关闭]</a></span>`
                    : ''
            })()}
                        </td>
                        <td class="no_border_wide"><b>${lang['info_hash']}:</b>&nbsp;${history_data[0].torrent_hash}</td>
                    </tr>
                </tbody>
            </table>
            <span id="filelist" style="display: none;">
                <style>
                    .dir_size {
                        color: gray;
                        white-space: nowrap;
                    }
                </style>
                <table border="1" cellspacing="0" cellpadding="5">
                    <tbody>
                        <tr>
                            <td class="colhead">路径</td>
                            <td class="colhead" align="center"><img class="size" src="pic/trans.gif" alt="size"></td>
                        </tr>
                        ${f_html}
                    </tbody>
                </table>
            </span>`
        );
    };
    putFileTree(history_data[0].torrent_tree);  // 运行一次，生成列表

    for (let i = 0, len = history_data.length; i < len; i++) { // 循环插入到选择列表中
        $("#history_select").append("<option value='" + history_data[i].self + "'>"
            + history_data[i].get_time.replace('T', ' ')
            + ((edited_type) => {
                switch (edited_type) {
                    case 0: return ' H';  // 添加候选
                    case 1: return ' E'  // 普通用户编辑
                    case 2: return ' M'  // MOD编辑
                    case 3: return ' T'  // 允许候选
                    case 4: return ' U'  // 上传种子
                    case 5: return ' R';  // 还原被删除的种子
                    default: return ' '  // 早期记录
                };
            })(history_data[i].edited_type)
            + (() => {
                if (history_data[i].self === 0) return lang['current_time']
                else if (history_data[i].edited_name === null && history_data[i].edited_id === null) return ''
                else if (history_data[i].edited_name === '匿名' && history_data[i].edited_id === null) return lang['anonymous_user']
                else if (history_data[i].edited_name !== null && history_data[i].edited_id !== null) return ' ' + history_data[i].edited_name + '(' + history_data[i].edited_id + ')'
                else return ' @BUG@'
            })()
            + "</option>");
    };

    $("#history_select").change(function () { // 监听菜单选择
        let self = Number($(this).val());
        for (let i = 0, len = history_data.length; i < len; i++) {
            if (self !== history_data[i].self) continue;
            history_data[i].banned === 1 ? $('#top').html(history_data[i].title + '&nbsp;&nbsp;&nbsp; <b>[<font class="striking">' + lang['banned'] + '</font>]</b>') : $('#top').text(history_data[i].title);
            // 检查副标题一栏是否存在
            if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 0 && history_data[i].subtitle !== null) {
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").parent().before('<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['subtitle'] + '</td><td class="rowfollow" valign="top" align="left"></td></tr>');
            }
            else if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 1 && history_data[i].subtitle === null) {
                $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").parent().remove();
            };
            $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").next().text(history_data[i].subtitle); // 副标题
            $("td[class='rowhead nowrap']:contains(" + lang['description'] + ")").last().next().html('<span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">' + bbcode2html(history_data[i].description_info) + '</bdo></span>'); // 描述
            $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html('<b>' + lang['submitted_by'] + '</b>:&nbsp;'
                + ((p) => {
                    if (p.uploader_id === null && p.uploader_name === '匿名') return '<i>' + lang['anonymous'] + '</i>'; // 匿名发布
                    if (p.uploader_id !== null && p.uploader_name !== '匿名') return '<a href="userdetails.php?id=' + p.uploader_id + '"><b>' + p.uploader_name + '</b></a>'; // 正常显示
                })(history_data[i])
                + '&nbsp;&nbsp;&nbsp;<b>' + lang['submitted_at'] + '</b>:&nbsp;<time>' + history_data[i].uploaded_at.replace('T', ' ')
                + '</time>'
                + (() => { if (history_data[i].torrent_size) { return '&nbsp;&nbsp;&nbsp;<b>' + lang['size'] + ':</b>&nbsp;' + convert(history_data[i].torrent_size) } else { return ''; } })()
                + '&nbsp;&nbsp;&nbsp;<b>' + lang['category'] + '</b>:&nbsp;' + history_data[i].category
            );
            putFileTree(history_data[i].torrent_tree);
        };
    });
};


function bbcode2html(bbcodestr) {
    const f_reg = new RegExp("^\"?\"?$|^(?:&quot;)?(?:&quot;)?$");

    var tempCode = new Array();
    var tempCodeCount = 0;

    function addTempCode(value) {
        tempCode[tempCodeCount] = value;
        let returnstr = "<tempCode_" + tempCodeCount + ">";
        tempCodeCount++;
        return returnstr;
    }

    const escape_reg = new RegExp("[&\"\'<>]", "g");
    bbcodestr = bbcodestr.replace(escape_reg, function (s, x) {
        switch (s) {
            case '&':
                return '&amp;';
            case '"':
                return '&quot;';
            case "'":
                return '&#039;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            default:
                return s;
        }
    });

    bbcodestr = bbcodestr.replace(/  /g, () => { return ' &nbsp;' });
    bbcodestr = bbcodestr.replace(/\r\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\r/g, () => { return '<br>' });

    // info/code 标签
    const info_reg = new RegExp("\\[(mediainfo|info|code)\\](.+?)\\[\\/(\\1)\\]", "gis");
    bbcodestr = bbcodestr.replace(info_reg, function (s, x, y) {
        switch (x) {
            case 'info':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: blue">'
                    + lang['info'] + '</span></b></legend>' + y + '</fieldset>');
            case 'mediainfo':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: red">'
                    + lang['mediainfo'] + '</span></b></legend>' + y + '</fieldset>');
            case 'code':
                return addTempCode(`<br><div class="codetop">${lang['code']}</div><div class="codemain">${y}</div><br />`);
            default:
                return s;
        }
    });

    // 超链接 (绝对)
    bbcodestr = bbcodestr.replace(/\[url=((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\](.+?)\[\/url\]/gis, function (s, x, y, z) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + z + '</a>');
    });

    bbcodestr = bbcodestr.replace(/\[url\]((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\[\/url\]/gis, function (s, x) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>')
    });

    // 超链接 (相对)
    bbcodestr = bbcodestr.replace(/\[url=(((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\](.+?)\[\/url\]/gis, function (s, x, y, z) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + z + '</a>');
    });

    bbcodestr = bbcodestr.replace(/\[url\](((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\[\/url\]/gis, function (s, x) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>')
    });

    // 单个标签 不带参
    const o_reg = new RegExp("\\[(\\*|siteurl|site)\\]", "gi");
    bbcodestr = bbcodestr.replace(o_reg, function (s, x, y) {
        switch (x) {
            case '*':
                return '<img class="listicon listitem" src="pic/trans.gif" alt="list">';
            case 'site':
                return 'U2分享園@動漫花園';
            case 'siteurl':
                return 'https://u2.dmhy.org';
            default:
                return s;
        }
    });

    // 成对标签 带参
    const d_reg = new RegExp("\\[(rt|font)=([^\\]]+)\\](.*?)\\[(/\\1)\\]", "gis");
    while (d_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(d_reg, function (s, w, x, y, z) {
            switch (w) {
                case 'rt':
                    if (f_reg.test(x)) {
                        return '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + w) + '=' + x + ']'
                            + y + '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + z) + ']'
                    }
                    else {
                        return addTempCode('<ruby>' + y + '<rp>(</rp><rt>' + x.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1") + '</rt><rp>)</rp></ruby>');
                    }
                case 'font':
                    if (f_reg.test(x)) {
                        return '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + w) + '=' + x + ']'
                            + y + '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + z) + ']';
                    }
                    else {
                        return '<span style="font-family: ' + x.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1") + '">' + y + '</span>';
                    }
                default:
                    return s;
            }
        })
    };

    // 成对标签 不带参
    const a_reg = new RegExp("\\[(pre|b|i|u|s)\\](.*?)\\[/(\\1)\\]", "gs");
    while (a_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(a_reg, function (s, x, y, z) {
            switch (x) {
                case 'b':
                    return '<b>' + y + '</b>';
                case 'i':
                    return '<em>' + y + '</em>';
                case 'u':
                    return '<u>' + y + '</u>';
                case 's':
                    return '<s>' + y + '</s>';
                case 'pre':
                    return '<pre>' + y + '</pre>';
                default:
                    return s;
            }
        })
    };

    // 颜色
    const color_reg = new RegExp("\\[color=(?:&quot;)?([#0-9a-z]{1,15}|[a-z]+?)(?:&quot;)?\\](.*?)\\[/color\\]", "gis");
    while (color_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(color_reg, function (s, x, y) {
            return '<span style="color: ' + x + '">' + y + '</span>';
        })
    };

    // 文字大小
    const size_reg = new RegExp("\\[size=(?:&quot;)?([1-7])(?:&quot;)?\\](.*?)\\[/size\\]", "gis");
    while (size_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(size_reg, function (s, x, y) {
            return '<font size="' + x + '">' + y + '</font>';
        })
    };

    // 图片
    bbcodestr = bbcodestr.replace(/\[(img|imglnk)\]([^\]]+)\[\/(?:\1)\]/gi, function (s, x, y) {
        if (/^((?!&lt;|&gt;|"|>|'|<|;|\(|\)|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(y)) {
            // url 以 .png 之类结尾
            switch (x) {
                case 'img':
                    return addTempCode('<img alt="image" src="' + y + '" style="height: auto; width: auto; max-width: 100%;">');
                case 'imglnk':
                    return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + y + '"><img alt="image" src="'
                        + y + '" style="height: auto; width: auto; max-width: 100%;"></a>');
            };
        };
        return addTempCode(s);
    });

    bbcodestr = bbcodestr.replace(/\[img=([^\]]+)\]/gi, function (s, x) {
        if (/^((?!&lt;|&gt;|"|>|'|<|;|\(|\)|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(x)) {
            // url 以 .png 之类结尾
            return addTempCode('<img alt="image" src="' + x + '" style="height: auto; width: auto; max-width: 100%;">');
        };
        return s;
    });

    // 没有bbcode包裹的超链接
    bbcodestr = bbcodestr.replace(/((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)/gi, function (s, x) {
        return '<a class="faqlink" rel="nofollow noopener noreferer" href="' + s + '">' + s + '</a>';
    });

    // 引用
    const quote_reg1 = new RegExp("\\[quote\\](.*?)\\[/quote\\]", "gsi");
    while (quote_reg1.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(quote_reg1, function (s, x) {
            return '<fieldset><legend>' + lang['quote'] + '</legend>' + x + '</fieldset>';
        });
    };
    const quote_reg2 = new RegExp("\\[quote=([^\\[\\]]*)\\](.*?)\\[/quote\\]", "gsi");
    while (quote_reg2.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(quote_reg2, function (s, x, y) {
            if (f_reg.test(x)) {
                return '<fieldset><legend>' + lang['quote'] + '</legend>' + y + '</fieldset>';
            }
            else {
                return '<fieldset><legend>' + lang['quote'] + ': ' + x.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1") + '</legend>' + y + '</fieldset>';
            }
        });
    };

    // spoiler
    const spoiler_reg1 = new RegExp("\\[spoiler\\](.*?)\\[/spoiler\\]", "gsi");
    const spoiler_reg2 = new RegExp("\\[spoiler=([^\\]]+)\\](.*?)\\[/spoiler\\]", "gsi");
    while (spoiler_reg1.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg1, function (s, x) {
            return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                + lang['spoiler'] + '&nbsp;&nbsp;'
                + '<button class="spoiler-button-show">' + lang['spoiler_button_1'] + '</button>'
                + '<button class="spoiler-button-hide" style="display: none;">' + lang['spoiler_button_2'] + '</button>'
                + '</td></tr><tr><td><span class="spoiler-content">'
                + x + '</span></td></tr></tbody></table>';
        });
    };
    while (spoiler_reg2.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg2, function (s, x, y) {
            if (f_reg.test(x)) {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + lang['spoiler'] + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show">' + lang['spoiler_button_1'] + '</button>'
                    + '<button class="spoiler-button-hide" style="display: none;">' + lang['spoiler_button_2'] + '</button>'
                    + '</td></tr><tr><td><span class="spoiler-content">'
                    + y + '</span></td></tr></tbody></table>';
            }
            else {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + x.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1") + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show">' + lang['spoiler_button_1'] + '</button>'
                    + '<button class="spoiler-button-hide" style="display: none;">' + lang['spoiler_button_2'] + '</button>'
                    + '</td></tr><tr><td><span class="spoiler-content">'
                    + y + '</span></td></tr></tbody></table>';
            }
        });
    };

    // 表情
    const em_reg = new RegExp("\\[(em[1-9][0-9]*)\\]", "gi");
    bbcodestr = bbcodestr.replace(em_reg, function (s, x) {
        switch (x) {
            case (x.match(/^em[1-9][0-9]*/i) || {}).input:
                return '<img src="pic/smilies/' + x.replace("em", "") + '.gif" alt="[' + x + ']">';
            default:
                return s;
        }
    })

    for (let i = 0, len = tempCode.length; i < len; i++) {
        // console.log(i + " : " + tempCode[i]);
        bbcodestr = bbcodestr.replace("<tempCode_" + i + ">", tempCode[i]);
    }

    bbcodestr = bbcodestr.replace(/p3F#oW2@cEn_JHstp-&37DgD/g, "");

    if (/(<br>)$/.test(bbcodestr)) { bbcodestr = bbcodestr + '<br>' };

    var htmlobj = $.parseHTML('<div>' + bbcodestr + '</div>');

    $(htmlobj).children('fieldset').children('fieldset').children('fieldset').children('fieldset').each(function () {
        $(this).html($(this).html().replace(/(^<legend>[^<]*?<\/legend>)(.*)/i, function (s, x, y) {
            return x + '<table class="spoiler" width="100%"><tbody>'
                + '<tr><td class="colhead">' + lang['auto_fold'] + '&nbsp;&nbsp;'
                + '<button class="spoiler-button-show">' + lang['spoiler_button_1'] + '</button>'
                + '<button class="spoiler-button-hide" style="display: none;">' + lang['spoiler_button_2'] + '</button>'
                + '</td></tr><tr><td><span class="spoiler-content">'
                + y + '</span></td></tr></tbody></table>';
        }))
    });

    return $(htmlobj).html();
};


function getapi() {
    return new Promise((resolve, reject) => {
        // https://www.w3school.com.cn/jquery/ajax_ajax.asp
        $.ajax({
            type: 'get',
            url: 'https://u2.kysdm.com/api/v1/history?token=' + token + '&maximum=50&uid=' + user_id + '&torrent=' + torrent_id,
            contentType: 'application/json',
            dataType: 'json',
            cache: true,
            success: r => resolve(r),
            error: r => {
                console.log('发生错误，HTTP状态码[' + r.status + ']。');
                reject(r.status)
            },
        });
    }).catch(() => { return { "state": "404", "msg": "failure", "data": { "history": [] } }; });
};


function lang_init(lang) {
    const lang_json = {
        "zh_CN": {
            "quote": "引用",
            "info": "发布信息",
            "mediainfo": "媒体信息",
            "code": "代码",
            "spoiler": "警告！下列文字很可能泄露剧情，请谨慎选择是否观看。",
            "spoiler_button_1": "我就是手贱",
            "spoiler_button_2": "我真是手贱",
            "main_title": "主标题",
            "rt_text": "请输入上标",
            "main_body": "请输入正文",
            "main_body_prefix": "请输入标题",
            "url_name": "请输入网址名称",
            "url_link": "请输入网址链接",
            "select_type": "请选择分类...",
            "preview": "预览",
            "auto_fold": "过深引用自动折叠",
            "subtitle": "副标题",
            "uploaded": "发布人",
            "basic_info": "基本信息",
            "description": "描述",
            "history_select_loading": "正在努力加载中...",
            "history_select_error": "加载失败啦 (ノДＴ)",
            "anonymous": "匿名",
            "uploaded_at": "发布时间",
            "size": "大小",
            "category": "类型",
            "submitted_by": "提供者",
            "submitted_at": "提交时间",
            "history_text_loading": "~~正在检查历史数据中~~",
            "history_text_error": "加载失败啦 (ノДＴ) %%",
            "history_text_empty": "半条历史记录都没有 (ノДＴ) @@",
            "torrent_title": "种子标题",
            "torrent_info": "种子信息",
            "files": "文件数",
            "info_hash": "种子散列值",
            "show_or_hide": "显示&nbsp;/&nbsp;隐藏",
            "KiB": " KiB",
            "MiB": " MiB",
            "GiB": " GiB",
            "TiB": " TiB",
            "current_time": " 当前时间",
            "anonymous_user": " 匿名用户",
            "banned": "已屏蔽",
            "google_backup": "谷歌备份",
            "google_send": "发送请求",
            "last_edited": "最后编辑",
            "back_to_top": "返回顶部",
            "reset_token": "重置Token (・_・)ヾ",
        },
        "zh_TW": {
            "quote": "引用",
            "info": "發佈訊息",
            "mediainfo": "媒體訊息",
            "code": "代碼",
            "spoiler": "警告！下列文字很可能洩露劇情，請謹慎選擇是否觀看。",
            "spoiler_button_1": "我就是手賤",
            "spoiler_button_2": "我真是手賤",
            "main_title": "主標題",
            "rt_text": "請輸入上標",
            "main_body": "請輸入正文",
            "main_body_prefix": "請輸入標題",
            "url_name": "請輸入網址名稱",
            "url_link": "請輸入網址連結",
            "select_type": "請選擇分類...",
            "preview": "預覽",
            "auto_fold": "過深引用自動摺疊",
            "subtitle": "副標題",
            "uploaded": "發布人",
            "basic_info": "基本訊息",
            "description": "描述",
            "history_select_loading": "正在努力載入中...",
            "history_select_error": "載入失敗啦 (ノДＴ)",
            "anonymous": "匿名",
            "uploaded_at": "發布時間",
            "size": "大小",
            "category": "類型",
            "submitted_by": "提供者",
            "submitted_at": "提交時間",
            "history_text_loading": "~~正在檢查歷史數據中~~",
            "history_text_error": "載入失敗啦 (ノДＴ) %%",
            "history_text_empty": "半條歷史記錄都沒有 (ノДＴ) @@",
            "torrent_title": "種子標題",
            "torrent_info": "種子訊息",
            "files": "文件數",
            "info_hash": "種子散列值",
            "show_or_hide": "顯示&nbsp;/&nbsp;隱藏",
            "KiB": " KiB",
            "MiB": " MiB",
            "GiB": " GiB",
            "TiB": " TiB",
            "current_time": " 當前時間",
            "anonymous_user": " 匿名用戶",
            "banned": "已屏蔽",
            "google_backup": "Google備份",
            "google_send": "發送請求",
            "last_edited": "最後編輯",
            "back_to_top": "返回頂部",
            "reset_token": "重設Token (・_・)ヾ",
        },
        "zh_HK": {
            "quote": "引用",
            "info": "發佈訊息",
            "mediainfo": "媒體訊息",
            "code": "代碼",
            "spoiler": "警告！下列文字很可能洩露劇情，請謹慎選擇是否觀看。",
            "spoiler_button_1": "我就是手賤",
            "spoiler_button_2": "我真是手賤",
            "main_title": "主標題",
            "rt_text": "請輸入上標",
            "main_body": "請輸入正文",
            "main_body_prefix": "請輸入標題",
            "url_name": "請輸入網址名稱",
            "url_link": "請輸入網址鏈接",
            "select_type": "請選擇分類...",
            "preview": "預覽",
            "auto_fold": "過深引用自動摺疊",
            "subtitle": "副標題",
            "uploaded": "發布人",
            "basic_info": "基本訊息",
            "description": "描述",
            "history_select_loading": "正在努力加載中...",
            "history_select_error": "加載失敗啦 (ノДＴ)",
            "anonymous": "匿名",
            "uploaded_at": "發佈時間",
            "size": "大小",
            "category": "類型",
            "submitted_by": "提供者",
            "submitted_at": "提交時間",
            "history_text_loading": "~~正在檢查歷史數據中~~",
            "history_text_error": "加載失敗啦 (ノДＴ) %%",
            "history_text_empty": "半條歷史記錄都沒有 (ノДＴ) @@",
            "torrent_title": "種子標題",
            "torrent_info": "種子訊息",
            "files": "文件數",
            "info_hash": "種子散列值",
            "show_or_hide": "顯示&nbsp;/&nbsp;隱藏",
            "KiB": " KiB",
            "MiB": " MiB",
            "GiB": " GiB",
            "TiB": " TiB",
            "current_time": " 當前時間",
            "anonymous_user": " 匿名用戶",
            "banned": "已屏蔽",
            "google_backup": "Google備份",
            "google_send": "發送請求",
            "last_edited": "最後編輯",
            "back_to_top": "返回頂部",
            "reset_token": "重置Token (・_・)ヾ",
        },
        "en_US": {
            "quote": "Quote",
            "info": "Infobox",
            "mediainfo": "Media Info",
            "code": "CODE",
            "spoiler": "Warning! This section contains spoiler!",
            "spoiler_button_1": "I agree to view this.",
            "spoiler_button_2": "Hide this.",
            "main_title": "Main Title",
            "rt_text": "Please enter superscript",
            "main_body": "Please enter the text",
            "main_body_prefix": "Please enter a title",
            "url_name": "Please enter the URL name",
            "url_link": "Please enter the URL link",
            "select_type": "Please select a type.",
            "preview": "Preview",
            "auto_fold": "Over quote auto fold",
            "subtitle": "Small Description",
            "uploaded": "Uploader",
            "basic_info": "Basic Info",
            "description": "Description",
            "history_select_loading": "Trying to load now ...",
            "history_select_error": "Load failure (ノДＴ)",
            "anonymous": "Anonymous",
            "uploaded_at": "Uploaded at",
            "size": "Size",
            "category": "Category",
            "submitted_by": "Submitted by",
            "submitted_at": "Submitted at",
            "history_text_loading": "~~Checking historical data now~~",
            "history_text_error": "Load failure (ノДＴ) %%",
            "history_text_empty": "Half of the history is missing (ノДＴ) @@",
            "torrent_title": "Torrent Title",
            "torrent_info": "Torrent Info",
            "files": "Files",
            "info_hash": "Info hash",
            "show_or_hide": "Show&nbsp;or&nbsp;Hide",
            "KiB": " KiB",
            "MiB": " MiB",
            "GiB": " GiB",
            "TiB": " TiB",
            "current_time": " CurrentTime",
            "anonymous_user": " AnonymousUser",
            "banned": "Banned",
            "google_backup": "Google Backup",
            "google_send": "Send request",
            "last_edited": "Last edited by",
            "back_to_top": "Back to top",
            "reset_token": "Reset Token (・_・)ヾ",
        },
        "ru_RU": {
            "quote": "Цитата",
            "info": "Отправленные",
            "mediainfo": "Данные о Медиа",
            "code": "CODE",
            "spoiler": "Предупреждение! Данный раздел содержит СПОЙЛЕРЫ!",
            "spoiler_button_1": "I agree to view this.",
            "spoiler_button_2": "Hide this.",
            "main_title": "Основное название",
            "rt_text": "Пожалуйста, введите надстрочный индекс",
            "main_body": "Пожалуйста, введите текст",
            "main_body_prefix": "Пожалуйста, введите название",
            "url_name": "Пожалуйста, введите имя URL",
            "url_link": "Пожалуйста, введите URL-ссылку",
            "select_type": "выберите тип ...",
            "preview": "Предварительный просмотр",
            "auto_fold": "Автоматическое складывание для более глубоких ссылок",
            "subtitle": "Краткое Описание",
            "uploaded": "Загрузил",
            "basic_info": "Базовая инф.",
            "description": "Описание",
            "history_select_loading": "Пытаюсь загрузить сейчас ...",
            "history_select_error": "Отказ нагрузки (ノДＴ)",
            "anonymous": "Анонимно",
            "uploaded_at": "Загружен",
            "size": "Размер",
            "category": "Категория",
            "submitted_by": "Разместивший Запрос",
            "submitted_at": "Дата размещения",
            "history_text_loading": "~~Проверка исторических данных сейчас~~",
            "history_text_error": "Отказ нагрузки (ノДＴ) %%",
            "history_text_empty": "Половина истории отсутствует (ノДＴ) @@",
            "torrent_title": "Имя торрента",
            "torrent_info": "Информация о торренте	",
            "files": "Файлов в торренте",
            "info_hash": "Информация о ХЕШЕ",
            "show_or_hide": "Показать&nbsp;/&nbsp;Скрыть",
            "KiB": " KiБ",
            "MiB": " MiБ",
            "GiB": " GiБ",
            "TiB": " TiБ",
            "current_time": " Текущее время",
            "anonymous_user": " Анонимный пользователь",
            "banned": "Забанен",
            "google_backup": "Резервное копирование Google",
            "google_send": "послать запрос",
            "last_edited": "Последний раз редактировалось",
            "back_to_top": "На главную",
            "reset_token": "Токен сброса (・_・)ヾ",
        }
    };
    return lang_json[lang];
};

// 当前时间 字符串格式
function getDateString() {
    function zero(obj) { return obj < 10 ? '0' + obj : obj };
    const time = new Date();
    return time.getFullYear().toString() + '-' + zero(time.getMonth() + 1).toString() + '-' + zero(time.getDate()).toString()
        + ' ' + zero(time.getHours()) + ':' + zero(time.getMinutes()) + ':' + zero(time.getSeconds())
};

function convert(s) {
    if (s / 1024 < 1024) return (s / 1024).toFixed(3) + lang['KiB']
    if (s / 1024 / 1024 < 1024) return (s / 1024 / 1024).toFixed(3) + lang['MiB']
    if (s / 1024 / 1024 / 1024 < 1024) return (s / 1024 / 1024 / 1024).toFixed(3) + lang['GiB']
    if (s / 1024 / 1024 / 1024 / 1024 < 1024) return (s / 1024 / 1024 / 1024 / 1024).toFixed(3) + lang['TiB']
};

// 生成种子评论cid定位url
const cidUrl = (t, c) => {
    if (/\/offers\.php/i.test(location.href)) {
        return `offers.php?id=${t}&off_details=1#cid${c}`
    } else if (/\/details\.php/i.test(location.href))
        return `details.php?id=${t}#cid${c}`
    else {
        return '/'
    };
};

// 对JSON进行排序
// https://github.com/substack/json-stable-stringify
const stringify = function (obj, opts) {
    if (!opts) opts = {};
    if (typeof opts === 'function') opts = { cmp: opts };
    var space = opts.space || '';
    if (typeof space === 'number') space = Array(space + 1).join(' ');
    var cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;
    var replacer = opts.replacer || function (key, value) { return value; };

    var cmp = opts.cmp && (function (f) {
        return function (node) {
            return function (a, b) {
                var aobj = { key: a, value: node[a] };
                var bobj = { key: b, value: node[b] };
                return f(aobj, bobj);
            };
        };
    })(opts.cmp);

    var seen = [];
    return (function stringify(parent, key, node, level) {
        var indent = space ? ('\n' + new Array(level + 1).join(space)) : '';
        var colonSeparator = space ? ': ' : ':';

        if (node && node.toJSON && typeof node.toJSON === 'function') {
            node = node.toJSON();
        }

        node = replacer.call(parent, key, node);

        if (node === undefined) {
            return;
        }
        if (typeof node !== 'object' || node === null) {
            return JSON.stringify(node);
        }
        if (isArray(node)) {
            var out = [];
            for (var i = 0; i < node.length; i++) {
                var item = stringify(node, i, node[i], level + 1) || JSON.stringify(null);
                out.push(indent + space + item);
            }
            return '[' + out.join(',') + indent + ']';
        }
        else {
            if (seen.indexOf(node) !== -1) {
                if (cycles) return JSON.stringify('__cycle__');
                throw new TypeError('Converting circular structure to JSON');
            }
            else seen.push(node);

            var keys = objectKeys(node).sort(cmp && cmp(node));
            var out = [];
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = stringify(node, key, node[key], level + 1);

                if (!value) continue;

                var keyValue = JSON.stringify(key)
                    + colonSeparator
                    + value;
                ;
                out.push(indent + space + keyValue);
            }
            seen.splice(seen.indexOf(node), 1);
            return '{' + out.join(',') + indent + '}';
        }
    })({ '': obj }, '', obj, 0);
};

const isArray = Array.isArray || function (x) {
    return {}.toString.call(x) === '[object Array]';
};

const objectKeys = Object.keys || function (obj) {
    var has = Object.prototype.hasOwnProperty || function () { return true };
    var keys = [];
    for (var key in obj) {
        if (has.call(obj, key)) keys.push(key);
    }
    return keys;
};
