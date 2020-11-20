// ==UserScript==
// @name         U2种子备份查询
// @namespace    https://u2.dmhy.org/
// @version      1.5
// @description  在页面下载旁加入图标，支持一键发送请求。
// @author       McHobby & kysdm
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @match        *://u2.dmhy.org/torrents.php*
// @match        *://u2.dmhy.org/sendmessage.php*
// @match        *://u2.dmhy.org/details.php*
// @require      https://cdn.bootcss.com/jquery-cookie/1.4.1/jquery.cookie.min.js
// @connect      cdn.jsdelivr.net
// ==/UserScript==

(async ($) => {
    'use strict';

    const gdListUrl = 'https://cdn.jsdelivr.net/gh/kysdm/u2_share@main/u2list.txt';
    const date = new Date().getDate();
    let gdListObj = GM_getValue('u2_gd_list', null);
    if (gdListObj === null || gdListObj.date !== date) {
        await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: gdListUrl,
                onload: r => r.status < 400 ? resolve(r.responseText) : reject(r.status),
                onerror: r => reject(r.status)
            })
        })
            .then(g => {
                gdListObj = { date: date, list: g.trim().split('\n') };
                GM_setValue('u2_gd_list', gdListObj);
            })
            .catch(e => {
                console.log('下载列表发生错误，HTTP状态码[' + e + ']。');
            })
    }

    const gdList = gdListObj.list;
    const Uploaders = 7;
    const userid = 45940; // 勿动
    var GstaticIco;
    const CurrentUrl = window.location.href;

    if (CurrentUrl.indexOf("//u2.dmhy.org/torrents.php") != -1) {
        new torrents();
    } else if (CurrentUrl.indexOf("//u2.dmhy.org/details.php") != -1) {
        new torrents();
        new details();
    } else if (CurrentUrl.indexOf('//u2.dmhy.org/sendmessage.php?receiver=' + userid + '#') != -1) {
        new sendmessage();
    }

    function torrents() {
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
                $(GstaticIco).prepend('<img src="bitbucket/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px; filter: grayscale(100%);" alt="request" title="当前种子做种良好">');
            }
        })
    }

    function details() {
        const id = $("#outer > h3").text().split(/\(#(\d+?)\)/, 2)[1]
        const SeederNum = $("#peercount").text().split(/个(?:做种|下载)者\s?\|?\s?/, 2)[0]
        const Id_Data = gdList.findIndex((value) => value == Number(id));
        if (Id_Data != -1 && SeederNum <= Uploaders) {
            $("td.rowfollow:first").append('&nbsp;<a class="index" href="sendmessage.php?receiver=' + userid + '#' + id + '" title="查询网盘备份">[GD]</a>');
        } else if (Id_Data != -1) {
            $("td.rowfollow:first").append('&nbsp;<div class="gdindex" title="当前种子做种良好" style="display: inline-block; text-decoration: none; font-weight: bold" >[GD]</div>');
        }
    }

    function sendmessage() {
        const email = $.cookie('gd_email');
        $("td.rowfollow > input[type=text]").val("#request#");
        $(".bbcode").val('{ "id":"' + CurrentUrl.split("#")[1] + '" , "email":"' + email + '" }');
        $('td.toolbox').append('<input type="checkbox" name="save_email" checked="checked">记住邮箱地址');
        $('#compose').attr('onsubmit', 'return checkemail();')
        $('body').append(
            "<script>\n\
function checkemail(){\n\
    const re = /\\w[-\\w.+]*@([A-Za-z0-9][-A-Za-z0-9]+\\.)+[A-Za-z]{2,14}/;\n\
    let newemail = $.parseJSON($('textarea#body.bbcode').val()).email;\n\
    let email_switch = $('input[name=save_email]').prop('checked');\n\
    if ( !re.test(newemail) ) {\n\
        alert('邮箱地址错误或未定义，请重新输入。');\n\
        return false;\n\
    }\n\
    if ( email_switch ){\n\
        $.cookie('gd_email', newemail, { expires: 3650, path: '/sendmessage.php' });\n\
        return true;\n\
    }\n\
}</script>"
        )
    }
})($);
