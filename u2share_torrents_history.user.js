// ==UserScript==
// @name         U2种子历史记录
// @namespace    https://u2.dmhy.org/
// @version      0.1.2
// @description  查看种子历史记录
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/details.php?id=*
// @match        *://u2.dmhy.org/offers.php?id=*
// @exclude      *://u2.dmhy.org/details.php?id=*&cmtpage=*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdn.jsdelivr.net/npm/localforage@1.9.0/dist/localforage.min.js
// @updateURL    https://github.com/kysdm/u2_share/raw/main/u2share_torrents_history.user.js
// @installURL   https://github.com/kysdm/u2_share/raw/main/u2share_torrents_history.user.js
// @downloadURL  https://github.com/kysdm/u2_share/raw/main/u2share_torrents_history.user.js
// @license      Apache-2.0
// ==/UserScript==

/*
本脚本基于 Bamboo Green 界面风格进行修改
/*

/*
更新日志
    https://github.com/kysdm/u2_share/commits/main/u2share_torrents_history.user.js
*/

// 声明全局变量
var lang, torrent_id, db, user_id, key, token;

(async () => {
    'use strict';
    // 初始化
    lang = new lang_init($('#locale_selection').val()); // 获取当前网页语言
    torrent_id = location.href.match(/\.php\?id=(\d{3,5})/i) || ['', '']; if (torrent_id[1] !== '') torrent_id = torrent_id[1]; // 当前种子ID
    user_id = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i) || ['', '']; if (user_id[1] !== '') user_id = user_id[1]; // 当前用户ID
    db = localforage.createInstance({ name: "history" });

    key = await db.getItem('key');
    token = await db.getItem('token');
    if (key === null || key.length !== 32) { new auth_key(); return; } else if (token === null || token.length !== 96) { new auth_token(key); return; };

    // 为已经删除的种子显示历史
    if ($('#outer').find('h2').text().match(/错误|錯誤|Ошибка|error/i)) { history2(); } else { history1(); };
})();

function auth_key() {
    'use strict';
    $('#outer').html('<h1 align="center">U2种子历史记录 KEY初始化</h1><table border="0" align="center" cellspacing="0" cellpadding="5">'
        + '<tbody><tr><td valign="top" width="500" align="center"><span style="word-break: break-all; word-wrap: break-word;">'
        + '<bdo dir="ltr">点击按钮，请求key，key需写在<a href="usercp.php?action=personal" target="_blank" style="color:#FF0000"><b>个人说明</b></a>中，'
        + '填写完成请刷新界面。<br></bdo></span></td></tr>'
        + '<tr><td valign="top" align="center"><span style="word-break: break-all; word-wrap: break-word;">'
        + '<bdo id="auth_value" dir="ltr">32位长度的key会显示在这里 (不是32位就是失败)</bdo></span></td></tr><tr><td align="center">'
        + '<button id="auth_key" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" >获取KEY</button>'
        + '<button id="auth_key_d" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" >已有KEY</button>'
        + '</td></tr></tbody></table>'
    );

    $("#auth_key_d").click(function () {
        let __key = window.prompt("请输入key"); // 弹窗提示输入key
        if (__key === null || __key.length === 0) return; // 没有任何输入时 无视本次操作
        $('#auth_value').text(__key);
        db.setItem('key', __key);
    });

    $("#auth_key").click(function () {
        $.ajax({
            type: 'post',
            url: 'https://u2.kysdm.com/api/v1/token',
            contentType: "application/json",
            dataType: 'json',
            data: JSON.stringify({ "uid": user_id }),
            success: function (d) {
                if (d.msg === 'success') {
                    let __key = d.data.key
                    $('#auth_value').text(__key);
                    db.setItem('key', __key);
                } else {
                    $('#auth_value').text(d);
                };
            },
            error: function (d) {
                $('#auth_value').text(d);
            },
        });
    });
};


