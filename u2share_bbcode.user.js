// ==UserScript==
// @name         U2实时预览BBCODE
// @namespace    https://u2.dmhy.org/
// @version      0.0.1
// @description  实时预览BBCODE
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/upload.php*
// @icon         https://u2.dmhy.org/favicon.ico
// ==/UserScript==


/* 
无法显示的 Tag
    由U2自带上传工具上传的文件
    Flash 有关的 Tag <u2好像本来就不支持>
    我不知道的特殊操作
*/

/* 
待实现的功能
    多语言支持
*/

/* 
与U2娘显示不同的标签 (非标准操作)
    [spoiler="剧透是不"可能的！"]真的！[/spoiler]
        U2      => "剧透是不"可能的！"
        Script  => 剧透是不"可能的！
    http://u2.dmhy.or'g/upload.php || http://u2.dmhy.or"g/upload.php
        U2      => http://u2.dmhy.or'g/upload.php 视为 url
        Script  => http://u2.dmhy.or 视为url 'g/upload.php 视为 str
*/

/* 
[b]这是粗体。[/b]
[i]这是斜体。[/i]
[u]这是下划线。[/u]
[s]这是删除线。[/s]
你真是个[rt=biàn]绅[/rt][rt=tài]士[/rt]。
[color=blue]这是蓝色文字。[/color]
[color=#0000ff]这是蓝色文字。[/color]
[size=4]这是4号字的文字。[/size]
[font=SimHei]世界您好！[/font]
[url]http://u2.dmhy.org[/url]
[url=http://u2.dmhy.org]u2.dmhy.org[/url]
[img=http://u2.dmhy.org/pic/logo.png]
[img]http://u2.dmhy.org/pic/logo.png[/img]
[imglnk]http://u2.dmhy.org/pic/logo.png[/imglnk]
[quote]我爱U2分享園@動漫花園。[/quote]
[info]题材............: 动作, 科幻[/info]
[mediainfo]扫描模式 : 逐行[/mediainfo]
[quote="Azusa"]我爱U2分享園@動漫花園。[/quote]
[*]这是项目1
[*]这是项目2
[pre]这是预格式化文字。[/pre]
[code]这是代码文本。[/code]
[spoiler]我要剧透了！[/spoiler]
[spoiler="剧透是不可能的！"]真的！[/spoiler]
你正在访问[site]。
[site]的网址是[siteurl]。
*/


(async () => {
    'use strict';

    let currentTab = 0;

    $('.bbcode').parents("tr:eq(1)").after('<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">'
        + '预览</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2">'
        + '<div id="bbcode2" style="max-height: 350px; overflow-x:auto ;overflow-y: auto;"><div class="child">NULL</div></div></td></tr></tbody></table></td>');

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

})();


async function sleep(interval) {
    return new Promise(resolve => {
        setTimeout(resolve, interval);
    })
}


