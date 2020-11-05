// ==UserScript==
// @name         U2种子备份查询
// @namespace    https://u2.dmhy.org/
// @version      0.7
// @description  在页面下载旁加入图标，支持一键发送请求。
// @author       McHobby & kysdm
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @match        *://u2.dmhy.org/torrents.php*
// @match        *://u2.dmhy.org/sendmessage.php?receiver=*
// @match        *://u2.dmhy.org/details.php*
// @connect      raw.githubusercontent.com
// ==/UserScript==

// debugger;(async ($) => {
(async($) => {
    'use strict'

    var email = '' // 此处可写入谷歌邮箱，这样发送请求的时候就不用手动填写了
    // 需要注意的是，修改后脚本自动更新会被自动关闭

    if (window.location.href.indexOf("//u2.dmhy.org/torrents.php") != -1 | window.location.href.indexOf("//u2.dmhy.org/details.php") != -1) {
        const gdListUrl = 'https://raw.githubusercontent.com/kysdm/u2_share_js/main/u2list.txt'; // 为什么就不能让我套 jsdelivr 呢.
        const date = new Date().getDate();
        let gdListObj = GM_getValue('u2_gd_list', null);
        if (gdListObj === null || gdListObj.date !== date) {
            const gdListRaw = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: gdListUrl,
                    onload: r => resolve(r.responseText),
                    onerror: r => reject(r)
                })
            })
            gdListObj = {
                date: date,
                list: gdListRaw.trim().split('\n')
            }
            GM_setValue('u2_gd_list', gdListObj)
        }

        const gdList = gdListObj.list;
        const Uploaders = 3;
        var userid = 45940 // 勿动
        var GstaticIco;

        if (window.location.href.indexOf("//u2.dmhy.org/torrents.php") != -1) {
            const torrentTable = $('table.torrents')
            torrentTable.find('> tbody > tr:not(:first-child)').each(function () {
                const tds = $(this).find('> td');
                const SeederNum = parseInt($(tds[tds.length - 3]).text());
                const idLink = $(this).find("[href*='id=']")[0].getAttribute('href');
                const id = parseInt(idLink.substr(idLink.indexOf('id=') + 3));
                const Id_Data = gdList.findIndex((value) => value == id);
                if (Id_Data != -1 && SeederNum <= Uploaders) {
                    GstaticIco = $(this).find('td.embedded')[1];
                    $(GstaticIco).width(55);
                    $(GstaticIco).prepend('<a href="sendmessage.php?receiver=' + userid + '#' + id + '" target="_blank"><img src="bitbucket/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px;" alt="request" title="发送请求"></a>');
                } else if (Id_Data != -1) {
                    GstaticIco = $(this).find('td.embedded')[1];
                    $(GstaticIco).width(55);
                    $(GstaticIco).prepend('<img src="bitbucket/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px; filter: grayscale(100%);" alt="request">');
                }
            })
        } else if (window.location.href.indexOf("//u2.dmhy.org/details.php") != -1) {
            const id = $("#outer > h3").text().split(/\(#(\d+?)\)/, 2)[1]
            const SeederNum = $("#peercount").text().split(/个(?:做种|下载)者\s?\|?\s?/, 2)[0]
                //const SeederNum = Peer[0]
            const Id_Data = gdList.findIndex((value) => value == Number(id));
            if (Id_Data != -1 && SeederNum <= Uploaders) {
                $("td.rowfollow:first").append('&nbsp;<a class="index" href="sendmessage.php?receiver=' + userid + '#' + id + '" title="查询网盘备份">[GD]</a>');
            } else if (Id_Data != -1) {
                $("td.rowfollow:first").append('&nbsp;<div class="gdindex" title="当前种子做种良好" style="display: inline-block; text-decoration: none; font-weight: bold" >[GD]</div>');
            }
        }
    }
    if (window.location.href.indexOf("//u2.dmhy.org/sendmessage.php") != -1) {
        $("td.rowfollow > input[type=text]").val("#request#");
        if (email === '') { email = '请输入您的谷歌邮箱！' }
        $(".bbcode").val('{ "id":"' + window.location.href.split("#")[1] + '" , "email":"' + email + '" }');
    }
})($);