function auth_token(__key) {
    'use strict';
    $('#outer').html('<h1 align="center">U2种子历史记录 TOKEN初始化</h1><table border="0" align="center" cellspacing="0" cellpadding="5">'
        + '<tbody><tr><td valign="top" width="500" align="center"><span style="word-break: break-all; word-wrap: break-word;">'
        + '<bdo dir="ltr">点击按钮，请求token，token会自动记录在本地数据库中，完成后请刷新界面。<br></bdo></span></td></tr>'
        + '<tr><td  valign="top" align="center"><span style="word-break: break-all; word-wrap: break-word;">'
        + '<bdo id="auth_value" dir="ltr">96位长度的token会显示在这里 (不是96位就是失败)</bdo></span></td></tr><tr><td align="center">'
        + '<button id="auth_token" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" >获取TOKEN</button>'
        + '<button id="auth_token_d" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" >已有TOKEN</button>'
        + '</td></tr></tbody></table>'
    );

    $("#auth_token_d").click(function () {
        let __token = window.prompt("请输入token"); // 弹窗提示输入token
        if (__token === null || __token.length === 0) return; // 没有任何输入时 无视本次操作
        $('#auth_value').text(__token);
        db.setItem('token', __token);
    });

    $("#auth_token").click(async function () {
        $.ajax({
            type: 'post',
            url: 'https://u2.kysdm.com/api/v1/token',
            contentType: "application/json",
            dataType: 'json',
            data: JSON.stringify({ "uid": user_id, "key": __key }),
            success: function (d) {
                if (d.msg === 'success') {
                    let __token = d.data.token
                    $('#auth_value').text(__token);
                    db.setItem('token', __token);
                } else {
                    $('#auth_value').html('可能没有把key写入<a href="usercp.php?action=personal" target="_blank" style="color:#FF0000">个人说明</a><br>key: ' + __key + '<br>错误信息: ' + JSON.stringify(d));
                };
            },
            error: function (d) {
                $('#auth_value').text(d);
            },
        });
    });
};


