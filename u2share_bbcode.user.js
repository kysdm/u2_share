// ==UserScript==
// @name         U2实时预览BBCODE
// @namespace    https://u2.dmhy.org/
// @version      0.3.5
// @description  实时预览BBCODE
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/*
// @exclude      *://u2.dmhy.org/attachment.php*
// @exclude      *://u2.dmhy.org/shoutbox.php*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @license      Apache-2.0
// ==/UserScript==

/*
本脚本基于 Bamboo Green 界面风格进行修改

先 能 跑 再 优 化
看 的 真 犯 恶 心
/*

/*
GreasyFork 地址
    https://greasyfork.org/zh-CN/scripts/426268-u2%E5%AE%9E%E6%97%B6%E9%A2%84%E8%A7%88bbcode
*/

/*
更新日志
    https://github.com/kysdm/u2_share/commits/main/u2share_bbcode.user.js
*/

/*
无法显示的 Tag
    由U2自带上传工具上传的文件
    Flash 有关的 Tag <u2好像本来就不支持>
    从弹窗添加表情 [https://u2.dmhy.org/moresmilies.php?form=upload&text=descr] <不知道能不能修>
    我不知道的特殊操作
*/

/*
待实现的功能
    使用原生JS实现 <本来是原生JS的，写着写着觉得好繁琐，就上jq了。>
*/

/*
与U2娘显示不同的标签 (非标准操作)
    
*/

'use strict';

// 声明全局变量
var lang = new lang_init($('#locale_selection').val());;