function bbcode2html(bbcodestr) {
    const br_reg = new RegExp("[\\r\\n]", "g");
    const f_reg = new RegExp("^\"?\"?$");

    bbcodestr = bbcodestr.replace(br_reg, function (s) { return '<br />' });

    var tempCode = new Array();
    var tempCodeCount = 0;

    function addTempCode(value) {
        tempCode[tempCodeCount] = value;
        returnstr = "<tempCode_" + tempCodeCount + ">";
        tempCodeCount++;
        return returnstr;
    }

    // code 标签
    const code_reg = new RegExp("\\[(code|mediainfo|info)\\](.+?)\\[\\/(\\1)\\]", "gis");
    bbcodestr = bbcodestr.replace(code_reg, function (s, x, y) {
        switch (x) {
            case "code":
                return addTempCode('<br /><div class="codetop">代码</div><div class="codemain">' + y + '</div><br />');
            case 'info':
                return addTempCode('<fieldset class="pre"><legend><b><span style="color: blue">发布信息</span></b></legend>'
                    + y + '</fieldset>');
            case 'mediainfo':
                return addTempCode('<fieldset class="pre"><legend><b><span style="color: red">媒体信息</span></b></legend>'
                    + y + '</fieldset>');
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
    })

    // 成对标签 带参
    const d_reg = new RegExp("\\[(rt|font)=([^\\]]+)\\](.*?)\\[/(\\1)\\]", "gis");
    while (d_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(d_reg, function (s, w, x, y, z) {
            switch (w) {
                case 'rt':
                    if (f_reg.test(x)) {
                        return s;
                    }
                    else {
                        return '<ruby>' + y + '<rp>(</rp><rt>' + x.replace(/^"?(.*?)"?$/, "$1") + '</rt><rp>)</rp></ruby>';
                    }
                case 'font':
                    if (f_reg.test(x)) {
                        return s;
                    }
                    else {
                        return '<span style="font-family: ' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</span>';
                    }
                default:
                    return s;
            }
        })
    }

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
    const color_reg = new RegExp("\\[color=([#0-9a-z]{1,15}|[a-z]+?)\\](.*?)\\[/color\\]", "gis");
    while (color_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(color_reg, function (s, x, y) {
            if (f_reg.test(x)) {
                return s;
            }
            else {
                return '<span style="color: ' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</span>';
            }
        })
    }

    // 文字大小
    const size_reg = new RegExp("\\[size=([1-7])\\](.*?)\\[/size\\]", "gis");
    while (size_reg.test(bbcodestr)) {
        bbcodestr = bbcodestr.replace(size_reg, function (s, x, y) {
            if (f_reg.test(x)) {
                return s;
            }
            else {
                return '<font size="' + x.replace(/^"?(.*?)"?$/, "$1") + '">' + y + '</font>';
            }
        })
    }

    // 图片
    const img_reg1 = new RegExp("\\[(?:img|imglnk)\\](https?://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])\\[\/(?:img|imglnk)\\]", "gi");
    bbcodestr = bbcodestr.replace(img_reg1, function (s, x) {
        return addTempCode('<img alt="image" src="' + x + '" style="height: auto; width: auto; max-width: 100%;">');
    });
    const img_reg2 = new RegExp("\\[img=(https?://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])\\]", "gi");
    bbcodestr = bbcodestr.replace(img_reg2, function (s, x) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '"><img alt="image" src="'
            + x + '" style="height: auto; width: auto; max-width: 100%;"></a>');
    });

    // 超链接
    const url_reg1 = new RegExp("\\[url=((?:https?|ftp|gopher|news|telnet|mms|rtsp)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])\\](.+?)\\[/url\\]", "gis");
    bbcodestr = bbcodestr.replace(url_reg1, function (s, x, y) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + y + '</a>');
    });
    const url_reg2 = new RegExp("\\[url\\]((?:https?|ftp|gopher|news|telnet|mms|rtsp)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|])\\[/url\\]", "gis");
    bbcodestr = bbcodestr.replace(url_reg2, function (s, x) {
        return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>')
    });
    const url_reg3 = new RegExp("(?:https?|ftp|gopher|news|telnet|mms|rtsp)://[-A-Za-z0-9+&@#/%?=~_|!:,.;]+[-A-Za-z0-9+&@#/%=~_|]", "gi");
    bbcodestr = bbcodestr.replace(url_reg3, function (s, x) {
        return '<a class="faqlink" rel="nofollow noopener noreferer" href="' + s + '">' + s + '</a>';
    });

    // 引用
    const quote_reg1 = new RegExp("\\[quote\\](.*?)\\[/quote\\]", "gsi");
    bbcodestr = bbcodestr.replace(quote_reg1, function (s, x) {
        return '<fieldset><legend>引用</legend>' + x + '</fieldset>';
    });
    const quote_reg2 = new RegExp("\\[quote=([^\\]]+)\\](.*?)\\[/quote\\]", "gsi");
    bbcodestr = bbcodestr.replace(quote_reg2, function (s, x, y) {
        if (f_reg.test(x)) {
            return '<fieldset><legend>引用</legend>' + y + '</fieldset>';
        }
        else {
            return '<fieldset><legend>引用: ' + x.replace(/^"(.*?)"?$/, "$1") + '</legend>' + y + '</fieldset>';
        }
    });

    // spoiler
    const spoiler_reg1 = new RegExp("\\[spoiler\\](.*?)\\[/spoiler\\]", "gsi");
    const spoiler_reg2 = new RegExp("\\[spoiler=([^\\]]+)\\](.*?)\\[/spoiler\\]", "gsi");
    bbcodestr = bbcodestr.replace(spoiler_reg1, function (s, x) {
        return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
            + '警告！下列文字很可能泄露剧情，请谨慎选择是否观看。&nbsp;&nbsp;<button class="spoiler-button-show">'
            + '我就是手贱</button><button class="spoiler-button-hide" style="display: none;">我真是手贱</button>'
            + '</td></tr><tr><td><span class="spoiler-content">' + x + '</span></td></tr></tbody></table>';
    });
    bbcodestr = bbcodestr.replace(spoiler_reg2, function (s, x, y) {
        if (f_reg.test(x)) {
            return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                + '警告！下列文字很可能泄露剧情，请谨慎选择是否观看。&nbsp;&nbsp;<button class="spoiler-button-show">'
                + '我就是手贱</button><button class="spoiler-button-hide" style="display: none;">我真是手贱</button>'
                + '</td></tr><tr><td><span class="spoiler-content">' + y + '</span></td></tr></tbody></table>';
        }
        else {
            return '<table class="spoiler" width="100%"><tbody><tr><td class="colhead">'
                + x.replace(/^"(.*?)"?$/, "$1") + '&nbsp;&nbsp;<button class="spoiler-button-show">我就是手贱</button>'
                + '<button class="spoiler-button-hide" style="display: none;">我真是手贱</button>'
                + '</td></tr><tr><td><span class="spoiler-content">' + y + '</span></td></tr></tbody></table>';
        }
    });

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
        console.log(i + " : " + tempCode[i]);
        bbcodestr = bbcodestr.replace("<tempCode_" + i + ">", tempCode[i]);
    }

    // console.log(bbcodestr);
    // console.log(tempCode);

    return bbcodestr;
}
