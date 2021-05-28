// ==UserScript==
// @name         U2实时预览BBCODE
// @namespace    https://u2.dmhy.org/
// @version      0.1.3
// @description  实时预览BBCODE
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/upload.php*
// @match        *://u2.dmhy.org/edit.php*
// @match        *://u2.dmhy.org/forums.php?action=editpost*
// @match        *://u2.dmhy.org/forums.php?action=reply*
// @match        *://u2.dmhy.org/forums.php?action=quotepost*
// @match        *://u2.dmhy.org/comment.php?action=*
// @icon         https://u2.dmhy.org/favicon.ico
// @updateURL    https://github.com/kysdm/u2_share/raw/main/u2share_bbcode.user.js
// @installURL   https://github.com/kysdm/u2_share/raw/main/u2share_bbcode.user.js
// @downloadURL  https://github.com/kysdm/u2_share/raw/main/u2share_bbcode.user.js
// @license      Apache-2.0
// ==/UserScript==

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
    多语言支持
    使用原生JS实现 <本来是原生JS的，写着写着觉得好繁琐，就上jq了。>
*/

/*
与U2娘显示不同的标签 (非标准操作)
    [spoiler="剧透是不"可能的！"]真的！[/spoiler]
        U2      => "剧透是不"可能的！"
        Script  => 剧透是不"可能的！
*/