// 现存BBCODE元素
(async () => {
    if ($('.bbcode').length === 0) return;  // 判断页面是否存在 bbcode 输入框
    new init();
    const url = location.href.match(/u2\.dmhy\.org\/(upload|forums|comment|contactstaff|sendmessage)\.php/i) || ['', ''];
    sync_scroll(); // 同步窗口滚动
    if (url[1] === 'upload') { new auto_save_upload(); } else { new auto_save_message(url[1]); }

    $('.bbcode').parents("tr:eq(1)").after('<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">' + lang['preview']
        + '</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2">'
        + '<div id="bbcode2" style="min-height: 25px; max-height: ' + ($('.bbcode').height() + 30) + 'px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;">'
        + '<div class="child">' + bbcode2html($('.bbcode').val()) + '</div></div></td></tr></tbody></table></td>');

    // https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver
    let MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    let element = document.querySelector('.bbcode');
    var height_now, height_last;
    var observer = new MutationObserver((mutations) => {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                height_now = Number(mutation.target.style.height.replace('px', '')) + 30;
                if (height_last === height_now) { return } else { height_last = height_now; };
                $("#bbcode2").css("max-height", height_now + "px");
            }
        })
    });
    observer.observe(element, {
        attributes: true,
        attributeFilter: ['style']
    });

    $('.bbcode').bind('input propertychange', async function updateValue() {
        let html = bbcode2html($(this).val());
        $('#bbcode2').children('.child').html(html);
    });

    $('.codebuttons').click(async function updateValue() {
        let html = bbcode2html($('.bbcode').val());
        $('#bbcode2').children('.child').html(html);
    });

    $("td.embedded.smile-icon a").click(async function updateValue() {
        await sleep(0);
        let html = bbcode2html($('.bbcode').val());
        $('#bbcode2').children('.child').html(html);
    });

    if (/u2\.dmhy\.org\/upload\.php/i.test(location.href)) {

        // 添加中括号
        function add_brackets(txt) { if (txt === '') { return ''; } else { return '[' + txt + ']'; } };

        // 检查重叠的中括号
        function check_title(txt) {
            if (/\[{2,}|\]{2,}/g.test(txt)) { return '<font color="red">' + txt + '</font>'; } else { return txt; }
        };

        var main_title = '<font color="red"><b>' + lang['select_type'] + '</b></font>';

        function add_main_title() {
            var type_id = $('#browsecat').val();
            if (type_id === '0') {
                // console.log('请选择分类...');
                main_title = '<font color="red"><b>' + lang['select_type'] + '</b></font>';
            } else if (['9', '411', '413', '12', '13', '14', '15', '16', '17', '410', '412'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' anime');
                main_title = '<b>'
                    + add_brackets($('#anime_chinese-input').val())
                    + add_brackets($('#anime_english-input').val())
                    + add_brackets($('#anime_original-input').val())
                    + add_brackets($('#anime_source-input').val())
                    + add_brackets($('#anime_resolution-input').val())
                    + add_brackets($('#anime_episode-input').val())
                    + add_brackets($('#anime_container-input').val())
                    + add_brackets($('#anime_extra-input').val())
                    + '</b>';
            } else if (['21', '22', '23'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' manga');
                main_title = '<b>'
                    + add_brackets($('#manga_title-input').val())
                    + add_brackets($('#manga_author-input').val())
                    + add_brackets($('#manga_volume-input').val())
                    + add_brackets($('#manga_ended').find("select").val())
                    + add_brackets($('#manga_publisher-input').val())
                    + add_brackets($('#manga_remark-input').val())
                    + '</b>';
            } else if (type_id === '30') {
                // console.log('分类ID是： ' + type_id + ' music');
                var prefix_1 = $('#music_prefix').find("select").val();
                var prefix_2 = $('#music_collection').find("select").val();
                if (['EAC', 'XLD'].indexOf(prefix_1) !== -1) { var music_quality = false; }
                else if (['Hi-Res', 'Web'].indexOf(prefix_1) !== -1) { var music_quality = true; };
                switch (prefix_2) {
                    case "0": // 单张
                        main_title = '<b>'
                            + add_brackets(prefix_1)
                            + add_brackets($('#music_date-input').val())
                            + add_brackets($('#music_category-input').val())
                            + add_brackets($('#music_artist-input').val())
                            + add_brackets($('#music_title-input').val())
                            + add_brackets($('#music_serial_number-input').val())
                            + add_brackets((() => { if (music_quality) { return $('#music_quality-input').val(); } else { return ''; } })())
                            + add_brackets($('#music_format-input').val())
                            + '</b>';
                        break;
                    case "1": // 合集
                        main_title = '<b>'
                            + add_brackets(prefix_1)
                            + add_brackets('合集')
                            + add_brackets($('#music_category-input').val())
                            + add_brackets($('#music_title-input').val())
                            + add_brackets($('#music_quantity-input').val())
                            + add_brackets((() => { if (music_quality) { return $('#music_quality-input').val(); } else { return ''; } })())
                            + '</b>';
                        break;
                }
            } else if (type_id === '40') {
                // console.log('分类ID是： ' + type_id + ' other');
                main_title = '<b>' + $('#other_title-input').val() + '</b>';
            } else {
                // console.log('分类ID是： ' + type_id);
            }
            $('#checktitle').html(check_title(main_title));
        }

        $("#browsecat").change(() => { new add_main_title; })
        $(".torrent-info-input").bind('input propertychange', () => { new add_main_title; });
        $('#other_title').after('<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['main_title'] + '</td>'
            + '<td id="checktitle" class="rowfollow" valign="top" align="left" valign="middle">' + main_title + '</td></tr>'
        );
    };


    function init() {
        var h1 = $('.codebuttons').eq(6).parent().html();
        var h2 = $('.codebuttons').eq(7).parent().html();
        var h3 = $('.codebuttons').eq(8).parent().html();
        $('.codebuttons').eq(8).parent().remove();
        $('.codebuttons').eq(7).parent().remove();
        $('.codebuttons').eq(6).parent().remove();

        $('.codebuttons').eq(2).parent().after('<td class="embedded"><input class="codebuttons" style="text-decoration: line-through;'
            + 'font-size:11px;margin-right:3px" type="button" value="S" onclick="onEditorActionS(\'descr\', \'EDITOR_S\')">');

        $('.codebuttons').eq(5).parent()
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="CODE" onclick="onEditorActionS(\'descr\', \'EDITOR_CODE\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="PRE" onclick="onEditorActionS(\'descr\', \'EDITOR_PRE\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="LIST" onclick="onEditorActionS(\'descr\', \'EDITOR_LIST\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="RT*" onclick="onEditorActionS(\'descr\', \'EDITOR_RT\')">');

        // $('.codebuttons').eq(10).attr("onclick", "onEditorActionS('descr','EDITOR_QUOTE')");

        $('.codebuttons').eq(10).parent()
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="SPOILER*" onclick="onEditorActionS(\'descr\', \'EDITOR_SPOILER+\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="SPOILER" onclick="onEditorActionS(\'descr\', \'EDITOR_SPOILER\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="MEDIAINFO" onclick="onEditorActionS(\'descr\', \'EDITOR_MEDIAINFO\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="INFO" onclick="onEditorActionS(\'descr\', \'EDITOR_INFO\')">')
            .after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="QUOTE*" onclick="onEditorActionS(\'descr\', \'EDITOR_QUOTE+\')">');

        $('.codebuttons').eq(4)
            .attr("onclick", "onEditorActionS('descr','EDITOR_URL')")
            .parent().after('<td class="embedded"><input class="codebuttons" style="'
                + 'font-size:11px;margin-right:3px" type="button" value="URL*" onclick="onEditorActionS(\'descr\', \'EDITOR_URL+\')">'
            );

        $('.codebuttons').parents('table').eq(0).after('<div id="bbcodejs_tbody" style="position:relative; margin-top: 4px"></div>');

        $('#bbcodejs_tbody').append('<div id="bbcodejs_select" style="position: absolute; margin-top:2px; margin-bottom:2px; float: left;">' + h1 + h2 + h3 + '</div>');

        const margin = $('.codebuttons').parents('tbody').eq(0).width() - $("#bbcodejs_select").width() - 2.6;
        $("#bbcodejs_select").css("margin-left", margin + "px");

        $('body').append(
            '<script type="text/javascript">\n\
    function onEditorActionS(textAreaId, action, param) {\n\
        var textArea = document.querySelector(".bbcode");\n\
        var selStart = textArea.selectionStart;\n\
        var selEnd = textArea.selectionEnd;\n\
        var selectionText, url;\n\
        if (selStart === null || selEnd === null) {\n\
            selStart = selEnd = textArea.value.length;\n\
        }\n\
        switch (action) {\n\
            case "EDITOR_S": {\n\
                addTag(textArea, "s", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_INFO": {\n\
                addTag(textArea, "info", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_MEDIAINFO": {\n\
                addTag(textArea, "mediainfo", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_PRE": {\n\
                addTag(textArea, "pre", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_CODE": {\n\
                addTag(textArea, "code", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_RT": {\n\
                if (selStart !== selEnd) {\n\
                    var title = window.prompt("'+ lang['rt_text'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        break;\n\
                    }\n\
                    selectionText = textArea.value.substring(selStart, selEnd);\n\
                    console.log(selectionText);\n\
                    addTag(textArea, "rt", title, selectionText, false);\n\
                    // break;\n\
                } else {\n\
                    text = window.prompt("'+ lang['main_body'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    var title = window.prompt("'+ lang['rt_text'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        break;\n\
                    }\n\
                    addTag(textArea, "rt", title, text, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_QUOTE+": {\n\
                if (selStart !== selEnd) {\n\
                    var title = window.prompt("' + lang['main_body_prefix'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        title = "";\n\
                    }\n\
                    selectionText = textArea.value.substring(selStart, selEnd);\n\
                    // addTag(textArea, "quote", null, "", true);\n\
                    addTag(textArea, "quote", title, selectionText, false);\n\
                } else {\n\
                    text = window.prompt("' + lang['main_body'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    var title = window.prompt("' + lang['main_body_prefix'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        title = "";\n\
                    }\n\
                    addTag(textArea, "quote", title, text, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_URL+": {\n\
                if (selStart !== selEnd) {\n\
                    selectionText = textArea.value.substring(selStart, selEnd); // 选中的文字\n\
                    if (/^(?:https?|ftp|gopher|news|telnet|mms|rtsp):\\/\\/((?!&lt;|&gt;|\\s|"|>|\'|<|\\(|\\)|\\[|\\]).)+/gi.test(selectionText)) {\n\
                        // 选中的是URL时\n\
                        var title = window.prompt("' + lang['url_name'] + '");\n\
                        if (title === null || title.length === 0) {\n\
                            // selectionText = textArea.value.substring(selStart, selEnd);\n\
                            // addTag(textArea, "url", null, "", true);\n\
                            break;\n\
                        } else {\n\
                            addTag(textArea, "url", selectionText, title, false);\n\
                        }\n\
                    } else {\n\
                        // 选中的是文字时\n\
                        var url_link = window.prompt("' + lang['url_link'] + '");\n\
                        if (url_link === null || url_link.length === 0) {\n\
                            // selectionText = textArea.value.substring(selStart, selEnd);\n\
                            // addTag(textArea, "url", null, "", true);\n\
                            break;\n\
                        } else {\n\
                            addTag(textArea, "url", url_link, selectionText, false);\n\
                        }\n\
                    }\n\
                } else {\n\
                    text = window.prompt("' + lang['url_link'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    var title = window.prompt("' + lang['url_name'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        title = "";\n\
                        addTag(textArea, "url", null, text, false);\n\
                        break;\n\
                    }\n\
                    addTag(textArea, "url", text, title, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_SPOILER+": {\n\
                if (selStart !== selEnd) {\n\
                    var title = window.prompt("' + lang['main_body_prefix'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        addTag(textArea, "spoiler", null, "", true);\n\
                        break;\n\
                    }\n\
                    selectionText = textArea.value.substring(selStart, selEnd);\n\
                    // addTag(textArea, "spoiler", null, "", true);\n\
                    addTag(textArea, "spoiler", title, selectionText, false);\n\
                } else {\n\
                    text = window.prompt("' + lang['main_body'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    var title = window.prompt("' + lang['main_body_prefix'] + '");\n\
                    if (title === null || title.length === 0) {\n\
                        title = "";\n\
                        addTag(textArea, "spoiler", null, text, false);\n\
                        break;\n\
                    }\n\
                    addTag(textArea, "spoiler", title, text, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_SPOILER": {\n\
                addTag(textArea, "spoiler", null, "", true);\n\
                break;\n\
            }\n\
            case "EDITOR_QUOTE": {\n\
                if (selStart !== selEnd) {\n\
                    addTag(textArea, "quote", null, "", true);\n\
                } else {\n\
                    text = window.prompt("' + lang['main_body'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    // var title = window.prompt("' + lang['main_body_prefix'] + '");\n\
                    // if (title === null || title.length === 0) {\n\
                    //     title = "";\n\
                    // }\n\
                    addTag(textArea, "quote", null, text, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_URL": {\n\
                if (selStart !== selEnd) {\n\
                    addTag(textArea, "url", null, "", true);\n\
                } else {\n\
                    text = window.prompt("' + lang['url_link'] + '");\n\
                    if (text === null || text.length === 0) {\n\
                        break;\n\
                    }\n\
                    addTag(textArea, "url", null, text, false);\n\
                }\n\
                break;\n\
            }\n\
            case "EDITOR_LIST": {\n\
                if (selStart !== selEnd) {\n\
                    break;\n\
                }\n\
                addTag(textArea, "*", null, null, true);\n\
                break;\n\
            }\n\
        }\n\
        textArea.focus();\n\
    }</script>'
        );
    }
})();


async function sleep(interval) {
    return new Promise(resolve => {
        setTimeout(resolve, interval);
    })
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
    const spoiler_reg2 = new RegExp("\\[spoiler=([^\\]]+)\\](.*?)\\[/spoiler\\]", "gsi");
    while (spoiler_reg1.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg1, function (s, x) {
            return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                + lang['spoiler'] + '&nbsp;&nbsp;'
                + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                + '<button class="spoiler-button-hide">' + lang['spoiler_button_2'] + '</button>'
                + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                + x + '</span></td></tr></tbody></table>';
        });
    };
    while (spoiler_reg2.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg2, function (s, x, y) {
            if (f_reg.test(x)) {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + lang['spoiler'] + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                    + '<button class="spoiler-button-hide">' + lang['spoiler_button_2'] + '</button>'
                    + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                    + y + '</span></td></tr></tbody></table>';
            }
            else {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + x.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1") + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                    + '<button class="spoiler-button-hide">' + lang['spoiler_button_2'] + '</button>'
                    + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
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
                + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                + '<button class="spoiler-button-hide" style="">' + lang['spoiler_button_2'] + '</button>'
                + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                + y + '</span></td></tr></tbody></table>';
        }))
    });

    return $(htmlobj).html();
};


function lang_init(lang) {
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
            "auto_fold": "过深引用自动折叠"
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
            "auto_fold": "過深引用自動摺疊"
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
            "auto_fold": "過深引用自動摺疊"
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
            "auto_fold": "Over quote auto fold"
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
            "auto_fold": "Автоматическое складывание для более глубоких ссылок"
        }
    };
    return lang_json[lang];
};


function auto_save_message(url) {
    let db;
    let num_global = 10; // 设置自动保存时间间隔
    let num = 10; // 设置自动保存时间间隔

    $('#bbcodejs_tbody').append('<span id="auto_save_on" style="margin-top:4px; display: none;">'
        + '<input id="switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">'
        + '<input id="clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">'
        + '<span id="auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>'
        + '<span id="auto_save_off" style="margin-top:4px; display: none;">'
        + '<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>'
    )

    switch (url) {
        case 'forums': db = localforage.createInstance({ name: "forums" }); console.log('启用forums数据库'); break;
        case 'comment': db = localforage.createInstance({ name: "comment" }); console.log('启用comment数据库'); break;
        case 'contactstaff': db = localforage.createInstance({ name: "staff" }); console.log('启用staff数据库'); break;
        case 'sendmessage': db = localforage.createInstance({ name: "message" }); console.log('启用message数据库'); break;
        default: return;
    }

    // 为自动保存按钮绑定事件
    $("#auto_save_on").click(async function (ev) {
        let button_id = $(ev.target).attr('id');
        switch (button_id) {
            case 'switch':
                $(this).hide(); // 隐藏按钮
                $("#auto_save_off").fadeIn(200); // 渐入按钮
                clearInterval($("#auto_save_text").attr('title')); // 清除setInterval函数
                db.setItem('switch', false)
                console.log('自动保存已关闭');
                break;
            case 'clean':
                if (window.confirm("确定清空所有数据?")) {
                    await clean();
                    window.location.reload();
                };
                break;
        }
    });

    $("#auto_save_off").click(function () {
        $(this).hide(); // 隐藏按钮
        $("#auto_save_on").fadeIn(200);
        $("#auto_save_text").attr("title", setInterval(auto_save, 1000));  // 设置setInterval函数
        db.setItem('switch', true)
        console.log('自动保存已开启');
    });

    // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
    $("#qr").click(async function () {
        await clean()
        console.log('提交上传请求');
    });

    async function clean() {
        clearInterval($("#auto_save_text").attr('title')); // 清除setInterval函数
        await db.removeItem('time');
        await db.removeItem('bbcode');
        await db.removeItem('subject');
        console.log('已清空保存的记录');
    }

    // 检测上次自动保存开关设定
    db.getItem('switch').then(async (value) => {
        if (value) {
            // 启用自动保存
            $("#auto_save_on").show();
            $("#auto_save_off").hide();
            $("#auto_save_text").attr("title", setInterval(auto_save, 1000)); // 设置setInterval函数
            console.log('自动保存已开启');
            // 检查输入框内是否已经存在字符串
            let _input_bool = true
            $("#compose input[name='subject']").add('.bbcode').each(function () {
                let _input = $(this).val()
                if (_input !== "") { _input_bool = false; return; }
            });
            // 当输入框是空白时 还原上次备份内容
            if (_input_bool) {
                db.getItem('subject').then((value) => { $("#compose input[name='subject']").val(value); });
                await db.getItem('bbcode').then((value) => { $('.bbcode').val(value); }) // 还原bbcode输入框内容
                $('.bbcode').trigger("input"); // 手动触发bbcode更改
                console.log('已还原备份');
            };
        } else {
            // 关闭自动保存
            $("#auto_save_on").hide();
            $("#auto_save_off").show();
            db.setItem('switch', false);
        };
    }).catch(function (err) {
        // 第一次运行时 <第一次运行时 数据库里什么都没有>
        // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
        $("#auto_save_on").hide();
        $("#auto_save_off").show();
        db.setItem('switch', false);
        console.log('第一次运行');
        console.log(err);
    });

    async function auto_save() {
        num--;
        if (num <= 0) {
            $("#auto_save_text").fadeIn(2000);
            await db.setItem('time', getDateString()) // 记录保存数据的时间 string
            await db.setItem('bbcode', $('.bbcode').val()) // 保存 bbcode 输入框内容
            await db.setItem('subject', $("#compose input[name='subject']").val());
            num = num_global + 4; // 重置倒计时
            $("#auto_save_text").fadeOut(2000);
        };
    };
}


function auto_save_upload() {
    let num_global = num = 10 // 设置自动保存时间间隔

    $('#bbcodejs_tbody').append('<span id="auto_save_on" style="margin-top:4px; display: none;">'
        + '<input id="switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">'
        + '<input id="clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">'
        + '<span id="auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>'
        + '<span id="auto_save_off" style="margin-top:4px; display: none;">'
        + '<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>'
    )

    var db = localforage.createInstance({ name: "upload" });
    console.log('启用upload数据库');

    // 为自动保存按钮绑定事件
    $("#auto_save_on").click(function (ev) {
        let button_id = $(ev.target).attr('id');
        switch (button_id) {
            case 'switch':
                $(this).hide(); // 隐藏按钮
                $("#auto_save_off").fadeIn(200); // 渐入按钮
                clearInterval($("#auto_save_text").attr('title')); // 清除setInterval函数
                db.setItem('switch', false)
                console.log('发布页自动保存已关闭');
                break;
            case 'clean':
                if (window.confirm("确定清空所有数据?")) {
                    clean();
                    window.location.reload();
                };
                break;
        }
    });

    $("#auto_save_off").click(function () {
        $(this).hide();
        $("#auto_save_on").fadeIn(200);
        $("#auto_save_text").attr("title", setInterval(auto_save, 1000));  // 设置setInterval函数
        db.setItem('switch', true)
        console.log('发布页自动保存已开启');
    });

    // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
    $("#qr").click(function () {
        clean()
        console.log('提交上传请求');
    });

    function clean() {
        clearInterval($("#auto_save_text").attr('title')); // 清除setInterval函数
        db.removeItem('time');
        db.removeItem('bbcode');
        db.removeItem('small_descr');
        db.removeItem('poster');
        db.removeItem('anidb_url');
        db.removeItem('info');
        console.log('已清空保存的记录');
    }

    // 检测上次自动保存开关设定
    db.getItem('switch').then(async (value) => {
        if (value) {
            // 启用自动保存
            $("#auto_save_on").show();
            $("#auto_save_off").hide();
            $("#auto_save_text").attr("title", setInterval(auto_save, 1000)); // 设置setInterval函数
            console.log('发布页自动保存已开启');
            // 检查输入框内是否已经存在字符串
            let _input_bool = true
            $("#compose input[id$='-input']").add('#browsecat').add('.bbcode').each(function () {
                let _input = $(this).val()
                if (_input !== "" && _input !== "0") { _input_bool = false; return; } // 把input和select一起做判断了 总没人在标题里单独打个0吧
            });
            // 当输入框是空白时 还原上次备份内容
            if (_input_bool) {
                db.getItem('small_descr').then((value) => { $('[name="small_descr"]').val(value); })
                db.getItem('poster').then((value) => { $('[name="poster"]').val(value); });
                db.getItem('anidb_url').then((value) => { $('[name="anidburl"]').val(value); });
                await db.getItem('info').then((value) => {
                    if (value === null) return;
                    $('#browsecat').val(value['category']);
                    $('#browsecat').change(); // 手动触发列表更改事件
                    $('#autocheck_placeholder').children().eq(0).prop("checked", value['auto_pass']);
                    $('#autocheck_placeholder').children().eq(1).prop("checked", !value['auto_pass']);
                    for (var key in value) { if (/^(anime|manga|music|other)/.test(key)) { $('#' + key + '-input').val(value[key]); }; };
                });
                await db.getItem('bbcode').then((value) => { $('.bbcode').val(value); }) // 还原bbcode输入框内容
                $('[class^="torrent-info-input"]').trigger("input"); // 手动触发标题更改
                $('.bbcode').trigger("input"); // 手动触发bbcode更改
                console.log('已还原备份');
            };
        } else {
            // 关闭自动保存
            $("#auto_save_on").hide();
            $("#auto_save_off").show();
            db.setItem('switch', false);
            console.log('发布页自动保存已关闭');
        }
    }).catch(function (err) {
        // 第一次运行时 <第一次运行时 数据库里什么都没有>
        // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
        $("#auto_save_on").hide();
        $("#auto_save_off").show();
        db.setItem('switch', false);
        console.log('第一次运行');
        console.log(err);
    });

    async function auto_save() {
        // 由于安全问题 不允许为 input file 赋值
        num--
        // console.log(num);
        if (num <= 0) {
            $("#auto_save_text").fadeIn(2000);
            db.setItem('time', getDateString()) // 记录保存数据的时间 string
            await db.setItem('bbcode', $('.bbcode').val()) // 保存 bbcode 输入框内容
            // 倒是可以跑循环 直接拿到数据 就不用写这么大一堆了 (
            let upload_info = {
                "category": $('#browsecat').val(),
                "auto_pass": $('#autocheck_placeholder').children().eq(0).is(':checked'),
                "anime_chinese": $('#anime_chinese-input').val(),
                "anime_english": $('#anime_english-input').val(),
                "anime_original": $('#anime_original-input').val(),
                "anime_source": $('#anime_source-input').val(),
                "anime_resolution": $('#anime_resolution-input').val(),
                "anime_episode": $('#anime_episode-input').val(),
                "anime_container": $('#anime_container-input').val(),
                "anime_extra": $('#anime_extra-input').val(),
                "manga_title": $('#manga_title-input').val(),
                "manga_author": $('#manga_author-input').val(),
                "manga_volume": $('#manga_volume-input').val(),
                "manga_ended": $('#manga_ended-input').val(),
                "manga_publisher": $('#manga_publisher-input').val(),
                "manga_remark": $('#manga_remark-input').val(),
                "music_prefix": $('#music_prefix-input').val(),
                "music_collection": $('#music_collection-input').val(),
                "music_date": $('#music_date-input').val(),
                "music_category": $('#music_category-input').val(),
                "music_artist": $('#music_artist-input').val(),
                "music_title": $('#music_title-input').val(),
                "music_serial_number": $('#music_serial_number-input').val(),
                "music_quantity": $('#music_quantity-input').val(),
                "music_quality": $('#music_quality-input').val(),
                "music_format": $('#music_format-input').val(),
                "other_title": $('#other_title-input').val()
            };
            await db.setItem('info', upload_info);
            await db.setItem('small_descr', $('[name="small_descr"]').val());
            await db.setItem('poster', $('[name="poster"]').val());
            await db.setItem('anidb_url', $('[name="anidburl"]').val());
            num = num_global + 4; // 重置倒计时
            $("#auto_save_text").fadeOut(2000);
        };
    }
};


async function sync_scroll(element = '#bbcodejs_tbody') {
    let db = localforage.createInstance({ name: "bbcodejs" });  // 为以后统一数据库做准备
    console.log('启用bbcodejs数据库');
    $(element).append('<input id="sync_scroll_on" class="codebuttons" style="font-size:11px; margin-right:3px;; display: none;" type="button" value="同步滚动已开启"></input>'
        + '<input id="sync_scroll_off" class="codebuttons" style="font-size: 11px; margin-right:3px; display: none;" type="button" value="同步滚动已关闭"></input>'
    );

    await db.getItem('sync_scroll_switch').then(async (value) => {
        if (value) {
            $("#sync_scroll_on").show();
            new scroll_on();
            console.log('同步滚动已打开');
        } else {
            $("#sync_scroll_off").show();
            console.log('同步滚动已关闭');
        };
    });

    // 为按钮绑定事件
    $("#sync_scroll_off").click(function () {
        $(this).hide();
        $("#sync_scroll_on").fadeIn(200); // 渐入按钮
        db.setItem('sync_scroll_switch', true)
        new scroll_on();
        console.log('同步滚动已打开');
    });

    $("#sync_scroll_on").click(function () {
        $(this).hide();
        $("#sync_scroll_off").fadeIn(200); // 渐入按钮
        db.setItem('sync_scroll_switch', false)
        new scroll_off();
        console.log('同步滚动已关闭');
    });

    // 绑定鼠标事件
    function scroll_on() {
        let currentTab = 0;
        $('.bbcode').mouseover(() => { currentTab = 1; });
        $('#bbcode2').mouseover(() => { currentTab = 2; });

        $('.bbcode').scroll(() => {
            if (currentTab !== 1) return;
            let scale = ($('#bbcode2').children('.child').get(0).offsetHeight - $('#bbcode2').get(0).offsetHeight) / ($('.bbcode').get(0).scrollHeight - $('.bbcode').get(0).offsetHeight);
            $('#bbcode2').scrollTop($('.bbcode').scrollTop() * scale);
        });

        $('#bbcode2').scroll(() => {
            if (currentTab !== 2) return;
            let scale = ($('#bbcode2').children('.child').get(0).offsetHeight - $('#bbcode2').get(0).offsetHeight) / ($('.bbcode').get(0).scrollHeight - $('.bbcode').get(0).offsetHeight);
            $('.bbcode').scrollTop($('#bbcode2').scrollTop() / scale);
        });
    };

    // 解除鼠标事件
    function scroll_off() {
        $('.bbcode').off("scroll").off("mouseover");
        $('#bbcode2').off("scroll").off("mouseover");
    };
};

// 当前时间 字符串格式
function getDateString() {
    const time = new Date();
    return time.getFullYear().toString() + zero(time.getMonth() + 1).toString() + zero(time.getDate()).toString()
        + zero(time.getHours()) + zero(time.getMinutes()) + zero(time.getSeconds())
};

function zero(obj) {
    return obj < 10 ? '0' + obj : obj
};


// 有时间整合两个相同作用的函数 auto_save_message - autoSaveMessage
// elementButton 插入按钮的位置
// elementBbcode BBCODE输入框
// elementPost 提交按钮
// type 识别符
// parent 父级元素
async function autoSaveMessage(elementButton, elementBbcode, elementPost, type, parent = '#compose') {
    let db = localforage.createInstance({ name: "bbcodejs" });
    let num_global = 10; // 设置自动保存时间间隔
    let num = 10; // 设置自动保存时间间隔

    $(elementButton).append(`<span id="${type}_auto_save_on" style="margin-top:4px; display: none;">`
        + `<input id="${type}_switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">`
        + `<input id="${type}_clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">`
        + `<span id="${type}_auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>`
        + `<span id="${type}_auto_save_off" style="margin-top:4px; display: none;">`
        + `<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>`
    );

    // 为自动保存按钮绑定事件
    $(`#${type}_auto_save_on`).click(async function (ev) {  // 关闭自动保存
        let button_id = $(ev.target).attr('id');
        switch (button_id) {
            case `${type}_switch`:
                $(this).hide(); // 隐藏按钮
                $(`#${type}_auto_save_off`).fadeIn(200); // 渐入按钮
                clearInterval($(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
                await db.setItem(`${type}_autoSaveMessageSwitch`, false)
                console.log('自动保存已关闭');
                break;
            case `${type}_clean`:
                if (window.confirm("确定清空所有数据?")) {
                    await clean();
                    window.location.reload();
                };
                break;
        };
    });

    $(`#${type}_auto_save_off`).click(async function () {  // 开启自动保存
        $(this).hide(); // 隐藏按钮
        $(`#${type}_auto_save_on`).fadeIn(200);
        $(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000));  // 设置setInterval函数
        await db.setItem(`${type}_autoSaveMessageSwitch`, true)
        console.log('自动保存已开启');
    });

    // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
    $(elementPost).click(async function () {
        await clean()
        console.log('提交上传请求');
    });

    async function clean() {
        clearInterval($(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
        await db.removeItem(`${type}_autoSaveMessageTime`);
        await db.removeItem(`${type}_autoSaveMessageBbcode`);
        await db.removeItem(`${type}_autoSaveMessageSubject`);
        console.log('已清空保存的记录');
    };

    // 检测上次自动保存开关设定
    await db.getItem(`${type}_autoSaveMessageSwitch`).then(async (value) => {
        if (value) {
            // 启用自动保存
            $(`#${type}_auto_save_on`).show();
            $(`#${type}_auto_save_off`).hide();
            $(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000)); // 设置setInterval函数
            console.log('自动保存已开启');
            // 检查输入框内是否已经存在字符串
            let _input_bool = true
            $(`${parent} input[name='subject']`).add(elementBbcode).each(function () {
                let _input = $(this).val()
                if (_input !== "") { _input_bool = false; return; }
            });
            // 当输入框是空白时 还原上次备份内容
            if (_input_bool) {
                await db.getItem(`${type}_autoSaveMessageSubject`).then((value) => { $(`${parent} input[name='subject']`).val(value); });
                await await db.getItem(`${type}_autoSaveMessageBbcode`).then((value) => { $(elementBbcode).val(value); }) // 还原bbcode输入框内容
                $(elementBbcode).trigger("input"); // 手动触发bbcode更改
                console.log('已还原备份');
            };
        } else {
            // 关闭自动保存
            $(`#${type}_auto_save_on`).hide();
            $(`#${type}_auto_save_off`).show();
            await db.setItem(`${type}_autoSaveMessageSwitch`, false);
        };
    }).catch(async function (err) {
        // 第一次运行时 <第一次运行时 数据库里什么都没有>
        // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
        $(`#${type}_auto_save_on`).hide();
        $(`#${type}_auto_save_off`).show();
        await db.setItem(`${type}_autoSaveMessageSwitch`, false);
        console.log('第一次运行');
        console.log(err);
    });

    async function autoSave() {
        num--;
        // console.log(num);
        if (num <= 0) {
            $(`#${type}_auto_save_text`).fadeIn(2000);
            await db.setItem(`${type}_autoSaveMessageTime`, getDateString()) // 记录保存数据的时间 string
            await db.setItem(`${type}_autoSaveMessageBbcode`, $(elementBbcode).val()) // 保存 bbcode 输入框内容
            await db.setItem(`${type}_autoSaveMessageSubject`, $(`${parent} input[name='subject']`).val());
            num = num_global + 4; // 重置倒计时
            $(`#${type}_auto_save_text`).fadeOut(2000);
        };
    };
};


// 又一个相同功能的函数 x
async function syncScroll(element, type, bbcode, preview) {
    let db = localforage.createInstance({ name: "bbcodejs" });  // 为以后统一数据库做准备
    console.log('启用bbcodejs数据库');
    $(element).append(`<input id="${type}_sync_scroll_on" class="codebuttons" style="font-size:11px; margin-right:3px;; display: none;" type="button" value="同步滚动已开启"></input>`
        + `<input id="${type}_sync_scroll_off" class="codebuttons" style="font-size: 11px; margin-right:3px; display: none;" type="button" value="同步滚动已关闭"></input>`
    );

    await db.getItem(`${type}_syncScrollSwitch`).then(async (value) => {
        if (value) {
            $(`#${type}_sync_scroll_on`).show();
            new scroll_on();
            console.log('同步滚动已打开');
        } else {
            $(`#${type}_sync_scroll_off`).show();
            console.log('同步滚动已关闭');
        };
    });

    // 为按钮绑定事件
    $(`#${type}_sync_scroll_off`).click(async function () {
        $(this).hide();
        $(`#${type}_sync_scroll_on`).fadeIn(200); // 渐入按钮
        await db.setItem(`${type}_syncScrollSwitch`, true);
        new scroll_on();
        console.log('同步滚动已打开');
    });

    $(`#${type}_sync_scroll_on`).click(async function () {
        $(this).hide();
        $(`#${type}_sync_scroll_off`).fadeIn(200); // 渐入按钮
        await db.setItem(`${type}_syncScrollSwitch`, false);
        new scroll_off();
        console.log('同步滚动已关闭');
    });

    // 绑定鼠标事件
    function scroll_on() {
        let currentTab = 0;
        $(bbcode).mouseover(() => { currentTab = 1; });
        $(preview).mouseover(() => { currentTab = 2; });

        $(bbcode).scroll(() => {
            if (currentTab !== 1) return;
            let scale = ($(preview).children('.child').get(0).offsetHeight - $(preview).get(0).offsetHeight) / ($(bbcode).get(0).scrollHeight - $(bbcode).get(0).offsetHeight);
            $(preview).scrollTop($(bbcode).scrollTop() * scale);
        });

        $(preview).scroll(() => {
            if (currentTab !== 2) return;
            let scale = ($(preview).children('.child').get(0).offsetHeight - $(preview).get(0).offsetHeight) / ($(bbcode).get(0).scrollHeight - $(bbcode).get(0).offsetHeight);
            $(bbcode).scrollTop($(preview).scrollTop() / scale);
        });
    };

    // 解除鼠标事件
    function scroll_off() {
        $(bbcode).off("scroll").off("mouseover");
        $(preview).off("scroll").off("mouseover");
    };
};


// 自定义的BBCODE
(async () => {
    const shbox_button = $('[type="reset"]');  // 查找聊天版清除按钮
    if (shbox_button.length === 0) return;  // 聊天版自动刷新时，会再次触发当前函数 || 未开启聊天版
    $('#nav_block [type="reset"]').before('<input id="shbox_bbcode" type="button" class="codebuttons" value="高级">')

    function createTagBox(name, attribute, content) {
        var components = [];
        components.push('[');
        components.push(name);
        if (attribute !== null) {
            components.push('=');
            components.push(attribute);
        }
        components.push(']');
        if (content !== null) {
            components.push(content);
            components.push('[/');
            components.push(name);
            components.push(']');
        }
        return components.join('');
    }

    function replaceTextBox(str, start, end, replacement) {
        return str.substring(0, start) + replacement + str.substring(end);
    }

    function addTagBox(textArea, name, attribute, content, surround) {
        var selStart = textArea.selectionStart;
        var selEnd = textArea.selectionEnd;
        if (selStart === null || selEnd === null) {
            selStart = selEnd = textArea.value.length;
        }
        var selTarget = selStart + name.length + 2 + (attribute ? attribute.length + 1 : 0);
        if (selStart === selEnd) {
            textArea.value = replaceTextBox(textArea.value, selStart, selEnd, createTagBox(name, attribute, content));
        } else {
            var replacement = null;
            if (surround) {
                replacement = createTagBox(name, attribute, textArea.value.substring(selStart, selEnd));
            } else {
                replacement = createTagBox(name, attribute, content);
            }
            textArea.value = replaceTextBox(textArea.value, selStart, selEnd, replacement);
        }
        textArea.setSelectionRange(selTarget, selTarget);
    }

    function onEditorActionBox(action, param) {
        var textArea = document.querySelector('#box_bbcode');
        var selStart = textArea.selectionStart;
        var selEnd = textArea.selectionEnd;
        var selectionText, url;
        if (selStart === null || selEnd === null) {
            selStart = selEnd = textArea.value.length;
        };
        switch (action) {
            case 'B': {
                addTagBox(textArea, 'b', null, '', true);
                break;
            }
            case 'I': {
                addTagBox(textArea, 'i', null, '', true);
                break;
            }
            case 'U': {
                addTagBox(textArea, 'u', null, '', true);
                break;
            }
            case 'URL': {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, 'url', selectionText, selectionText, false);
                } else {
                    url = window.prompt("请输入链接URL：");
                    if (url === null || url.length === 0) {
                        break;
                    }
                    var title = window.prompt("请输入链接标题（可选）：");
                    if (title === null || title.length === 0) {
                        title = url;
                    }
                    addTagBox(textArea, 'url', url, title, false);
                }
                break;
            }
            case 'IMG': {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, 'img', null, selectionText, false);
                } else {
                    url = window.prompt("请输入图片的完整路径：");
                    // url = window.prompt(EDITOR_LANG.image);
                    if (url === null) {
                        break;
                    }
                    var urlLower = url.toLowerCase();
                    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
                        // window.alert(EDITOR_LANG['invalid_image']);
                        window.alert("图片URL必须以http://或https://开头。");
                        break;
                    }
                    addTagBox(textArea, 'img', null, url, false);
                }
                break;
            }
            case 'QUOTE': {
                addTagBox(textArea, 'quote', null, '', true);
                break;
            }
            case 'COLOR': {
                if (param !== "") {
                    addTagBox(textArea, 'color', param, '', true);
                }
                break;
            }
            case 'FONT': {
                if (param !== "") {
                    addTagBox(textArea, 'font', param, '', true);
                }
                break;
            }
            case 'SIZE': {
                if (param !== "") {
                    addTagBox(textArea, 'size', param, '', true);
                }
                break;
            }
            // 自定义
            case "S": {
                addTagBox(textArea, "s", null, "", true);
                break;
            }
            case "INFO": {
                addTagBox(textArea, "info", null, "", true);
                break;
            }
            case "MEDIAINFO": {
                addTagBox(textArea, "mediainfo", null, "", true);
                break;
            }
            case "PRE": {
                addTagBox(textArea, "pre", null, "", true);
                break;
            }
            case "CODE": {
                addTagBox(textArea, "code", null, "", true);
                break;
            }
            case "RT*": {
                if (selStart !== selEnd) {
                    var title = window.prompt(lang['rt_text']);
                    if (title === null || title.length === 0) {
                        break;
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, "rt", title, selectionText, false);
                    // break;
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    var title = window.prompt(lang['rt_text']);
                    if (title === null || title.length === 0) {
                        break;
                    }
                    addTagBox(textArea, "rt", title, text, false);
                }
                break;
            }
            case "QUOTE*": {
                if (selStart !== selEnd) {
                    var title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    // addTag(textArea, "quote", null, "", true);
                    addTagBox(textArea, "quote", title, selectionText, false);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    var title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                    }
                    addTagBox(textArea, "quote", title, text, false);
                }
                break;
            }
            case "URL*": {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd); // 选中的文字
                    if (/^(?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+/gi.test(selectionText)) {
                        // 选中的是URL时
                        var title = window.prompt(lang['url_name']);
                        if (title === null || title.length === 0) {
                            // selectionText = textArea.value.substring(selStart, selEnd);
                            // addTag(textArea, "url", null, "", true);
                            break;
                        } else {
                            addTagBox(textArea, "url", selectionText, title, false);
                        };
                    } else {
                        // 选中的是文字时
                        var url_link = window.prompt(lang['url_link']);
                        if (url_link === null || url_link.length === 0) {
                            // selectionText = textArea.value.substring(selStart, selEnd);
                            // addTag(textArea, "url", null, "", true);
                            break;
                        } else {
                            addTagBox(textArea, "url", url_link, selectionText, false);
                        };
                    };
                } else {
                    let text = window.prompt(lang['url_link']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    var title = window.prompt(lang['url_name']);
                    if (title === null || title.length === 0) {
                        title = "";
                        addTagBox(textArea, "url", null, text, false);
                        break;
                    }
                    addTagBox(textArea, "url", text, title, false);
                }
                break;
            }
            case "SPOILER*": {
                if (selStart !== selEnd) {
                    var title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        addTagBox(textArea, "spoiler", null, "", true);
                        break;
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    // addTag(textArea, "spoiler", null, "", true);
                    addTagBox(textArea, "spoiler", title, selectionText, false);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    var title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                        addTagBox(textArea, "spoiler", null, text, false);
                        break;
                    }
                    addTagBox(textArea, "spoiler", title, text, false);
                }
                break;
            }
            case "SPOILER": {
                addTagBox(textArea, "spoiler", null, "", true);
                break;
            }
            case "QUOTE": {
                if (selStart !== selEnd) {
                    addTagBox(textArea, "quote", null, "", true);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    };
                    addTagBox(textArea, "quote", null, text, false);
                }
                break;
            };
            case "URL": {
                if (selStart !== selEnd) {
                    addTagBox(textArea, "url", null, "", true);
                } else {
                    let text = window.prompt(lang['url_link']);
                    if (text === null || text.length === 0) {
                        break;
                    };
                    addTagBox(textArea, "url", null, text, false);
                }
                break;
            };
            case "LIST": {
                if (selStart !== selEnd) {
                    break;
                };
                addTagBox(textArea, "*", null, null, true);
                break;
            };
            case (action.match(/^#\[.+\]$/i) || {}).input: {
                addTagBox(textArea, action.slice(2, -1), null, null, true);
                break;
            };
        }
        textArea.focus();
    };

    // 别问 我懒
    var t = `<style type="text/css">.dialog { position: absolute; z-index: 9999; padding-bottom: 10px; display: none; } .h2_move { cursor: move; margin-block-start: 0em; margin-block-end: 0em; } td.smile-icon {padding: 3px !important;}</style>
    <div class="dialog" id="dialog">
      <form id="compose_custom" method="post" name="compose_custom">
        <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
          <tbody>
            <tr>
              <td class="embedded">
                <h2 class="h2_move" id="move_part" align="left">聊天区</h2>
                <table width="100%" border="1" cellspacing="0" cellpadding="10">
                  <table width="100%" border="1" cellspacing="0" cellpadding="10">
                    <tbody>
                      <tr>
                        <td class="text" align="center">
                          <table class="main" width="100%" border="1" cellspacing="0" cellpadding="5">
                            <tbody>
                              <tr>
                                <td class="rowhead" valign="top">正文</td>
                                <td class="rowfollow" align="left">
                                  <div id="editorouterbox" style="display: block;">
                                    <table width="100%" cellspacing="0" cellpadding="5" border="0">
                                      <tbody>
                                        <tr>
                                          <td align="left" colspan="2">
                                            <table cellspacing="1" cellpadding="2" border="0">
                                              <tbody>
                                                <tr>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-weight: bold;font-size:11px; margin-right:3px" type="button" value="B" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-style: italic;font-size:11px;margin-right:3px" type="button" value="I" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="text-decoration: underline;font-size:11px;margin-right:3px" type="button" value="U" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="text-decoration: line-through;font-size:11px;margin-right:3px" type="button" value="S" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="URL" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="URL*" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="IMG" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="RT*" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="LIST" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="PRE" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="CODE" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="QUOTE" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="QUOTE*" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="INFO" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="MEDIAINFO" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER" name="bbcode_button">
                                                  </td>
                                                  <td class="embedded">
                                                    <input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER*" name="bbcode_button">
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                            <div id="bbcodejs_tbody_box" style="position:relative; margin-top: 4px">
                                              <div id="bbcodejs_select_box" style="position: absolute; margin-top: 2px; margin-bottom: 2px; float: left;">
                                                <select class="med codebuttons" style="margin-right: 3px; visibility: visible;" name="bbcode_color">
                                                  <option value="">--- 颜色 ---</option>
                                                  <option style="background-color: black" value="Black">Black</option>
                                                  <option style="background-color: sienna" value="Sienna">Sienna</option>
                                                  <option style="background-color: darkolivegreen" value="DarkOliveGreen">Dark Olive Green</option>
                                                  <option style="background-color: darkgreen" value="DarkGreen">Dark Green</option>
                                                  <option style="background-color: darkslateblue" value="DarkSlateBlue">Dark Slate Blue</option>
                                                  <option style="background-color: navy" value="Navy">Navy</option>
                                                  <option style="background-color: indigo" value="Indigo">Indigo</option>
                                                  <option style="background-color: darkslategray" value="DarkSlateGray">Dark Slate Gray</option>
                                                  <option style="background-color: darkred" value="DarkRed">Dark Red</option>
                                                  <option style="background-color: darkorange" value="DarkOrange">Dark Orange</option>
                                                  <option style="background-color: olive" value="Olive">Olive</option>
                                                  <option style="background-color: green" value="Green">Green</option>
                                                  <option style="background-color: teal" value="Teal">Teal</option>
                                                  <option style="background-color: blue" value="Blue">Blue</option>
                                                  <option style="background-color: slategray" value="SlateGray">Slate Gray</option>
                                                  <option style="background-color: dimgray" value="DimGray">Dim Gray</option>
                                                  <option style="background-color: red" value="Red">Red</option>
                                                  <option style="background-color: sandybrown" value="SandyBrown">Sandy Brown</option>
                                                  <option style="background-color: yellowgreen" value="YellowGreen">Yellow Green</option>
                                                  <option style="background-color: seagreen" value="SeaGreen">Sea Green</option>
                                                  <option style="background-color: mediumturquoise" value="MediumTurquoise">Medium Turquoise</option>
                                                  <option style="background-color: royalblue" value="RoyalBlue">Royal Blue</option>
                                                  <option style="background-color: purple" value="Purple">Purple</option>
                                                  <option style="background-color: gray" value="Gray">Gray</option>
                                                  <option style="background-color: magenta" value="Magenta">Magenta</option>
                                                  <option style="background-color: orange" value="Orange">Orange</option>
                                                  <option style="background-color: yellow" value="Yellow">Yellow</option>
                                                  <option style="background-color: lime" value="Lime">Lime</option>
                                                  <option style="background-color: cyan" value="Cyan">Cyan</option>
                                                  <option style="background-color: deepskyblue" value="DeepSkyBlue">Deep Sky Blue</option>
                                                  <option style="background-color: darkorchid" value="DarkOrchid">Dark Orchid</option>
                                                  <option style="background-color: silver" value="Silver">Silver</option>
                                                  <option style="background-color: pink" value="Pink">Pink</option>
                                                  <option style="background-color: wheat" value="Wheat">Wheat</option>
                                                  <option style="background-color: lemonchiffon" value="LemonChiffon">Lemon Chiffon</option>
                                                  <option style="background-color: palegreen" value="PaleGreen">Pale Green</option>
                                                  <option style="background-color: paleturquoise" value="PaleTurquoise">Pale Turquoise</option>
                                                  <option style="background-color: lightblue" value="LightBlue">Light Blue</option>
                                                  <option style="background-color: plum" value="Plum">Plum</option>
                                                  <option style="background-color: white" value="White">White</option>
                                                </select>
                                                <select class="med codebuttons" name="bbcode_font" style="visibility: visible;">
                                                  <option value="">--- 字体 ---</option>
                                                  <option value="Arial">Arial</option>
                                                  <option value="Arial Black">Arial Black</option>
                                                  <option value="Arial Narrow">Arial Narrow</option>
                                                  <option value="Book Antiqua">Book Antiqua</option>
                                                  <option value="Century Gothic">Century Gothic</option>
                                                  <option value="Comic Sans MS">Comic Sans MS</option>
                                                  <option value="Courier New">Courier New</option>
                                                  <option value="Fixedsys">Fixedsys</option>
                                                  <option value="Garamond">Garamond</option>
                                                  <option value="Georgia">Georgia</option>
                                                  <option value="Impact">Impact</option>
                                                  <option value="Lucida Console">Lucida Console</option>
                                                  <option value="Lucida Sans Unicode">Lucida Sans Unicode</option>
                                                  <option value="Microsoft Sans Serif">Microsoft Sans Serif</option>
                                                  <option value="Palatino Linotype">Palatino Linotype</option>
                                                  <option value="System">System</option>
                                                  <option value="Tahoma">Tahoma</option>
                                                  <option value="Times New Roman">Times New Roman</option>
                                                  <option value="Trebuchet MS">Trebuchet MS</option>
                                                  <option value="Verdana">Verdana</option>
                                                </select>
                                                <select class="med codebuttons" name="bbcode_size" style="visibility: visible;">
                                                  <option value="">--- 字号 ---</option>
                                                  <option value="1">1</option>
                                                  <option value="2">2</option>
                                                  <option value="3">3</option>
                                                  <option value="4">4</option>
                                                  <option value="5">5</option>
                                                  <option value="6">6</option>
                                                  <option value="7">7</option>
                                                </select>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td colspan="2" valign="middle">
                                            <iframe src="attachment.php?text_area_id=box_bbcode" width="100%" height="24" frameborder="0" scrolling="no" marginheight="0" marginwidth="0"></iframe>
                                          </td>
                                        </tr>
                                        <tr>
                                          <td align="left">
                                            <textarea class="box_bbcode" cols="100" style="width: 99%" id="box_bbcode" rows="20""></textarea>
                                          </td>
                                          <td align="center" width="150">
                                            <table cellspacing="1" cellpadding="3">
                                              <tbody>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em1]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/1.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em2]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/2.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em3]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/3.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em5]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/5.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em6]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/6.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em7]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/7.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em8]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/8.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em9]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/9.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em10]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/10.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em11]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/11.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em13]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/13.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em16]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/16.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em17]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/17.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em19]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/19.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em20]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/20.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em21]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/21.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em24]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/24.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em25]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/25.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em26]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/26.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em27]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/27.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em28]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/28.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em29]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/29.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em30]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/30.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em31]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/31.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em32]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/32.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em33]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/33.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em34]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/34.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em35]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/35.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em36]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/36.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em39]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/39.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em40]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/40.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em41]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/41.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                                <tr>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em42]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/42.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em192]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/192.gif" alt="">
                                                    </a>
                                                  </td>
                                                  <td class="embedded smile-icon">
                                                    <a href="#[em198]" name="bbcode_smile">
                                                      <img style="max-width: 25px;" src="pic/smilies/198.gif" alt="">
                                                    </a>
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                            <br>
                                            <a onclick="ShowSmileWindow(&quot;compose_custom&quot;, &quot;box_bbcode&quot;)">更多表情</a>
                                          </td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                              <tr>
                                <td colspan="2" align="center">
                                  <table>
                                    <tbody>
                                      <tr>
                                        <td class="embedded">
                                          <input id="post_box" type="button" class="btn" value="发送">
                                        </td>
                                        <td class="embedded">
                                          <input id="close_box" type="button" class="btn" value="关闭">
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    </tbody>
                  </table>
      </form>
    </div>`

    // 插入框架
    $('body').append(t)
    // 插入预览框
    $('#box_bbcode').parents("tr:eq(1)").after(`<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">${lang['preview']}</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2"><div id="bbcode2_box" style="min-height: 25px; max-height: 1px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;"><div class="child"></div></div></td></tr></tbody></table></td>`);
    // 插入同步窗口滚动按钮
    await syncScroll('#bbcodejs_tbody_box', 'shoutbox', '#box_bbcode', '#bbcode2_box');
    // 插入自动保存按钮
    await autoSaveMessage('#bbcodejs_tbody_box', '#box_bbcode', '#post_box', 'shoutbox', 'compose_custom')

    $('[name="bbcode_color"]').change(function () { onEditorActionBox('COLOR', this.options[this.selectedIndex].value); this.selectedIndex = 0; });   // 下拉菜单监听
    $('[name="bbcode_font"]').change(function () { onEditorActionBox('FONT', this.options[this.selectedIndex].value); this.selectedIndex = 0; });  // 下拉菜单监听
    $('[name="bbcode_size"]').change(function () { onEditorActionBox('SIZE', this.options[this.selectedIndex].value); this.selectedIndex = 0; });  // 下拉菜单监听
    $('[name="bbcode_button"]').click(function () { onEditorActionBox(this.value); });  // 按钮监听
    $('[name="bbcode_smile"]').mouseenter(function () { $(this).children('img').css({ "transform": "scale(1.35)", "transition": "all 0.3s" }); });  // 输入框右边表情，鼠标悬浮图标变大
    $('[name="bbcode_smile"]').mouseleave(function () { $(this).children('img').css({ "transform": "" }); });  // 输入框右边表情，鼠标离开图标恢复原状
    $('[name="bbcode_smile"]').click(function () { onEditorActionBox($(this).attr('href')); });  // 输入框右边表情，点击图标输入表情
    $('#post_box').click(function () { $('#shbox_text').val($('#box_bbcode').val()); $dialog.hide(); $('[name="shbox"]').trigger("submit"); });  // 发送
    $('#close_box').click(function () { $dialog.hide(); });  // 关闭窗口
    // 监听各种按钮的点击事件
    $('[name="bbcode_color"],[name="bbcode_font"],[name="bbcode_size"],[name="bbcode_button"],[name="bbcode_smile"],td.embedded.smile-icon a').click(async function () { $('#bbcode2_box').children('.child').html(bbcode2html($('#box_bbcode').val())); });
    // 监听bbcode写入时间
    $('#box_bbcode').bind('input propertychange', async function () { $('#bbcode2_box').children('.child').html(bbcode2html($(this).val())); });

    var $dialog = $("#dialog");
    //点击弹出窗口
    $("#shbox_bbcode").click(async function () {
        let shbox_text = $('#shbox_text').val(); // 获取输入框的值，如引用之类的数据
        if (shbox_text !== '') $('#box_bbcode').val(shbox_text);  // 如果外部输入框不为空，则引入外部输入框的值
        $dialog.show(); // 显示悬浮窗口
        $("#bbcode2_box").css("max-height", ($('#box_bbcode').height() + 30) + "px");  // 设置悬浮窗口中预览窗口的最大高度
        // const margin = $('#bbcodejs_tbody_box').width() - $("#bbcodejs_select_box").width() - 2.6;
        const margin = $('#compose_custom .codebuttons').parents('tbody').eq(0).width() - $("#bbcodejs_select_box").width() - 2.6;
        $("#bbcodejs_select_box").css("margin-left", margin + "px");
        autoCenter($dialog);  // 窗口居中
        $('#box_bbcode').trigger("input"); // 手动触发bbcode更改
    });

    // 同步窗口大小变化
    let MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    let element = document.querySelector('#box_bbcode');
    var height_now, height_last;
    var observer = new MutationObserver((mutations) => {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                height_now = Number(mutation.target.style.height.replace('px', '')) + 30;
                if (height_last === height_now) { return } else { height_last = height_now; };
                $("#bbcode2_box").css("max-height", height_now + "px");
            };
        })
    });
    observer.observe(element, {
        attributes: true,
        attributeFilter: ['style']
    });

    //自动居中对话框
    function autoCenter(ev) {
        var bodyW = $(window).width();
        var bodyH = $(window).height();
        var evW = ev.width();
        var evH = ev.height();
        $dialog.css({ "left": (bodyW - evW) / 2 + 'px', "top": (bodyH - evH) / 2 + 'px' });
    };

    // 拖动悬浮窗口   ps.是真的卡
    var mx = 0;  // 鼠标x轴
    var my = 0;  // 鼠标y轴
    var dx = 0;  // 元素x轴
    var dy = 0;  // 元素y轴
    var isDraging = false;  // 是否允许拖动

    //鼠标按下
    $("#dialog").mousedown(function (e) {
        e = e || window.event;
        if (e.target.nodeName === 'TD' || e.target.nodeName === 'DIV' || e.target.nodeName === 'H2') {
            mx = e.pageX;  // 鼠标X坐标
            my = e.pageY;  // 鼠标Y坐标
            dx = $dialog.offset().left;  // 元素x轴
            dy = $dialog.offset().top;  // 元素y轴
            isDraging = true;  //标记对话框可拖动
        };
    });

    // 鼠标松开
    $("#dialog").mouseup(function () {
        isDraging = false;
    });

    // 鼠标离开
    $("#dialog").mouseleave(function () {
        isDraging = false;
    });

    //鼠标移动
    $(document).mousemove(function (e) {
        e = e || window.event;
        var x = e.pageX;  // 鼠标X坐标
        var y = e.pageY;  // 鼠标Y坐标
        if (isDraging) { // 判断能否允许拖动
            var moveX = dx + x - mx;  // 元素新的left值
            var moveY = dy + y - my; // 元素新的top值
            // 范围
            // var pageW = $(window).width();
            // var pageH = $(window).height();
            // var dialogW = $dialog.width();
            // var dialogH = $dialog.height();
            // var maxX = pageW - dialogW;       //X轴可拖动最大值
            // var maxY = pageH - dialogH;       //Y轴可拖动最大值
            // moveX = Math.min(Math.max(0, moveX), maxX);     //X轴可拖动范围
            // moveY = Math.min(Math.max(0, moveY), maxY);     //Y轴可拖动范围
            // 设置元素的left,top
            $dialog.css({ "left": moveX + 'px', "top": moveY + 'px' });
        };
    });

})();