async function history1() {
    'use strict';
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
        $("#history_select").append('<option value="90000">' + '重置Token (・_・)ヾ' + '</option>'); // 删除本地授权信息
        $("#history_select").change(function () { // 监听菜单选择
            let self = Number($(this).val());
            if (self === 90000) {
                let confirm = prompt("输入 YES 确认本次操作");
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

    var now_data = {
        self: 0, // 唯一标识符
        title: $('#top').text(), // 主标题
        subtitle: $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").next().html(), // 副标题
        uploaded: $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").next().html(), // 发布人
        basic_info: $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html(), // 基本信息
        description_info: $('#kdescr').html(), // 描述 <HTML>
        get_time: getDateString(), // 数据获取时间  这里是当前时间
    };

    history_data = [now_data].concat(history_data); // 将现在的页面保存，并插入到数列第一位

    $("#history_select").empty(); // 插入前先清空 option
    for (let i = 0, len = history_data.length; i < len; i++) { // 循环插入到选择列表中
        $("#history_select").append("<option value='" + history_data[i].self + "'>"
            + history_data[i].get_time.replace('T', ' ')
            + (() => { return history_data[i].self === 0 ? ' N' : history_data[i].torrent_hash === null ? ' H' : ' T' })()
            + (() => {
                if (history_data[i].self === 0) return ' 当前时间'
                else if (history_data[i].edited_name === null && history_data[i].edited_id === null) return ''
                else if (history_data[i].edited_name === 'Anonymous' && history_data[i].edited_id === null) return ' 匿名用户'
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
            if (self === 0) { // 还原现在的页面
                $('#top').text(history_data[i].title); // 主标题
                $("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").next().html(history_data[i].subtitle);  // 副标题
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").next().html(history_data[i].uploaded); // 发布人一栏
                $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html(history_data[i].basic_info); // 基本信息一栏
                $('#kdescr').html(history_data[i].description_info); // 描述
                return;
            }
            $('#top').text(history_data[i].title); // 主标题
            // 检查副标题一栏是否存在
            if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 0 && history_data[i].subtitle !== null) {
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").parent().before('<tr><td class="rowhead nowrap" valign="top" align="right">副标题</td><td class="rowfollow" valign="top" align="left"></td></tr>');
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
                $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html('<b>' + lang['uploaded_at'] + ':</b> ' + history_data[i].uploaded_at.replace('T', ' ')
                    + (() => { if (history_data[i].torrent_size) { return '&nbsp;&nbsp;&nbsp;<b>' + lang['size'] + ':</b>&nbsp;' + convert(history_data[i].torrent_size) } else { return ''; } })()
                    + '&nbsp;&nbsp;&nbsp;<b>' + lang['category'] + ':</b> ' + history_data[i].category)
            } else { // 还在候选的种子
                $("td[class='rowhead nowrap']:contains(" + lang['basic_info'] + ")").next().html('<b>' + lang['submitted_by'] + '</b>:&nbsp;'
                    + ((p) => {
                        if (p.uploader_id === null && p.uploader_name === '匿名') return '<i>' + lang['anonymous'] + '</i>'; // 匿名发布
                        if (p.uploader_id !== null && p.uploader_name !== '匿名') return '<a href="userdetails.php?id=' + p.uploader_id + '"><b>' + p.uploader_name + '</b></a>'; // 正常显示
                    })(history_data[i])
                    + '&nbsp;&nbsp;&nbsp;<b>' + lang['submitted_at'] + '</b>:&nbsp;<time>'
                    + history_data[i].uploaded_at.replace('T', ' ')
                    + '</time>&nbsp;&nbsp;&nbsp;<b>' + lang['category'] + '</b>:&nbsp;'
                    + history_data[i].category
                );
            };
        };
    });
};


async function history2() {
    'use strict';
    const errorstr = $('#outer').find('td.text').text();
    // 正在努力加载中...
    $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>' + lang['history_text_loading'] + '</i>');

    const __json = await getapi(); // 从 API 获取数据

    if (__json.msg !== 'success') { // 加载失败时
        console.log('获取历史记录失败.');
        $('#outer').find('td.text').html(errorstr + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<i>' + lang['history_text_error']
            + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' + '<a id="apifailure" href="javascript:void(0);" style="color:#FF1212">重置Token (・_・)ヾ</a>' + '</i>');
        $("#apifailure").click(function () {
            let confirm = prompt("输入 YES 确认本次操作");
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
    // 还原网页
    $('#outer').html('<h1 align="center" id="top">' + history_data[0].title + '</h1>'
        + '<div id="hsty" style="position: relative;"><div id="history" style="position: absolute; right:56px; margin-top: 4px;">'
        + '<select name="type" id="history_select" style="visibility: visible;"></select></div></div>'
        + '<h3>(#' + torrent_id + ')</h3>'
        + '<table width="90%" min-width="940px" cellspacing="0" cellpadding="5"><tbody><tr><td class="rowhead" width="13%">' + lang['torrent_title'] + '</td>'
        + '<td class="rowfollow" width="87%" align="left">'
        + '<b>[U2].' + history_data[0].torrent_name + '.torrent</b></td></tr>'
        + (() => {
            if (history_data[0].subtitle) {
                return '<tr><td class="rowhead nowrap" valign="top" align="right">'
                    + lang['subtitle'] + '</td><td class="rowfollow" valign="top" align="left">' + history_data[0].subtitle + '</td></tr></td></tr>';
            } else return '';
        })()
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
        + '</td></tr>'
        + '<tr><td class="rowhead nowrap" valign="top" align="right">'
        + '<a href="javascript: klappe_news(\'descr\')"><span class="nowrap">'
        + '<img class="minus" src="pic/trans.gif" alt="Show/Hide" id="picdescr" title="' + lang['show_or_hide'] + '"> ' + lang['description'] + '</span></a></td>'
        + '<td class="rowfollow" valign="top" align="left">'
        + '<div id="kdescr"><span style="word-break: break-all; word-wrap: break-word;"><bdo dir="ltr">'
        + bbcode2html(history_data[0].description_info) + '</bdo></span></div></td></tr><tr>'
        + '<td class="rowhead nowrap" valign="top" align="right">' + lang['torrent_info'] + '</td>'
        + '<td class="rowfollow" valign="top" align="left"><table><tbody><tr>'
        + '<td class="no_border_wide"><b>' + lang['files'] + '</b>: ' + history_data[0].torrent_files_qty
        + '<br></td><td class="no_border_wide"><b>' + lang['info_hash'] + ':</b>&nbsp;' + history_data[0].torrent_hash
        + '</td></tr></tbody></table></td></tr></tbody></table><br><br></br>'
    );

    for (let i = 0, len = history_data.length; i < len; i++) { // 循环插入到选择列表中
        $("#history_select").append("<option value='" + history_data[i].self + "'>"
            + history_data[i].get_time.replace('T', ' ')
            + (() => { return history_data[i].self === 0 ? ' N' : history_data[i].torrent_hash === null ? ' H' : ' T' })()
            + (() => {
                if (history_data[i].self === 0) return ' 当前时间'
                else if (history_data[i].edited_name === null && history_data[i].edited_id === null) return ''
                else if (history_data[i].edited_name === 'Anonymous' && history_data[i].edited_id === null) return ' 匿名用户'
                else if (history_data[i].edited_name !== null && history_data[i].edited_id !== null) return ' ' + history_data[i].edited_name + '(' + history_data[i].edited_id + ')'
                else return ' @BUG@'
            })()
            + "</option>");
    };

    $("#history_select").change(function () { // 监听菜单选择
        let self = Number($(this).val());
        for (let i = 0, len = history_data.length; i < len; i++) {
            if (self !== history_data[i].self) continue;
            $('#top').text(history_data[i].title); // 主标题
            // 检查副标题一栏是否存在
            if ($("td[class='rowhead nowrap']:contains(" + lang['subtitle'] + ")").length === 0 && history_data[i].subtitle !== null) {
                $("td[class='rowhead nowrap']:contains(" + lang['uploaded'] + ")").parent().before('<tr><td class="rowhead nowrap" valign="top" align="right">副标题</td><td class="rowfollow" valign="top" align="left"></td></tr>');
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
        };
    });
};


function bbcode2html(bbcodestr) {
    'use strict';
    const f_reg = new RegExp("^\"?\"?$");

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

    bbcodestr = bbcodestr.replace(/\r\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\r/g, () => { return '<br>' });

    // code 标签
    const code_reg = new RegExp("\\[code\\](.+?)\\[\\/code\\]", "gis");
    bbcodestr = bbcodestr.replace(code_reg, function (s, x) {
        return addTempCode('<br /><div class="codetop">' + lang['code'] + '</div><div class="codemain">' + x + '</div><br />');
    });

    // info 标签
    const info_reg = new RegExp("\\[(mediainfo|info)\\](.+?)\\[\\/(\\1)\\]", "gis");
    bbcodestr = bbcodestr.replace(info_reg, function (s, x, y) {
        switch (x) {
            case 'info':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: blue">'
                    + lang['info'] + '</span></b></legend>' + y + '</fieldset>');
            case 'mediainfo':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: red">'
                    + lang['mediainfo'] + '</span></b></legend>' + y + '</fieldset>');
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
        if (/^https?:\/\/((?!&lt;|&gt;|"|>|'|<|;|\(|\)|\[|\]).)+$/i.test(y)) {
            switch (x) {
                case 'img':
                    return addTempCode('<img alt="image" src="' + y + '" style="height: auto; width: auto; max-width: 100%;">');
                case 'imglnk':
                    return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + y + '"><img alt="image" src="'
                        + y + '" style="height: auto; width: auto; max-width: 100%;"></a>');
            }
        } else {
            return addTempCode(s);
        }
    });

    bbcodestr = bbcodestr.replace(/\[img=([^\]]+)\]/gi, function (s, x) {
        if (/^https?:\/\/((?!&lt;|&gt;|"|>|'|<|;|\(|\)|\[|\]).)+$/i.test(x)) {
            return addTempCode('<img alt="image" src="' + x + '" style="height: auto; width: auto; max-width: 100%;">');
        } else {
            return addTempCode(s);
        }
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
    const spoiler_reg2 = new RegExp("\\[spoiler=([^\\]]+)\\\](.*?)\\[/spoiler\\]", "gsi");
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
    'use strict';
    return new Promise((resolve, reject) => {
        // https://www.w3school.com.cn/jquery/ajax_ajax.asp
        $.ajax({
            type: 'get',
            url: 'https://u2.kysdm.com/api/v1/history/?token=' + token + '&maximum=50&uid=' + user_id + '&torrent=' + torrent_id,
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
    'use strict';
    var lang_json = {
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
