// ==UserScript==
// @name         U2种子备份查询
// @namespace    https://u2.dmhy.org/
// @version      2.2
// @description  在页面下载旁加入图标，支持一键发送请求。
// @author       McHobby & kysdm
// @grant        none
// @match        *://u2.dmhy.org/torrents.php*
// @match        *://u2.dmhy.org/sendmessage.php?receiver=*
// @match        *://u2.dmhy.org/details.php?id=*
// @match        *://u2.dmhy.org/offers.php?id=*
// @match        *://u2.dmhy.org/userdetails.php?id=*
// @require      https://cdn.bootcss.com/jquery-cookie/1.4.1/jquery.cookie.min.js
// @require      https://unpkg.com/xhook@latest/dist/xhook.min.js
// @connect      cdn.jsdelivr.net
// ==/UserScript==

// $.cookie 方法感觉可以弃用了，直接用 localStorage 就可以
// https://greasyfork.org/zh-CN/scripts/414882-u2%E7%A7%8D%E5%AD%90%E5%A4%87%E4%BB%BD%E6%9F%A5%E8%AF%A2
(function () {
    'use strict';

    const userid = 45940; // 勿动
    const Uploaders = 7;
    let GstaticIco;
    const date = new Date().getDate();

    // Ajax-hook 有点复杂，用 xhook 简单点...
    // 好像 Ajax-hook 的处理效率更高? 也可能我的写法有问题
    // 列表如果上千了，就可以明显感觉到慢了，chrome任务管理器里直接99占用，wwwwwww
    // 如果其他脚本也劫持了 ajax 请求，那可能会发生冲突!!!!!!!!
    xhook.after(function (request, response) {
        if (request.url.match(/getusertorrentlistajax\.php\?userid=\d+?&type=leeching/i)) {
            response.text = userdetails(response.text);
        }
    });

    let gdListObj = JSON.parse(localStorage.getItem("u2_gd_list"))
    if (gdListObj === null || gdListObj.date !== date) {
        let gdListValue = getList()
        gdListValue.then(g => {
            gdListObj = { date: date, list: g.trim().split('\n') };
            console.log(gdListObj)
            localStorage.setItem("u2_gd_list", JSON.stringify(gdListObj)); // https://www.runoob.com/jsref/obj-storage.html
        })
        gdListValue.catch(e => {
            console.log('下载列表发生错误，HTTP状态码[' + e + ']。');
        })
    }
    const gdList = gdListObj.list;
    const lang = $('#locale_selection').val() // 获取当前网页使用的语言
    let txt1 = {
        'zh_CN': '发送请求',
        'zh_TW': '發送請求',
        'zh_HK': '發送請求',
        'en_US': 'Send request',
        'ru_RU': 'послать запрос' // 谷歌翻译
    }
    let txt2 = {
        'zh_CN': '做种良好',
        'zh_TW': '做種良好',
        'zh_HK': '做種良好',
        'en_US': 'Good seeding',
        'ru_RU': 'хороший посев' // 谷歌翻译
    }
    let txt3 = {
        'zh_CN': '记住邮箱地址',
        'zh_TW': '記住信箱地址',
        'zh_HK': '記住郵箱地址',
        'en_US': 'Remember email address',
        'ru_RU': 'Запомнить адрес электронной почты' // 谷歌翻译
    }
    let txt4 = {
        'zh_CN': '邮箱地址错误或未定义，请重新输入。',
        'zh_TW': '信箱地址錯誤或未定義，請重新輸入。',
        'zh_HK': '郵箱地址錯誤或未定義，請重新輸入。',
        'en_US': 'Email address is wrong or undefined, please re-enter.',
        'ru_RU': 'Адрес электронной почты неверен или не указан, введите его еще раз.' // 谷歌翻译
    }
    let txt5 = {
        'zh_CN': '下载种子',
        'zh_TW': '下載種子',
        'zh_HK': '下載種子',
        'en_US': 'Download Torrent',
        'ru_RU': 'Скачать Торрент'
    }
    if (location.href.match(/u2\.dmhy\.org\/torrents\.php/i)) {
        new torrents();
    } else if (location.href.match(/u2\.dmhy\.org\/(?:details|offers)\.php/i)) {
        new torrents();
        new details();
    } else if (location.href.match(/u2\.dmhy\.org\/sendmessage\.php\?receiver=45940#\d+$/i)) { // 45940好像没法设置为变量
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
                $(GstaticIco).prepend('<a href="sendmessage.php?receiver=' + userid + '#' + id + '" target="_blank"><img src="//cdn.jsdelivr.net/gh/kysdm/u2_share@main/img/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px;" alt="request" title="' + txt1[lang] + '"></a>');
            } else if (Id_Data != -1) {
                GstaticIco = $(this).find('td.embedded')[1];
                $(GstaticIco).width(55);
                $(GstaticIco).prepend('<img src="//cdn.jsdelivr.net/gh/kysdm/u2_share@main/img/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px; filter: grayscale(100%);" alt="request" title="' + txt2[lang] + '">');
            }
        })
    }

    function details() {
        const id = $("#outer > h3").text().split(/\(#(\d+?)\)/, 2)[1]
        const SeederNum = $("#peercount").text().match(/^(\d+?)\s?(?:个做种者|個做種者|Seeders|Раздающих)/i)[1]
        const Id_Data = gdList.findIndex((value) => value == Number(id));
        if (Id_Data != -1 && SeederNum <= Uploaders) {
            $("td.rowfollow:first").append('&nbsp;<a class="index" href="sendmessage.php?receiver=' + userid + '#' + id + '" title="' + txt1[lang] + '">[GD]</a>');
        } else if (Id_Data != -1) {
            $("td.rowfollow:first").append('&nbsp;<div class="gdindex" title="' + txt2[lang] + '" style="display: inline-block; text-decoration: none; font-weight: bold" >[GD]</div>');
        }
    }

    function sendmessage() {
        const email = $.cookie('gd_email');
        $("td.rowfollow > input[type=text]").val("#request#");
        $(".bbcode").val('{ "id":"' + location.href.split("#")[1] + '" , "email":"' + email + '" }');
        $('td.toolbox').append('<input type="checkbox" name="save_email" checked="checked">' + txt3[lang] + '');
        $('#compose').attr('onsubmit', 'return checkemail();')
        $('body').append(
            '<script>\n\
function checkemail(){\n\
    const re = /\\w[-\\w.+]*@([A-Za-z0-9][-A-Za-z0-9]+\\.)+[A-Za-z]{2,14}/;\n\
    let newemail = $.parseJSON($("textarea#body.bbcode").val()).email;\n\
    let email_switch = $("input[name=save_email]").prop("checked");\n\
    if ( !re.test(newemail) ) {\n\
        alert("' + txt4[lang] + '");\n\
        return false;\n\
    }\n\
    if ( email_switch ){\n\
        $.cookie("gd_email", newemail, { expires: 3650, path: "/sendmessage.php" });\n\
        return true;\n\
    }\n\
}</script>'
        )
    }

    function userdetails(msg) {
        // https://developer.mozilla.org/zh-CN/docs/Web/API/DOMParser
        let parser = new DOMParser();
        let resXML = parser.parseFromString(msg, 'text/html');
        const kaTable = resXML.querySelectorAll("body > table > tbody > tr:not(:first-child)")
        for (var i = 0; i < kaTable.length; i++) {
            let ka = kaTable[i].querySelector("td.rowfollow:nth-child(2) > table > tbody > tr:nth-child(1)")
            let id = ka.querySelector("td > a").href.match(/id=(\d+)/i)[1]
            let Id_Data = gdList.findIndex((value) => value == Number(id));
            let SeederNum = kaTable[i].querySelector("td:nth-child(4) > b > a").innerHTML;
            if (Id_Data != -1 && SeederNum <= Uploaders) {
                $(ka).append(
                    '<td width="40" class="embedded" style="text-align: right; width: 55px;" valign="middle">\
        <a href="sendmessage.php?receiver=' + userid + '#' + id + '" target="_blank"><img src="//cdn.jsdelivr.net/gh/kysdm/u2_share@main/img/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px;" alt="request" title="' + txt1[lang] + '"></a>\
        <a href="download.php?id=' + id + '"><img class="download" src="pic/trans.gif" style="padding-bottom: 2px;" alt="download" title="' + txt5[lang] + '">\
        </a></td>'
                )
            } else if (Id_Data != -1) {
                $(ka).append(
                    '<td width="40" class="embedded" style="text-align: right; width: 55px;" valign="middle">\
                    <img src="//cdn.jsdelivr.net/gh/kysdm/u2_share@main/img/drive_2020q4_48dp.png" style="padding-bottom: 2px; width:16px;height:16px; filter: grayscale(100%);" alt="request" title="' + txt2[lang] + '">\
        <a href="download.php?id=' + id + '"><img class="download" src="pic/trans.gif" style="padding-bottom: 2px;" alt="download" title="' + txt5[lang] + '">\
        </a></td>'
                )
            }
            else {
                $(ka).append(
                    '<td width="40" class="embedded" style="text-align: right; width: 55px;" valign="middle">\
        <a href="download.php?id=' + id + '"><img class="download" src="pic/trans.gif" style="padding-bottom: 2px;" alt="download" title="' + txt5[lang] + '">\
        </a></td>'
                )
            }
        }
        return resXML.body.innerHTML
    }
})();

function getList() {
    return new Promise((resolve, reject) => {
        // https://www.w3school.com.cn/jquery/ajax_ajax.asp
        $.ajax({
            type: 'get',
            url: 'https://cdn.jsdelivr.net/gh/kysdm/u2_share@main/u2list.txt',
            contentType: 'text/plain',
            dataType: 'text',
            success: function (data, textStatus) {
                resolve(data)
                // console.log(data) // 返回字符串
                // console.log(textStatus) // success
            },
            error: function (XMLHttpRequest, textStatus) {
                reject(XMLHttpRequest.status)
                // console.log(XMLHttpRequest) // xml对象
                // console.log(textStatus) // error
            }
        })
    })
}