(async () => {
    'use strict';

    new init();
    let currentTab = 0;

    $('.bbcode').parents("tr:eq(1)").after('<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">'
        + '预览</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2">'
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

    $('.bbcode').mouseover(() => {
        currentTab = 1;
    });

    $('#bbcode2').mouseover(() => {
        currentTab = 2;
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

    if (location.href.match(/u2\.dmhy\.org\/upload\.php/i)) {

        // 添加中括号
        function add_brackets(txt) { if (txt === '') { return ''; } else { return '[' + txt + ']'; } };

        // 检查重叠的中括号
        function check_title(txt) {
            if (/\[{2,}|\]{2,}/g.test(txt)) { return '<font color="red">' + txt + '</font>'; } else { return txt; }
        };

        var main_title = '<font color="red"><b>请选择分类...</b></font>';

        function add_main_title() {
            var type_id = $('#browsecat').val();
            if (type_id === '0') {
                // console.log('请选择分类...');
                main_title = '<font color="red"><b>请选择分类...</b></font>';
            } else if (['9', '411', '413', '12', '13', '14', '15', '16', '17', '410', '412'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' anime');
                main_title = '<b>'
                    + add_brackets($('#anime_chinese').find("input").val())
                    + add_brackets($('#anime_english').find("input").val())
                    + add_brackets($('#anime_original').find("input").val())
                    + add_brackets($('#anime_source').find("input").val())
                    + add_brackets($('#anime_resolution').find("input").val())
                    + add_brackets($('#anime_episode').find("input").val())
                    + add_brackets($('#anime_container').find("input").val())
                    + add_brackets($('#anime_extra').find("input").val())
                    + '</b>';
            } else if (['21', '22', '23'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' manga');
                main_title = '<b>'
                    + add_brackets($('#manga_title').find("input").val())
                    + add_brackets($('#manga_author').find("input").val())
                    + add_brackets($('#manga_volume').find("input").val())
                    + add_brackets($('#manga_ended').find("select").val())
                    + add_brackets($('#manga_publisher').find("input").val())
                    + add_brackets($('#manga_remark').find("input").val())
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
                            + add_brackets($('#music_date').find("input").val())
                            + add_brackets($('#music_category').find("input").val())
                            + add_brackets($('#music_artist').find("input").val())
                            + add_brackets($('#music_title').find("input").val())
                            + add_brackets($('#music_serial_number').find("input").val())
                            + add_brackets((() => { if (music_quality) { return $('#music_quality').find("input").val(); } else { return ''; } })())
                            + add_brackets($('#music_format').find("input").val())
                            + '</b>';
                        break;
                    case "1": // 合集
                        main_title = '<b>'
                            + add_brackets(prefix_1)
                            + add_brackets('合集')
                            + add_brackets($('#music_category').find("input").val())
                            + add_brackets($('#music_title').find("input").val())
                            + add_brackets($('#music_quantity').find("input").val())
                            + add_brackets((() => { if (music_quality) { return $('#music_quality').find("input").val(); } else { return ''; } })())
                            + '</b>';
                        break;
                }
            } else if (type_id === '40') {
                // console.log('分类ID是： ' + type_id + ' other');
                main_title = '<b>' + $('#other_title').find("input").val() + '</b>';
            } else {
                // console.log('分类ID是： ' + type_id);
            }
            $('#checktitle').html(check_title(main_title));
        }

        $("#browsecat").change(() => { new add_main_title; })
        $(".torrent-info-input").bind('input propertychange', () => { new add_main_title; });
        $('#other_title').after('<tr><td class="rowhead nowrap" valign="top" align="right">主标题</td>'
            + '<td id="checktitle" class="rowfollow" valign="top" align="left" valign="middle">' + main_title + '</td></tr>'
        );
    };
})();


async function sleep(interval) {
    return new Promise(resolve => {
        setTimeout(resolve, interval);
    })
}


function bbcode2html(bbcodestr) {
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
        return addTempCode('<br /><div class="codetop">代码</div><div class="codemain">' + x + '</div><br />');
    });

    // info 标签
    const info_reg = new RegExp("\\[(mediainfo|info)\\](.+?)\\[\\/(\\1)\\]", "gis");
    bbcodestr = bbcodestr.replace(info_reg, function (s, x, y) {
        switch (x) {
            case 'info':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: blue">发布信息</span>'
                    + '</b></legend>' + y + '</fieldset>');
            case 'mediainfo':
                return addTempCode('<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: red">媒体信息</span>'
                    + '</b></legend>' + y + '</fieldset>');
            default:
                return s;
        }
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
                        return '<ruby>' + y + '<rp>(</rp><rt>' + x.replace(/^"?(.*?)"?$/, "$1") + '</rt><rp>)</rp></ruby>';
                    }
                case 'font':
                    if (f_reg.test(x)) {
                        return '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + w) + '=' + x + ']'
                            + y + '[' + addTempCode('p3F#oW2@cEn_JHstp-&37DgD' + z) + ']';
                    }
                    else {
                        return '<span style="font-family: ' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</span>';
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
    const color_reg = new RegExp("\\[color=\"?([#0-9a-z]{1,15}|[a-z]+?)\"?\\](.*?)\\[/color\\]", "gis");
    while (color_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(color_reg, function (s, x, y) {
            return '<span style="color: ' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</span>';
        })
    };

    // 文字大小
    const size_reg = new RegExp("\\[size=\"?([1-7])\"?\\](.*?)\\[/size\\]", "gis");
    while (size_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(size_reg, function (s, x, y) {
            return '<font size="' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</font>';
        })
    };

    // 图片
    bbcodestr = bbcodestr.replace(/\[(img|imglnk)\]([^\]]+)\[\/(?:\1)\]/gi, function (s, x, y) {
        if (/^https?:\/\/((?!&lt;|&gt;|\s|"|>|'|<|;|\(|\)|\[|\]).)+$/i.test(y)) {
            switch (x) {
                case 'img':
                    return addTempCode('<img alt="image" src="' + y + '" style="height: auto; width: auto; max-width: 100%;">');
                case 'imglnk':
                    return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + y + '"><img alt="image" src="'
                        + y + '" style="height: auto; width: auto; max-width: 100%;"></a>');
            }
        } else {
            return addTempCode(s)
        }
    });

    bbcodestr = bbcodestr.replace(/\[img=([^\]]+)\]/gi, function (s, x) {
        if (/^https?:\/\/((?!&lt;|&gt;|\s|"|>|'|<|;|\(|\)|\[|\]).)+$/i.test(x)) {
            return addTempCode('<img alt="image" src="' + x + '" style="height: auto; width: auto; max-width: 100%;">');
        } else {
            return addTempCode(s)
        }
    });

    // 超链接
    bbcodestr = bbcodestr.replace(/\[url=((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\](.+?)\[\/url\]/gis, function (s, x, y, z) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + z + '</a>');
    });

    bbcodestr = bbcodestr.replace(/\[url\]((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)\[\/url\]/gis, function (s, x) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>')
    });

    bbcodestr = bbcodestr.replace(/((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)/gi, function (s, x) {
        return '<a class="faqlink" rel="nofollow noopener noreferer" href="' + s + '">' + s + '</a>';
    });

    // 引用
    const quote_reg1 = new RegExp("\\[quote\\](.*?)\\[/quote\\]", "gsi");
    while (quote_reg1.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(quote_reg1, function (s, x) {
            return '<fieldset><legend>引用</legend>' + x + '</fieldset>';
        });
    };
    const quote_reg2 = new RegExp("\\[quote=([^\\]]*)\\](.*?)\\[/quote\\]", "gsi");
    while (quote_reg2.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(quote_reg2, function (s, x, y) {
            if (f_reg.test(x)) {
                return '<fieldset><legend>引用</legend>' + y + '</fieldset>';
            }
            else {
                return '<fieldset><legend>引用: ' + x.replace(/^"(.*?)"?$/, "$1") + '</legend>' + y + '</fieldset>';
            }
        });
    };

    // spoiler
    const spoiler_reg1 = new RegExp("\\[spoiler\\](.*?)\\[/spoiler\\]", "gsi");
    const spoiler_reg2 = new RegExp("\\[spoiler=([^\\]]+)\\](.*?)\\[/spoiler\\]", "gsi");
    while (spoiler_reg1.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg1, function (s, x) {
            return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                + '警告！下列文字很可能泄露剧情，请谨慎选择是否观看。&nbsp;&nbsp;'
                + '<button class="spoiler-button-show" style="display: none;">我就是手贱</button>'
                + '<button class="spoiler-button-hide">我真是手贱</button>'
                + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                + x + '</span></td></tr></tbody></table>';
        });
    };
    while (spoiler_reg2.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(spoiler_reg2, function (s, x, y) {
            if (f_reg.test(x)) {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + '警告！下列文字很可能泄露剧情，请谨慎选择是否观看。&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show" style="display: none;">我就是手贱</button>'
                    + '<button class="spoiler-button-hide">我真是手贱</button>'
                    + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                    + y + '</span></td></tr></tbody></table>';
            }
            else {
                return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                    + x.replace(/^"(.*?)"?$/, "$1") + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show" style="display: none;">我就是手贱</button>'
                    + '<button class="spoiler-button-hide">我真是手贱</button>'
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

    if (/(<br>)$/.test(bbcodestr)) { bbcodestr = bbcodestr + '<br>' }

    // console.log(bbcodestr);
    // console.log(tempCode);

    return bbcodestr;
}


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
            + 'font-size:11px;margin-right:3px" type="button" value="RT+" onclick="onEditorActionS(\'descr\', \'EDITOR_RT\')">');

    $('.codebuttons').eq(10).attr("onclick", "onEditorActionS('descr','EDITOR_QUOTE')");

    $('.codebuttons').eq(10).parent()
        .after('<td class="embedded"><input class="codebuttons" style="'
            + 'font-size:11px;margin-right:3px" type="button" value="SPOILER+" onclick="onEditorActionS(\'descr\', \'EDITOR_SPOILER+\')">')
        .after('<td class="embedded"><input class="codebuttons" style="'
            + 'font-size:11px;margin-right:3px" type="button" value="SPOILER" onclick="onEditorActionS(\'descr\', \'EDITOR_SPOILER\')">')
        .after('<td class="embedded"><input class="codebuttons" style="'
            + 'font-size:11px;margin-right:3px" type="button" value="MEDIAINFO" onclick="onEditorActionS(\'descr\', \'EDITOR_MEDIAINFO\')">')
        .after('<td class="embedded"><input class="codebuttons" style="'
            + 'font-size:11px;margin-right:3px" type="button" value="INFO" onclick="onEditorActionS(\'descr\', \'EDITOR_INFO\')">')
        .after('<td class="embedded"><input class="codebuttons" style="'
            + 'font-size:11px;margin-right:3px" type="button" value="QUOTE+" onclick="onEditorActionS(\'descr\', \'EDITOR_QUOTE+\')">');

    $('.codebuttons').parents('td:not(.embedded,.rowfollow,.text,.outer)').append('<div id="select_list" style="margin-top:4px; float:left;>'
        + '<table cellspacing="1" cellpadding="2" border="0"><tbody><tr><td class="embedded">'
        + h1
        + '</td><td class="embedded">'
        + h2
        + '</td><td class="embedded">'
        + h3
        + '</td></tr></tbody></table></div>');

    const margin = $('.codebuttons').parents('tbody').eq(0).width() - $("#select_list").width() - 2.6;
    $("#select_list").css("margin-left", margin + "px");

    $('body').append(
        '<script type="text/javascript">\n\
function onEditorActionS(textAreaId, action, param) {\n\
    var textArea = document.querySelector(".bbcode");\n\
    var selStart = textArea.selectionStart;\n\
    var selEnd = textArea.selectionEnd;\n\
    var selectionText, url;\n\
    if (selStart === null || selEnd === null) {\n\
        selStart = selEnd = textArea.value.length; //选中区域右边界\n\
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
                var title = window.prompt("请输入上标");\n\
                if (title === null || title.length === 0) {\n\
                    break;\n\
                }\n\
                selectionText = textArea.value.substring(selStart, selEnd);\n\
                console.log(selectionText);\n\
                addTag(textArea, "rt", title, selectionText, false);\n\
                // break;\n\
            } else {\n\
                text = window.prompt("请输入正文");\n\
                if (text === null || text.length === 0) {\n\
                    break;\n\
                }\n\
                var title = window.prompt("请输入上标");\n\
                if (title === null || title.length === 0) {\n\
                    break;\n\
                }\n\
                addTag(textArea, "rt", title, text, false);\n\
            }\n\
            break;\n\
        }\n\
        case "EDITOR_QUOTE+": {\n\
            if (selStart !== selEnd) {\n\
                var title = window.prompt("请输入标题");\n\
                if (title === null || title.length === 0) {\n\
                    title = "";\n\
                }\n\
                selectionText = textArea.value.substring(selStart, selEnd);\n\
                // addTag(textArea, "quote", null, "", true);\n\
                addTag(textArea, "quote", title, selectionText, false);\n\
            } else {\n\
                text = window.prompt("请输入正文");\n\
                if (text === null || text.length === 0) {\n\
                    break;\n\
                }\n\
                var title = window.prompt("请输入标题");\n\
                if (title === null || title.length === 0) {\n\
                    title = "";\n\
                }\n\
                addTag(textArea, "quote", title, text, false);\n\
            }\n\
            break;\n\
        }\n\
        case "EDITOR_SPOILER+": {\n\
            if (selStart !== selEnd) {\n\
                var title = window.prompt("请输入标题");\n\
                if (title === null || title.length === 0) {\n\
                    addTag(textArea, "spoiler", null, "", true);\n\
                    break;\n\
                }\n\
                selectionText = textArea.value.substring(selStart, selEnd);\n\
                // addTag(textArea, "spoiler", null, "", true);\n\
                addTag(textArea, "spoiler", title, selectionText, false);\n\
            } else {\n\
                text = window.prompt("请输入正文");\n\
                if (text === null || text.length === 0) {\n\
                    break;\n\
                }\n\
                var title = window.prompt("请输入标题");\n\
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
            if (selStart !== selEnd) {\n\
                addTag(textArea, "spoiler", null, "", true);\n\
            } else {\n\
                text = window.prompt("请输入正文");\n\
                if (text === null || text.length === 0) {\n\
                    break;\n\
                }\n\
                // var title = window.prompt("请输入标题");\n\
                // if (title === null || title.length === 0) {\n\
                //     title = "";\n\
                // }\n\
                addTag(textArea, "spoiler", null, text, false);\n\
            }\n\
            break;\n\
        }\n\
        case "EDITOR_QUOTE": {\n\
            if (selStart !== selEnd) {\n\
                selectionText = textArea.value.substring(selStart, selEnd);\n\
                addTag(textArea, "quote", null, "", true);\n\
            } else {\n\
                text = window.prompt("请输入正文");\n\
                if (text === null || text.length === 0) {\n\
                    break;\n\
                }\n\
                // var title = window.prompt("请输入标题");\n\
                // if (title === null || title.length === 0) {\n\
                //     title = "";\n\
                // }\n\
                addTag(textArea, "quote", null, text, false);\n\
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
