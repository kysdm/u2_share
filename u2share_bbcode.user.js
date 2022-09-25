// ==UserScript==
// @name         U2实时预览BBCODE
// @namespace    https://u2.dmhy.org/
// @version      0.6.6
// @description  实时预览BBCODE
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/*
// @exclude      *://u2.dmhy.org/shoutbox.php*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @license      Apache-2.0
// ==/UserScript==

/*
本脚本基于 Bamboo Green 界面风格进行修改
为什么会有近似功能的函数呢，问就是历史原因
等不能跑的时候再动祖传代码
/*

/*
GreasyFork 地址
    https://greasyfork.org/zh-CN/scripts/426268
*/

/*
更新日志
    https://github.com/kysdm/u2_share/commits/main/u2share_bbcode.user.js
*/

/*
无法显示的 Tag
    Flash 有关的 Tag <u2好像本来就不支持>
    我不知道的特殊操作
*/

/*
与U2娘显示不同的标签 (非标准操作)
    U2允许未封闭标签，此脚本不接受此操作。
*/

'use strict';

// 声明全局变量
// https://api.jquery.com/jQuery.noConflict/
const jq = jQuery.noConflict();
// 网站语言
const lang = new lang_init(jq('#locale_selection').val());;
// CSS
jq('body').append(`<style type="text/css">td.smile-icon { padding: 3px !important; }</style>`);
// JS
jq('body').append(`<script type="text/javascript"> function createTag(name,attribute,content){var components=[];components.push('[');components.push(name);if(attribute!==null){components.push('=');components.push(attribute)}components.push(']');if(content!==null){components.push(content);components.push('[/');components.push(name);components.push(']')}return components.join('')};function replaceText(str,start,end,replacement){return str.substring(0,start)+replacement+str.substring(end)};function addTag(textArea,name,attribute,content,surround){var selStart=textArea.selectionStart;var selEnd=textArea.selectionEnd;if(selStart===null||selEnd===null){selStart=selEnd=textArea.value.length}var selTarget=selStart+name.length+2+(attribute?attribute.length+1:0);if(selStart===selEnd){textArea.value=replaceText(textArea.value,selStart,selEnd,createTag(name,attribute,content))}else{var replacement=null;if(surround){replacement=createTag(name,attribute,textArea.value.substring(selStart,selEnd))}else{replacement=createTag(name,attribute,content)}textArea.value=replaceText(textArea.value,selStart,selEnd,replacement)}textArea.setSelectionRange(selTarget,selTarget)};</script>`);

// 现存BBCODE元素
(async () => {
    if (jq('.bbcode').length === 0) return;  // 判断页面是否存在 bbcode 输入框
    new init();
    const url = location.href.match(/u2\.dmhy\.org\/(upload|forums|comment|contactstaff|sendmessage|edit)\.php/i);
    if (url === null) return;
    await syncScroll('#bbcodejs_tbody', url[1], '.bbcode', '#bbcode2');
    if (url[1] === 'upload') { await autoSaveUpload(); } else { await autoSaveMessage('#bbcodejs_tbody', '.bbcode', '#qr', url[1], '#compose'); }

    jq('.bbcode').parents("tr:eq(1)").after('<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">' + lang['preview']
        + '</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2">'
        + '<div id="bbcode2" style="min-height: 25px; max-height: ' + (jq('.bbcode').height() + 30) + 'px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;">'
        + '<div class="child">' + await bbcode2html(jq('.bbcode').val()) + '</div></div></td></tr></tbody></table></td>');

    syncWindowChange('.bbcode', '#bbcode2');

    jq('.bbcode').bind('input propertychange', async function updateValue() {
        let html = await bbcode2html(jq(this).val());
        jq('#bbcode2').children('.child').html(html);
    });

    jq('.codebuttons').click(async function updateValue() {
        let html = await bbcode2html(jq('.bbcode').val());
        jq('#bbcode2').children('.child').html(html);
    });

    jq('#compose').find("td.embedded.smile-icon a").each(function () {
        jq(this).attr('href', jq(this).attr('href').replace(/javascript: SmileIT\('\[(.+?)\]','[^']+?','[^']+?'\)/gis, function (s, x) { return `javascript:void('${x}');` }));
    })
        .click(async function () {
            onEditorActionBox(jq(this).attr('href'), '.bbcode');
            jq('#bbcode2').children('.child').html(await bbcode2html(jq('.bbcode').val()));
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
            var type_id = jq('#browsecat').val();
            if (type_id === '0') {
                // console.log('请选择分类...');
                main_title = '<font color="red"><b>' + lang['select_type'] + '</b></font>';
            } else if (['9', '411', '413', '12', '13', '14', '15', '16', '17', '410', '412'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' anime');
                main_title = '<b>'
                    + add_brackets(jq('#anime_chinese-input').val())
                    + add_brackets(jq('#anime_english-input').val())
                    + add_brackets(jq('#anime_original-input').val())
                    + add_brackets(jq('#anime_source-input').val())
                    + add_brackets(jq('#anime_resolution-input').val())
                    + add_brackets(jq('#anime_episode-input').val())
                    + add_brackets(jq('#anime_container-input').val())
                    + add_brackets(jq('#anime_extra-input').val())
                    + '</b>';
            } else if (['21', '22', '23'].indexOf(type_id) !== -1) {
                // console.log('分类ID是： ' + type_id + ' manga');
                main_title = '<b>'
                    + add_brackets(jq('#manga_title-input').val())
                    + add_brackets(jq('#manga_author-input').val())
                    + add_brackets(jq('#manga_volume-input').val())
                    + add_brackets(jq('#manga_ended').find("select").val())
                    + add_brackets(jq('#manga_publisher-input').val())
                    + add_brackets(jq('#manga_remark-input').val())
                    + '</b>';
            } else if (type_id === '30') {
                // console.log('分类ID是： ' + type_id + ' music');
                var prefix_1 = jq('#music_prefix').find("select").val();
                var prefix_2 = jq('#music_collection').find("select").val();
                if (['EAC', 'XLD'].indexOf(prefix_1) !== -1) { var music_quality = false; }
                else if (['Hi-Res', 'Web'].indexOf(prefix_1) !== -1) { var music_quality = true; };
                switch (prefix_2) {
                    case "0": // 单张
                        main_title = '<b>'
                            + add_brackets(prefix_1)
                            + add_brackets(jq('#music_date-input').val())
                            + add_brackets(jq('#music_category-input').val())
                            + add_brackets(jq('#music_artist-input').val())
                            + add_brackets(jq('#music_title-input').val())
                            + add_brackets(jq('#music_serial_number-input').val())
                            + add_brackets((() => { if (music_quality) { return jq('#music_quality-input').val(); } else { return ''; } })())
                            + add_brackets(jq('#music_format-input').val())
                            + '</b>';
                        break;
                    case "1": // 合集
                        main_title = '<b>'
                            + add_brackets(prefix_1)
                            + add_brackets('合集')
                            + add_brackets(jq('#music_category-input').val())
                            + add_brackets(jq('#music_title-input').val())
                            + add_brackets(jq('#music_quantity-input').val())
                            + add_brackets((() => { if (music_quality) { return jq('#music_quality-input').val(); } else { return ''; } })())
                            + '</b>';
                        break;
                }
            } else if (type_id === '40') {
                // console.log('分类ID是： ' + type_id + ' other');
                main_title = '<b>' + jq('#other_title-input').val() + '</b>';
            } else {
                // console.log('分类ID是： ' + type_id);
            }
            jq('#checktitle').html(check_title(main_title));
        }

        jq("#browsecat").change(() => { new add_main_title; });
        jq(".torrent-info-input").bind('input propertychange', () => { new add_main_title; });
        jq('#other_title').after('<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['main_title'] + '</td>'
            + '<td id="checktitle" class="rowfollow" valign="top" align="left" valign="middle">' + main_title + '</td></tr>'
        );
    };


    function init() {
        const type = 'original';
        let h1 = jq('.codebuttons').eq(6).parent().html();
        let h2 = jq('.codebuttons').eq(7).parent().html();
        let h3 = jq('.codebuttons').eq(8).parent().html();
        jq('.codebuttons').eq(8).parent().remove();
        jq('.codebuttons').eq(7).parent().remove();
        jq('.codebuttons').eq(6).parent().remove();
        jq('input[value="URL"]').parent().remove();
        jq('input[value="IMG"]').parent()
            .before(`<td class="embedded"><input class="codebuttons" style="text-decoration: line-through; margin-right:3px" type="button" value="S" name="${type}_bbcode_button"></td>`)
            .before(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="URL*" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="CODE" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="PRE" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="LIST" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="RT*" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="IMGINK" name="${type}_bbcode_button"></td>`);
        jq('input[value="QUOTE"]').parent()
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER*" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="MEDIAINFO" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="INFO" name="${type}_bbcode_button"></td>`)
            .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="QUOTE*" name="${type}_bbcode_button"></td>`);
        jq('.codebuttons').parents('table').eq(0).after('<div id="bbcodejs_tbody" style="position:relative; margin-top: 4px"></div>');
        jq('#bbcodejs_tbody').append('<div id="bbcodejs_select" style="position: absolute; margin-top:2px; margin-bottom:2px; float: left;">' + h1 + h2 + h3 + '</div>');
        const margin = jq('.codebuttons').parents('tbody').eq(0).width() - jq("#bbcodejs_select").width() - 2.6;
        jq("#bbcodejs_select").css("margin-left", margin + "px");
        jq(`[name="${type}_bbcode_button"]`).click(function () { onEditorActionBox(this.value, `.bbcode`); });
    }
})();


async function sleep(interval) {
    return new Promise(resolve => {
        setTimeout(resolve, interval);
    })
};

async function bbcode2html(bbcodestr) {
    var tempCode = new Array();
    var tempCodeCount = 0;

    function addTempCode(value) {
        tempCode[tempCodeCount] = value;
        let returnstr = "<tempCode_" + tempCodeCount + ">";
        tempCodeCount++;
        return returnstr;
    };

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
        };
    });

    bbcodestr = bbcodestr.replace(/\r\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\n/g, () => { return '<br>' });
    bbcodestr = bbcodestr.replace(/\r/g, () => { return '<br>' });

    let br_end = '';  // 对结尾的换行符进行计数
    if (br = bbcodestr.match(/(?:<br>)+$/)) {
        br_end = br[0];
        const regex = new RegExp(`${br_end}$`, "");
        bbcodestr = bbcodestr.replace(regex, '');
    };

    const addLostTags = (value, r_tag_start, r_tag_end) => {
        let state = false;
        // let lost_tags = new Array();
        // let tag_end_list = new Array();  // 创建存放标签结尾

        let r_tag_start_exec = r_tag_start.exec(value);
        let index_start = r_tag_start_exec ? (r_tag_start_exec.index + r_tag_start_exec[0].length) : 0;
        let r_tag_end_exec = r_tag_end.exec(value.slice(index_start));
        // if (r_tag_end_exec) tag_end_list = r_tag_end_exec.groups.tag;

        if (r_tag_start_exec && !r_tag_end_exec) {
            let tag_start_val = r_tag_start_exec.groups.tag;;
            console.log('检测到丢失的标签 => ' + `[/${tag_start_val}]`);
            // value = value + `[/${tag_start_val}]`;
            state = true;
        };

        // return { "value": value, "state": state };
        return { "state": state };
    };

    const url = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[url=.(?:&quot;){0,2}\]/i, function (s) { return '[url]'; }); }
        if (val) {
            const lost = addLostTags(textarea, /\[(?<tag>url)=[^\[]*?/i, /\[\/(?<tag>url)\]/i);
            if (lost.state) { return textarea.replace(/\[url=[^\[]*?/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[url=(.+?)\](.*?)\[\/url\]/i, function (all, url, text) {
                if (url.match(/\s|\[/))    return addTempCode(all);
                let tmp = url.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!tmp.match(/&quot;/)) url = tmp;
                else { if (url.match(/&quot;/g).length === 1) url = url.replace('&quot;', ''); }
                return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + url.replace(/&quot;/g, '"') + '">' + text + '</a>');
            });
        } else {
            const lost = addLostTags(textarea, /\[(?<tag>url)\]/i, /\[\/(?<tag>url)\]/i);
            if (lost.state) { return textarea.replace(/\[url\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[url\](.+?)\[\/url\]/i, function (s, x) {
                if (x.match(/\s|\[/i)) return addTempCode(s);
                return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>');
            });
        };
    };

    // 注释
    const rt = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[rt=.*?\]/i, function (s) { return addTempCode(s); }); }
        else if (!val) { return textarea.replace('[rt]', function (s) { return addTempCode(s); }) }
        else {
            const lost = addLostTags(textarea, /\[(?<tag>rt)=[^\[]*?/i, /\[\/(?<tag>rt)\]/i);
            if (lost.state) { return textarea.replace(/\[rt=[^\[]*?/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[rt=(.+?)\](.*?)\[\/rt\]/i, function (all, tval, text) {
                if (tval.match(/\[/i))    return addTempCode(all);
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!tmp.match(/&quot;/)) tval = tmp;
                return addTempCode('<ruby>' + text + '<rp>(</rp><rt>' + tval + '</rt><rp>)</rp></ruby>');
            });
        };
    };

    // 字体
    const font = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[font=.*?]/i, function (s) { return addTempCode(s); }); }
        else if (!val) { return textarea.replace('[font]', function (s) { return addTempCode(s); }) }
        else {
            const lost = addLostTags(textarea, /\[(?<tag>font)=[^\[]*?\]/i, /\[\/(?<tag>font)\]/i);
            if (lost.state) { return textarea.replace(/\[font=[^\[]*?/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[font=(.+?)\](.*?)\[\/font\]/i, function (all, tval, text) {
                if (tval.match(/\[/i)) return '[' + addTempCode(`font=`) + `${tval}]${text}`;
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!/&quot;/.test(tmp)) { tval = tmp; }
                else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                return '<span style="font-family: ' + tval + '">' + text + '</span>';
            });
        };
    };

    // 颜色
    const color = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[color=.*?\]/i, function (s) { return addTempCode(s); }); }
        else if (!val) { return textarea.replace('[color]', function (s) { return addTempCode(s); }) }
        else {
            const lost = addLostTags(textarea, /\[(?<tag>color)=[^\[]*?\]/i, /\[\/(?<tag>color)\]/i);
            if (lost.state) { return textarea.replace(/\[color=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[color=(.+?)\](.*?)\[\/color\]/i, function (all, tval, text) {
                if (tval.match(/\[/i))   return addTempCode(all);;
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!/&quot;/.test(tmp)) { tval = tmp; }
                else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                return '<span style="color: ' + tval + '">' + text + '</span>';
            });
        };
    };

    // 文字大小
    const size = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[size=.*?\]/i, function (s) { return addTempCode(s); }); }
        else if (!val) { return textarea.replace('[size]', function (s) { return addTempCode(s); }) }
        else {
            const lost = addLostTags(textarea, /\[(?<tag>size)=[^\[]*?\]/i, /\[\/(?<tag>size)\]/i);
            if (lost.state) { return textarea.replace(/\[size=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[size=(.+?)\](.*?)\[\/size\]/i, function (all, tval, text) {
                // size只允许1-9的数字
                if (!tval.match(/^(?:&quot;)?[0-9](?:&quot;)?$/))    return addTempCode(all);
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!/&quot;/.test(tmp)) { tval = tmp; }
                else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                return '<font size="' + tval + '">' + text + '</font>';
            });
        };
    };

    const pre = (val, textarea) => {
        if (val) { return textarea.replace(/\[pre=(.*?)\]/i, function (s, v) { return addTempCode('[pre=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>pre)\]/i, /\[\/(?<tag>pre)\]/i);
        if (lost.state) { return textarea.replace(/\[pre\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[pre\](.*?)\[\/pre\]/i, function (all, text) { return '<pre>' + text + '</pre>'; });
    };

    const b = (val, textarea) => {
        if (val) { return textarea.replace(/\[b=(.*?)\]/i, function (s, v) { return addTempCode('[b=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>b)\]/i, /\[\/(?<tag>b)\]/i);
        if (lost.state) { return textarea.replace(/\[b\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[b\](.*?)\[\/b\]/i, function (all, text) { return '<b>' + text + '</b>'; });
    };

    const i = (val, textarea) => {
        if (val) { return textarea.replace(/\[i=(.*?)\]/i, function (s, v) { return addTempCode('[i=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>i)\]/i, /\[\/(?<tag>i)\]/i);
        if (lost.state) { return textarea.replace(/\[i\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[i\](.*?)\[\/i\]/i, function (all, text) { return '<em>' + text + '</em>'; });
    };

    const u = (val, textarea) => {
        if (val) { return textarea.replace(/\[u=(.*?)\]/i, function (s, v) { return addTempCode('[u=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>u)\]/i, /\[\/(?<tag>u)\]/i);
        if (lost.state) { return textarea.replace(/\[u\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[u\](.*?)\[\/u\]/i, function (all, text) { return '<u>' + text + '</u>'; });
    };

    const s = (val, textarea) => {
        if (val) { return textarea.replace(/\[s=(.*?)\]/i, function (s, v) { return addTempCode('[s=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>s)\]/i, /\[\/(?<tag>s)\]/i);
        if (lost.state) { return textarea.replace(/\[s\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[s\](.*?)\[\/s\]/i, function (all, text) { return '<s>' + text + '</s>'; });
    };

    const img = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[img=.*?\]/i, function (s) { return addTempCode(s); }); }
        else if (val) {
            return textarea.replace(/\[img=(.*?)\]/i, function (all, url) {
                // [img=http://u2.dmhy.org/pic/logo.png]
                if (/^((?!"|'|>|<|;|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                    // url 以 .png 之类结尾
                    return addTempCode('<img alt="image" src="' + url + '" style="height: auto; width: auto; max-width: 100%;">');
                } else {
                    return addTempCode(all);
                };
            });
        } else {
            // [img]http://u2.dmhy.org/pic/logo.png[/img]
            const lost = addLostTags(textarea, /\[(?<tag>img)\]/i, /\[\/(?<tag>img)\]/i);
            if (lost.state) { return textarea.replace(/\[img\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[img\](.*?)\[\/img\]/i, function (all, url) {
                if (/^((?!"|'|>|<|;|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                    // url 以 .png 之类结尾
                    return addTempCode('<img alt="image" src="' + url + '" style="height: auto; width: auto; max-width: 100%;">');
                } else {
                    return addTempCode(all);
                };
            });
        };
    };

    const imglnk = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[imglnk=.*?\]/i, function (s) { return addTempCode(s); }); }
        else if (val) {
            return textarea.replace(/\[imglnk=(.*?)\]/i, function (all, url) { return addTempCode('[imglnk=') + url + ']'; });
        } else {
            // [img]http://u2.dmhy.org/pic/logo.png[/img]
            const lost = addLostTags(textarea, /\[(?<tag>imglnk)\]/i, /\[\/(?<tag>imglnk)\]/i);
            if (lost.state) { return textarea.replace(/\[imglnk\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[imglnk\](.*?)\[\/imglnk\]/i, function (all, url) {
                if (/^((?!"|'|>|<|;|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                    // url 以 .png 之类结尾
                    return addTempCode(`<a class="faqlink" rel="nofollow noopener noreferer" href="' + y + '"><img alt="image" src="${url}" style="height: auto; width: auto; max-width: 100%;"></a>`);
                } else {
                    return addTempCode(all);
                };
            });
        };
    };

    const code = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[code=(?:&quot;){0,2}/, '[code]'); };
        if (val) { textarea = textarea.replace(/\[code=(.*?)\]/i, function (s, v) { return addTempCode('[code=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>code)\]/i, /\[\/(?<tag>code)\]/i);
        if (lost.state) { return textarea.replace(/\[code\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[code\](.*?)\[\/code\]/i, function (all, text) {
            return addTempCode(`<br><div class="codetop">${lang['code']}</div><div class="codemain">${text.replace(/(<br>)*$/, '')}</div><br />`);
        });
    };

    const info = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[info=(?:&quot;){0,2}/, '[info]'); };
        if (val) { textarea = textarea.replace(/\[info=(.*?)\]/i, function (s, v) { return addTempCode('[info=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>info)\]/i, /\[\/(?<tag>info)\]/i);
        if (lost.state) { return textarea.replace(/\[info\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[info\](.*?)\[\/info\]/i, function (all, text) {
            return addTempCode(`<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: blue">${lang['info']}</span></b></legend>${text.replace(/(<br>)*$/, '')}</fieldset>`);
        });
    };

    const mediainfo = (val, textarea) => {
        if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[mediainfo=(?:&quot;){0,2}/, '[mediainfo]'); };
        if (val) { textarea = textarea.replace(/\[mediainfo=(.*?)\]/i, function (s, v) { return addTempCode('[mediainfo=') + v + ']'; }); };
        const lost = addLostTags(textarea, /\[(?<tag>mediainfo)\]/i, /\[\/(?<tag>mediainfo)\]/i);
        if (lost.state) { return textarea.replace(/\[mediainfo\]/i, function (s) { return addTempCode(s); }); };
        return textarea.replace(/\[mediainfo\](.*?)\[\/mediainfo\]/i, function (all, text) {
            return addTempCode(`<fieldset class="codemain" style="background-color: transparent; word-break: break-all"><legend><b><span style="color: red">${lang['mediainfo']}</span></b></legend>${text.replace(/(<br>)*$/, '')}</fieldset>`);
        });
    };

    const quote = (val, textarea) => {
        if (!val) {
            // [quote]我爱U2分享園@動漫花園。[/quote]
            const lost = addLostTags(textarea, /\[(?<tag>quote)]/i, /\[\/(?<tag>quote)\]/i);
            if (lost.state) { return textarea.replace(/\[quote\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[quote\](.*?)\[\/quote\]/i, function (s, x) {
                return '<fieldset><legend>' + lang['quote'] + '</legend>' + x.replace(/(<br>)*$/, '') + '</fieldset>';
            });
        } else if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') {
            // [quote=""]我爱U2分享園@動漫花園。[/quote]
            const lost = addLostTags(textarea, /\[(?<tag>quote)=[^\[]*?\]/i, /\[\/(?<tag>quote)\]/i);
            if (lost.state) { return textarea.replace(/\[quote=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[quote=[^\[]*?\](.*?)\[\/quote\]/i, function (s, x) {
                return '<fieldset><legend>' + lang['quote'] + '</legend>' + x.replace(/(<br>)*$/, '') + '</fieldset>';
            });
        } else {
            // [quote="ABC"]我爱U2分享園@動漫花園。[/quote]
            const lost = addLostTags(textarea, /\[(?<tag>quote)=[^\[]*?\]/i, /\[\/(?<tag>quote)\]/i);
            if (lost.state) { return textarea.replace(/\[quote=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[quote=([^\[]*?)\](.*?)\[\/quote\]/i, function (all, tval, text) {
                if (tval.match(/\[/i)) return addTempCode(all);;
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!/&quot;/.test(tmp)) { tval = tmp; };
                return '<fieldset><legend>' + lang['quote'] + ': ' + tval + '</legend>' + text.replace(/(<br>)*$/, '') + '</fieldset>';
            });
        };
    };

    const spoiler = (val, textarea) => {
        if (!val) {
            // [spoiler]我要剧透了！[/spoiler]
            const lost = addLostTags(textarea, /\[(?<tag>spoiler)]/i, /\[\/(?<tag>spoiler)\]/i);
            if (lost.state) { return textarea.replace(/\[spoiler\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[spoiler\](.*?)\[\/spoiler\]/i, function (s, x) {
                return `<table class="spoiler" width="100%"><tbody><tr>`
                    + `<td class="colhead">${lang['spoiler']}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                    + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                    + `<tr><td><span class="spoiler-content" style="display: inline;">${x.replace(/(<br>)*$/, '')}</span></td></tr>`
                    + `</tbody></table>`;
            });
        }
        else if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') {
            // [spoiler=""]真的！[/spoiler]
            const lost = addLostTags(textarea, /\[(?<tag>spoiler)=.+?\]/i, /\[\/(?<tag>spoiler)\]/i);
            if (lost.state) { return textarea.replace(/\[spoiler=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[spoiler=.*?\](.*?)\[\/spoiler\]/i, function (s, x) {
                return `<table class="spoiler" width="100%"><tbody><tr>`
                    + `<td class="colhead">${lang['spoiler']}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                    + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                    + `<tr><td><span class="spoiler-content" style="display: inline;">${x.replace(/(<br>)*$/, '')}</span></td></tr>`
                    + `</tbody></table>`;
            });
        } else {
            // [spoiler="剧透是不可能的！"]真的！[/spoiler]
            const lost = addLostTags(textarea, /\[(?<tag>spoiler)=.+?\]/i, /\[\/(?<tag>spoiler)\]/i);
            if (lost.state) { return textarea.replace(/\[spoiler=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[spoiler=(.*?)\](.*?)\[\/spoiler\]/i, function (all, tval, text) {
                if (tval.match(/\[/i))    return addTempCode(all);;
                let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                if (!/&quot;/.test(tmp)) tval = tmp;
                return `<table class="spoiler" width="100%"><tbody><tr>`
                    + `<td class="colhead">${tval}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                    + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                    + `<tr><td><span class="spoiler-content" style="display: inline;">${text.replace(/(<br>)*$/, '')}</span></td></tr>`
                    + `</tbody></table>`;
            });
        };
    };

    const localConvert = (textarea) => {
        let convert_count = 0;
        while (bbcode_tag = /\[(?<tag>b|i|u|s|color|size|font|rt|mediainfo|info|code|url|img|imglnk|quote|pre|spoiler)(?<val>=[^\[]*?)?\]/gi.exec(textarea)) {
            let tag = bbcode_tag.groups.tag;
            let val = bbcode_tag.groups.val;
            // console.log(`当前标签：` + tag);
            switch (tag) {
                case 'b':
                    textarea = b(val, textarea); break;
                case 'i':
                    textarea = i(val, textarea); break;
                case 'u':
                    textarea = u(val, textarea); break;
                case 's':
                    textarea = s(val, textarea); break;
                case 'color':
                    textarea = color(val, textarea); break;
                case 'size':
                    textarea = size(val, textarea); break;
                case 'font':
                    textarea = font(val, textarea); break;
                case 'rt':
                    textarea = rt(val, textarea); break;
                case 'mediainfo':
                    textarea = mediainfo(val, textarea); break;
                case 'info':
                    textarea = info(val, textarea); break;
                case 'code':
                    textarea = code(val, textarea); break;
                case 'url':
                    textarea = url(val, textarea); break;
                case 'img':
                    textarea = img(val, textarea); break;
                case 'imglnk':
                    textarea = imglnk(val, textarea); break;
                case 'quote':
                    textarea = quote(val, textarea); break;
                case 'pre':
                    textarea = pre(val, textarea); break;
                case 'spoiler':
                    textarea = spoiler(val, textarea); break;
                default:
                    break;;
            };
            if (++convert_count > 5000) break;
            // console.log('发生次数: ' + convert_count);
        };
        return textarea;
    };

    bbcodestr = localConvert(bbcodestr);

    // 没有bbcode包裹的超链接
    bbcodestr = bbcodestr.replace(/((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)/gi, function (s, x) {
        return '<a class="faqlink" rel="nofollow noopener noreferer" href="' + s + '">' + s + '</a>';
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
        };
    });

    // 表情
    const em_reg = new RegExp("\\[(em[1-9][0-9]*)\\]", "gi");
    bbcodestr = bbcodestr.replace(em_reg, function (s, x) {
        switch (x) {
            case (x.match(/^em[1-9][0-9]*/i) || {}).input:
                return '<img src="pic/smilies/' + x.replace("em", "") + '.gif" alt="[' + x + ']">';
            default:
                return s;
        };
    });

    // 附件
    let db = localforage.createInstance({ name: "attachmap" });
    bbcodestr = await replaceAsync(bbcodestr, /\[attach\](?<hash>\w{32})\[\/attach\]/gi, async (...args) => {
        const { hash } = args.slice(-1)[0];
        return await db.getItem(hash).then(async (value) => {
            if (value !== null && value.attach_id) {
                console.log('数据已存在');
                if (value.attach_type === 'img') {
                    if (Number.isFinite(value.attach_thumb)) {
                        if (value.attach_thumb === 0) {
                            console.log('没有触发缩图');
                            return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}" onclick="Previewurl('${value.attach_url}')">`
                        } else if (value.attach_thumb === 1) {
                            console.log('触发缩图');
                            return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}.thumb.jpg" onclick="Previewurl('${value.attach_url}')">`
                        };
                    };
                    // 正常情况是不会到这一步的，就不判断缩图状态了
                    return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}" onclick="Previewurl('${value.attach_url}')">`
                } else if (value.attach_type === 'other') {
                    return '<div class="attach">'
                        + `<img alt="other" src="pic/attachicons/common.gif">&nbsp;&nbsp;`
                        + `<a href="${value.attach_url}" target="_blank" id="attach${value.attach_id}">${value.attach_name}</a>`
                        + '&nbsp;&nbsp;'
                        + `<span class="size">(${value.attach_size})</span>`
                        + '</div>'
                } else if (value.attach_type === 'invalid') {
                    // 会不会发生碰撞呢 xd
                    return `<div style="text-decoration: line-through; font-size: 7pt">附件 ${args[1]} 无效。</div>`;
                };
            } else {
                console.log('数据不存在');
                return await new Promise((resolve, reject) => {
                    jq.ajax({
                        type: 'post',
                        url: 'https://u2.dmhy.org/preview.php',
                        contentType: "application/x-www-form-urlencoded",
                        data: ({ "body": `[attach]${hash}[/attach]` }),
                        success: async function (d) {
                            // console.log('成功');
                            let htmlobj = jq.parseHTML(d);
                            let span = jq(htmlobj).find('span');
                            let attach_normal = jq(span).children('bdo').children('div.attach'); // 普通附件
                            let attach_image = jq(span).children('bdo').children('img'); // 图片附件
                            if (attach_normal.length !== 0 && attach_image.length === 0) {
                                // console.log('普通附件');
                                // console.log(attach_normal);
                                let attach_info_obj = /(?<time>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i.exec(jq(attach_normal).children('a').attr('onmouseover'));
                                const attach = {
                                    "attach_id": jq(attach_normal).children('a').attr('id').replace('attach', ''),
                                    "attach_type": 'other',
                                    "attach_url": jq(attach_normal).children('a').attr('href'),
                                    "attach_name": jq(attach_normal).children('a').text(),
                                    "attach_size": jq(attach_normal).children('span.size').text().slice(1, -1),
                                    "attach_time": attach_info_obj ? attach_info_obj.groups.time : ''
                                };
                                // 写入数据库
                                await db.setItem(hash, attach);
                                resolve('<div class="attach">'
                                    + `<img alt="other" src="pic/attachicons/common.gif">&nbsp;&nbsp;`
                                    + `<a href="${attach.attach_url}" target="_blank" id="attach${attach.attach_id}">${attach.attach_name}</a>`
                                    + '&nbsp;&nbsp;'
                                    + `<span class="size">(${attach.attach_size})</span>`
                                    + '</div>');
                            }
                            else if (attach_normal.length === 0 && attach_image.length !== 0) {
                                // console.log('图片附件');
                                // 附件唯一标识符
                                let attach_url_obj = /^Previewurl\(['"](?<url>[^'"]+)['"]\)/i.exec(jq(attach_image).attr('onclick'));
                                let attach_info_obj = /(?<size>\d{1,4}\.\d{1,3}\s?[TGMK]iB).*(?<time>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i.exec(jq(attach_image).attr('onmouseover'));
                                let attach = {
                                    "attach_id": jq(attach_image).attr('id').replace('attach', ''),
                                    "attach_type": 'img',
                                    "attach_url": attach_url_obj ? attach_url_obj.groups.url : '',
                                    "attach_name": jq(attach_image).attr('alt'),
                                    "attach_size": attach_info_obj ? attach_info_obj.groups.size : '',
                                    "attach_time": attach_info_obj ? attach_info_obj.groups.time : '',
                                    "attach_thumb": ''
                                };
                                // console.log('value.attach_thumb: ', value.attach_thumb);
                                if (value && Number.isFinite(value.attach_thumb)) {
                                    if (value.attach_thumb === 0) {
                                        console.log('没有触发缩图');
                                        attach.attach_thumb = 0;
                                        resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}" onclick="Previewurl('${attach.attach_url}')">`);
                                        await db.setItem(hash, attach);
                                        return;
                                    } else if (value.attach_thumb === 1) {
                                        console.log('触发缩图');
                                        attach.attach_thumb = 1;
                                        resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                        await db.setItem(hash, attach);
                                        return;
                                    };
                                };
                                // 没有通过标准方法上传的图片，没有记录attach_thumb值
                                // console.log(`${attach.attach_url}.thumb.jpg`);
                                let thumb = await urlCheck(`${attach.attach_url}.thumb.jpg`).catch(e => { });  // 检查缩图是否存在
                                if (typeof (thumb) === "undefined") {
                                    // 发生了错误 不写数据库
                                    resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                    return;
                                } else if (thumb === false) {
                                    // 不存在缩图
                                    console.log('url检测 不存在缩图');
                                    attach.attach_thumb = 0;
                                    resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}" onclick="Previewurl('${attach.attach_url}')">`);
                                    await db.setItem(hash, attach);
                                    return;
                                } else if (thumb === true) {
                                    // 存在缩图
                                    console.log('url检测 存在缩图');
                                    attach.attach_thumb = 1;
                                    resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                    await db.setItem(hash, attach);
                                    return;
                                };
                            }
                            else {
                                // Attachment for key 82505eca8a43a36bc9c60a7d9609a5df not found.
                                // 附件 82505eca8a43a36bc9c60a7d9609a5df 无效。
                                if (d.includes(hash)) {
                                    console.log('附件无效')
                                    const attach = {
                                        "attach_id": '',
                                        "attach_type": 'invalid',
                                        "attach_url": '',
                                        "attach_name": '',
                                        "attach_size": '',
                                        "attach_time": getDateString()
                                    };
                                    await db.setItem(hash, attach);
                                } else { console.log('附件未知错误: ' + d); };
                                resolve(`<div style="text-decoration: line-through; font-size: 7pt">附件 ${args[1]} 无效。</div>`);
                            };
                        },
                        error: function (d) {
                            console.log('附件获取失败');
                            reject(d.status);
                        },
                    });
                }).catch(() => { return args[0]; });
            };
        });
    });

    for (let i = 0, len = tempCode.length; i < len; i++) {
        bbcodestr = bbcodestr.replace("<tempCode_" + i + ">", tempCode[i]);
    };

    bbcodestr = bbcodestr + br_end;
    if (/(<br>)$/.test(bbcodestr)) { bbcodestr = bbcodestr + '<br>' };

    // console.log('BBCODE2HTML END');
    // console.log(bbcodestr);

    let htmlobj = jq.parseHTML('<div>' + bbcodestr + '</div>');

    jq(htmlobj).children('fieldset').children('fieldset').children('fieldset').children('fieldset').each(function () {
        jq(this).html(jq(this).html().replace(/(^<legend>[^<]*?<\/legend>)(.*)/i, function (s, x, y) {
            return x + '<table class="spoiler" width="100%"><tbody>'
                + '<tr><td class="colhead">' + lang['auto_fold'] + '&nbsp;&nbsp;'
                + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                + '<button class="spoiler-button-hide" style="">' + lang['spoiler_button_2'] + '</button>'
                + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                + y + '</span></td></tr></tbody></table>';
        }));
    });

    return jq(htmlobj).html();
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


async function autoSaveUpload() {
    let db = localforage.createInstance({ name: "bbcodejs" });
    let num_global = 10;
    let num = 10; // 设置自动保存时间间隔
    let type = 'upload';

    jq('#bbcodejs_tbody').append(`<span id="${type}_auto_save_on" style="margin-top:4px; display: none;">`
        + `<input id="${type}_switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">`
        + `<input id="${type}_clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">`
        + `<span id="${type}_auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>`
        + `<span id="${type}_auto_save_off" style="margin-top:4px; display: none;">`
        + `<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>`
    );

    // 为自动保存按钮绑定事件
    jq(`#${type}_auto_save_on`).click(async function (ev) {
        let button_id = jq(ev.target).attr('id');
        switch (button_id) {
            case `${type}_switch`:
                jq(this).hide(); // 隐藏按钮
                jq(`#${type}_auto_save_off`).fadeIn(200); // 渐入按钮
                clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
                await db.setItem(`${type}_autoSaveMessageSwitch`, false)
                console.log(`${type}-自动保存已关闭`);
                break;
            case `${type}_clean`:
                if (window.confirm("确定清空所有数据?")) {
                    await clean();
                    window.location.reload();
                };
                break;
        };
    });

    jq(`#${type}_auto_save_off`).click(async function () {
        jq(this).hide();
        jq(`#${type}_auto_save_on`).fadeIn(200);
        jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000));  // 设置setInterval函数
        await db.setItem(`${type}_autoSaveMessageSwitch`, true)
        console.log(`${type}-自动保存已开启`);
    });

    // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
    jq("#qr").click(async function () {
        await clean();
        console.log(`${type}-提交上传请求`);
    });

    async function clean() {
        clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
        await db.removeItem(`${type}_autoSaveMessageTime`);
        await db.removeItem(`${type}_autoSaveMessageBbcode`);
        await db.removeItem(`${type}_autoSaveMessageSmallDescr`);
        await db.removeItem(`${type}_autoSaveMessagePoster`);
        await db.removeItem(`${type}_autoSaveMessageAnidbUrl`);
        await db.removeItem(`${type}_autoSaveMessageInfo`);
        console.log(`${type}-已清空保存的记录`);
    }

    // 检测上次自动保存开关设定
    db.getItem(`${type}_autoSaveMessageSwitch`).then(async (value) => {
        if (value) {
            // 启用自动保存
            jq(`#${type}_auto_save_on`).show();
            jq(`#${type}_auto_save_off`).hide();
            jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000)); // 设置setInterval函数
            console.log(`${type}-自动保存已开启`);
            // 检查输入框内是否已经存在字符串
            let _input_bool = true
            jq("#compose input[id$='-input']").add('#browsecat').add('.bbcode').each(function () {
                let _input = jq(this).val()
                if (_input !== "" && _input !== "0") { _input_bool = false; return; } // 把input和select一起做判断了 总没人在标题里单独打个0吧
            });
            // 当输入框是空白时 还原上次备份内容
            if (_input_bool) {
                await db.getItem(`${type}_autoSaveMessageSmallDescr`).then((value) => { jq('[name="small_descr"]').val(value); })
                await db.getItem(`${type}_autoSaveMessagePoster`).then((value) => { jq('[name="poster"]').val(value); });
                await db.getItem(`${type}_autoSaveMessageAnidbUrl`).then((value) => { jq('[name="anidburl"]').val(value); });
                await db.getItem(`${type}_autoSaveMessageInfo`).then((value) => {
                    if (value === null) return;
                    jq('#browsecat').val(value['category']);
                    // jq('#browsecat').change(); // 手动触发列表更改事件 <使用两个jq后失效了 $('#browsecat').change(); 是有效的>
                    document.getElementById('browsecat').dispatchEvent(new Event('change')); // 手动触发列表更改事件
                    jq('#autocheck_placeholder').children().eq(0).prop("checked", value['auto_pass']);
                    jq('#autocheck_placeholder').children().eq(1).prop("checked", !value['auto_pass']);
                    for (var key in value) { if (/^(anime|manga|music|other)/.test(key)) { jq('#' + key + '-input').val(value[key]); }; };
                });
                await db.getItem(`${type}_autoSaveMessageBbcode`).then((value) => { jq('.bbcode').val(value); }) // 还原bbcode输入框内容
                jq('[class^="torrent-info-input"]').trigger("input"); // 手动触发标题更改
                jq('.bbcode').trigger("input"); // 手动触发bbcode更改
                console.log(`${type}-已还原备份`);
            };
        } else {
            // 关闭自动保存
            jq(`#${type}_auto_save_on`).hide();
            jq(`#${type}_auto_save_off`).show();
            await db.setItem(`${type}_autoSaveMessageSwitch`, false)
            console.log(`${type}-自动保存已关闭`);
        }
    }).catch(async function (err) {
        // 第一次运行时 <第一次运行时 数据库里什么都没有>
        // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
        jq(`#${type}_auto_save_on`).hide();
        jq(`#${type}_auto_save_off`).show();
        await db.setItem(`${type}_autoSaveMessageSwitch`, false)
        console.log(`${type}-第一次运行`);
        console.log(`${type}-${err}`);
    });

    async function autoSave() {
        // 由于安全问题 不允许为 input file 赋值
        num--
        // console.log(num);
        if (num <= 0) {
            jq(`#${type}_auto_save_text`).fadeIn(2000);
            await db.setItem(`${type}_autoSaveMessageTime`, getDateString()) // 记录保存数据的时间 string
            await db.setItem(`${type}_autoSaveMessageBbcode`, jq('.bbcode').val()) // 保存 bbcode 输入框内容
            // 倒是可以跑循环 直接拿到数据 就不用写这么大一堆了 (
            let upload_info = {
                "category": jq('#browsecat').val(),
                "auto_pass": jq('#autocheck_placeholder').children().eq(0).is(':checked'),
                "anime_chinese": jq('#anime_chinese-input').val(),
                "anime_english": jq('#anime_english-input').val(),
                "anime_original": jq('#anime_original-input').val(),
                "anime_source": jq('#anime_source-input').val(),
                "anime_resolution": jq('#anime_resolution-input').val(),
                "anime_episode": jq('#anime_episode-input').val(),
                "anime_container": jq('#anime_container-input').val(),
                "anime_extra": jq('#anime_extra-input').val(),
                "manga_title": jq('#manga_title-input').val(),
                "manga_author": jq('#manga_author-input').val(),
                "manga_volume": jq('#manga_volume-input').val(),
                "manga_ended": jq('#manga_ended-input').val(),
                "manga_publisher": jq('#manga_publisher-input').val(),
                "manga_remark": jq('#manga_remark-input').val(),
                "music_prefix": jq('#music_prefix-input').val(),
                "music_collection": jq('#music_collection-input').val(),
                "music_date": jq('#music_date-input').val(),
                "music_category": jq('#music_category-input').val(),
                "music_artist": jq('#music_artist-input').val(),
                "music_title": jq('#music_title-input').val(),
                "music_serial_number": jq('#music_serial_number-input').val(),
                "music_quantity": jq('#music_quantity-input').val(),
                "music_quality": jq('#music_quality-input').val(),
                "music_format": jq('#music_format-input').val(),
                "other_title": jq('#other_title-input').val()
            };
            await db.setItem(`${type}_autoSaveMessageInfo`, upload_info);
            await db.setItem(`${type}_autoSaveMessageSmallDescr`, jq('[name="small_descr"]').val());
            await db.setItem(`${type}_autoSaveMessagePoster`, jq('[name="poster"]').val());
            await db.setItem(`${type}_autoSaveMessageAnidbUrl`, jq('[name="anidburl"]').val());
            num = num_global + 4; // 重置倒计时
            jq(`#${type}_auto_save_text`).fadeOut(2000);
        };
    }
};


// 异步 replace
// https://stackoverflow.com/questions/33631041/javascript-async-await-in-replace
async function replaceAsync(str, regex, asyncFn) {
    const promises = [];
    str.replace(regex, (match, ...args) => {
        const promise = asyncFn(match, ...args);
        promises.push(promise);
    });
    const data = await Promise.all(promises);
    return str.replace(regex, () => data.shift());
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


// elementButton 插入按钮的位置
// elementBbcode BBCODE输入框
// elementPost 提交按钮
// type 识别符
// parent 父级元素
async function autoSaveMessage(elementButton, elementBbcode, elementPost, type, parent) {
    let db = localforage.createInstance({ name: "bbcodejs" });
    let num_global = 10; // 设置自动保存时间间隔
    let num = 10; // 设置自动保存时间间隔

    jq(elementButton).append(`<span id="${type}_auto_save_on" style="margin-top:4px; display: none;">`
        + `<input id="${type}_switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">`
        + `<input id="${type}_clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">`
        + `<span id="${type}_auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>`
        + `<span id="${type}_auto_save_off" style="margin-top:4px; display: none;">`
        + `<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>`
    );

    // 为自动保存按钮绑定事件
    jq(`#${type}_auto_save_on`).click(async function (ev) {  // 关闭自动保存
        let button_id = jq(ev.target).attr('id');
        switch (button_id) {
            case `${type}_switch`:
                jq(this).hide(); // 隐藏按钮
                jq(`#${type}_auto_save_off`).fadeIn(200); // 渐入按钮
                clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
                await db.setItem(`${type}_autoSaveMessageSwitch`, false)
                console.log(`${type}-自动保存已关闭`);
                break;
            case `${type}_clean`:
                if (window.confirm("确定清空所有数据?")) {
                    await clean();
                    window.location.reload();
                };
                break;
        };
    });

    jq(`#${type}_auto_save_off`).click(async function () {  // 开启自动保存
        jq(this).hide(); // 隐藏按钮
        jq(`#${type}_auto_save_on`).fadeIn(200);
        jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000));  // 设置setInterval函数
        await db.setItem(`${type}_autoSaveMessageSwitch`, true)
        console.log(`${type}-自动保存已开启`);
    });

    // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
    jq(elementPost).click(async function () {
        await clean();
        console.log(`${type}-提交上传请求`);
    });

    async function clean() {
        clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
        await db.removeItem(`${type}_autoSaveMessageTime`);
        await db.removeItem(`${type}_autoSaveMessageBbcode`);
        await db.removeItem(`${type}_autoSaveMessageSubject`);
        console.log(`${type}-已清空保存的记录`);
    };

    // 检测上次自动保存开关设定
    await db.getItem(`${type}_autoSaveMessageSwitch`).then(async (value) => {
        if (value) {
            // 启用自动保存
            jq(`#${type}_auto_save_on`).show();
            jq(`#${type}_auto_save_off`).hide();
            jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000)); // 设置setInterval函数
            console.log(`${type}-自动保存已开启`);
            // 检查输入框内是否已经存在字符串
            let _input_bool = true
            jq(`${parent} input[name='subject']`).add(elementBbcode).each(function () {
                let _input = jq(this).val()
                if (_input !== "") { _input_bool = false; return; }
            });
            // 当输入框是空白时 还原上次备份内容
            if (_input_bool) {
                await db.getItem(`${type}_autoSaveMessageSubject`).then((value) => { jq(`${parent} input[name='subject']`).val(value); });
                await await db.getItem(`${type}_autoSaveMessageBbcode`).then((value) => { jq(elementBbcode).val(value); }) // 还原bbcode输入框内容
                jq(elementBbcode).trigger("input"); // 手动触发bbcode更改
                console.log(`${type}-已还原备份`);
            };
        } else {
            // 关闭自动保存
            jq(`#${type}_auto_save_on`).hide();
            jq(`#${type}_auto_save_off`).show();
            await db.setItem(`${type}_autoSaveMessageSwitch`, false);
        };
    }).catch(async function (err) {
        // 第一次运行时 <第一次运行时 数据库里什么都没有>
        // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
        jq(`#${type}_auto_save_on`).hide();
        jq(`#${type}_auto_save_off`).show();
        await db.setItem(`${type}_autoSaveMessageSwitch`, false);
        console.log(`${type}-第一次运行`);
        console.log(`${type}-${err}`);
    });

    async function autoSave() {
        num--;
        // console.log(num);
        if (num <= 0) {
            jq(`#${type}_auto_save_text`).fadeIn(2000);
            await db.setItem(`${type}_autoSaveMessageTime`, getDateString()) // 记录保存数据的时间 string
            await db.setItem(`${type}_autoSaveMessageBbcode`, jq(elementBbcode).val()) // 保存 bbcode 输入框内容
            await db.setItem(`${type}_autoSaveMessageSubject`, jq(`${parent} input[name='subject']`).val());
            num = num_global + 4; // 重置倒计时
            jq(`#${type}_auto_save_text`).fadeOut(2000);
        };
    };
};


// 输入框与预览框同步滚动
// element 按钮插入位置
// type 标识符
// bbcode 输入框位置
// preview 预览位置
async function syncScroll(element, type, bbcode, preview) {
    let db = localforage.createInstance({ name: "bbcodejs" });  // 为以后统一数据库做准备
    // console.log('启用bbcodejs数据库');
    jq(element).append(`<input id="${type}_sync_scroll_on" class="codebuttons" style="font-size:11px; margin-right:3px;; display: none;" type="button" value="同步滚动已开启"></input>`
        + `<input id="${type}_sync_scroll_off" class="codebuttons" style="font-size: 11px; margin-right:3px; display: none;" type="button" value="同步滚动已关闭"></input>`
    );

    await db.getItem(`${type}_syncScrollSwitch`).then(async (value) => {
        if (value) {
            jq(`#${type}_sync_scroll_on`).show();
            new onScroll();
            console.log(`${type}-同步滚动已打开`);
        } else {
            jq(`#${type}_sync_scroll_off`).show();
            console.log(`${type}-同步滚动已关闭`);
        };
    });

    // 为按钮绑定事件
    jq(`#${type}_sync_scroll_off`).click(async function () {
        jq(this).hide();
        jq(`#${type}_sync_scroll_on`).fadeIn(200); // 渐入按钮
        await db.setItem(`${type}_syncScrollSwitch`, true);
        new onScroll();
        console.log(`${type}-同步滚动已打开`);
    });

    jq(`#${type}_sync_scroll_on`).click(async function () {
        jq(this).hide();
        jq(`#${type}_sync_scroll_off`).fadeIn(200); // 渐入按钮
        await db.setItem(`${type}_syncScrollSwitch`, false);
        new offScroll();
        console.log(`${type}-同步滚动已关闭`);
    });

    // 绑定鼠标事件
    function onScroll() {
        let currentTab = 0;
        jq(bbcode).mouseover(() => { currentTab = 1; });
        jq(preview).mouseover(() => { currentTab = 2; });

        jq(bbcode).scroll(() => {
            if (currentTab !== 1) return;
            let scale = (jq(preview).children('.child').get(0).offsetHeight - jq(preview).get(0).offsetHeight) / (jq(bbcode).get(0).scrollHeight - jq(bbcode).get(0).offsetHeight);
            jq(preview).scrollTop(jq(bbcode).scrollTop() * scale);
        });

        jq(preview).scroll(() => {
            if (currentTab !== 2) return;
            let scale = (jq(preview).children('.child').get(0).offsetHeight - jq(preview).get(0).offsetHeight) / (jq(bbcode).get(0).scrollHeight - jq(bbcode).get(0).offsetHeight);
            jq(bbcode).scrollTop(jq(preview).scrollTop() / scale);
        });
    };

    // 解除鼠标事件
    function offScroll() {
        jq(bbcode).off("scroll").off("mouseover");
        jq(preview).off("scroll").off("mouseover");
    };
};

// 为bbcode加上[]
function createTagBox(name, attribute, content) {
    let components = [];
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
};

function replaceTextBox(str, start, end, replacement) {
    return str.substring(0, start) + replacement + str.substring(end);
};


/**
 * 将标签添加到 textArea 元素。
 * @param {HTMLTextAreaElement} textArea - 要修改的 textArea 元素
 * @param {String} name - 标签的名称
 * @param {String} attribute - 标签的属性。 可以为空
 * @param {String} content - 标签的内容。 如果此参数为空，标签将是一个自闭合标签（如 [hr]）
 * @param {Boolean} surround - 指定是否用标签包围选择，或者只是替换选择。 如果有选择且此参数为真，内容被忽略
 * @returns {String} - 构造的 BBCode 标签
 */
function addTagBox(textArea, name, attribute, content, surround) {
    let selStart = textArea.selectionStart;
    let selEnd = textArea.selectionEnd;
    if (selStart === null || selEnd === null) {
        selStart = selEnd = textArea.value.length;
    }
    let selTarget = selStart + name.length + 2 + (attribute ? attribute.length + 1 : 0);
    if (selStart === selEnd) {
        textArea.value = replaceTextBox(textArea.value, selStart, selEnd, createTagBox(name, attribute, content));
    } else {
        let replacement = null;
        if (surround) {
            replacement = createTagBox(name, attribute, textArea.value.substring(selStart, selEnd));
        } else {
            replacement = createTagBox(name, attribute, content);
        }
        textArea.value = replaceTextBox(textArea.value, selStart, selEnd, replacement);
    }
    textArea.setSelectionRange(selTarget, selTarget);
};

/**
 * 将文本添加到 textArea 元素。
 * @param {HTMLTextAreaElement} textArea - 要修改的 textArea 元素
 * @param {String} content - 文本内容
 * @returns {String} - 构造的 BBCode 标签
 */
function addTextBox(textArea, content) {
    let selStart = textArea.selectionStart;
    let selEnd = textArea.selectionEnd;
    if (selStart === null || selEnd === null) { selStart = selEnd = textArea.value.length; };
    let selTarget = selStart + (content ? content.length : 0);  // 计算插入文本后光标的位置
    textArea.value = replaceTextBox(textArea.value, selStart, selEnd, content);
    textArea.setSelectionRange(selTarget, selTarget);  // 设置光标位置
};

function onEditorActionBox(action, element, param) {
    let textArea = document.querySelector(element);
    let selStart = textArea.selectionStart;
    let selEnd = textArea.selectionEnd;
    let selectionText, url;
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
        case 'IMGINK': {
            if (selStart !== selEnd) {
                selectionText = textArea.value.substring(selStart, selEnd);
                addTagBox(textArea, 'imgink', null, selectionText, false);
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
                addTagBox(textArea, 'imgink', null, url, false);
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
                let title = window.prompt(lang['rt_text']);
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
                let title = window.prompt(lang['rt_text']);
                if (title === null || title.length === 0) {
                    break;
                }
                addTagBox(textArea, "rt", title, text, false);
            }
            break;
        }
        case "QUOTE*": {
            if (selStart !== selEnd) {
                let title = window.prompt(lang['main_body_prefix']);
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
                let title = window.prompt(lang['main_body_prefix']);
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
                    let title = window.prompt(lang['url_name']);
                    if (title === null || title.length === 0) {
                        // selectionText = textArea.value.substring(selStart, selEnd);
                        addTag(textArea, "url", null, "", true);
                        break;
                    } else {
                        addTagBox(textArea, "url", selectionText, title, false);
                    };
                } else {
                    // 选中的是文字时
                    let url_link = window.prompt(lang['url_link']);
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
                let title = window.prompt(lang['url_name']);
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
                let title = window.prompt(lang['main_body_prefix']);
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
                let title = window.prompt(lang['main_body_prefix']);
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
        case (action.match(/^javascript:void\('em\d+'\);$/i) || {}).input: {
            addTagBox(textArea, action.slice(17, -3), null, null, true);
            break;
        };
        // default: {
        //     console.log(action);
        // }
    }
    textArea.focus();
};


async function basicFrame(title, type) {
    let basic_html = `
<tr>
    <td id="${type}_outer" align="center" class="outer" style="padding-top: 20px; padding-bottom: 20px; display: none;">
        <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
            <tbody>
                <tr>
                    <td class="embedded">
                        <form id="${type}_compose_custom" method="post" name="${type}_compose_custom">
                            <h2 class="${type}_h2_move" id="${type}_move_part" align="left">${title}</h2>
                            <table width="100%" border="1" cellspacing="0" cellpadding="10">
                                <tbody>
                                    <tr>
                                    <td class="text" align="center">
                                        <table class="main" width="100%" border="1" cellspacing="0" cellpadding="5">
                                        <tbody>
                                            <tr>
                                            <td class="rowhead" valign="top">正文</td>
                                            <td class="rowfollow" align="left">
                                                <div id="${type}_editorouterbox" style="display: block;">
                                                <table width="100%" cellspacing="0" cellpadding="5" border="0">
                                                    <tbody>
                                                    <tr>
                                                        <td align="left" colspan="2">
                                                        <table id="${type}_bbcode_button" cellspacing="1" cellpadding="2" border="0">
                                                            <tbody>
                                                            <tr>
                                                            </tr>
                                                            </tbody>
                                                        </table>
                                                        <div id="${type}_bbcodejs_tbody_box" style="position:relative; margin-top: 4px">
                                                            <div id="${type}_bbcodejs_select_box" style="position: absolute; margin-top: 2px; margin-bottom: 2px; float: left;">
                                                            <select class="med codebuttons" name="${type}_bbcode_color" style="margin-right: 3px; visibility: visible;">
                                                                <option value="">--- 颜色 ---</option>
                                                            </select>
                                                            <select class="med codebuttons" name="${type}_bbcode_font" style="visibility: visible;">
                                                                <option value="">--- 字体 ---</option>
                                                            </select>
                                                            <select class="med codebuttons" name="${type}_bbcode_size" style="visibility: visible;">
                                                                <option value="">--- 字号 ---</option>
                                                            </select>
                                                            </div>
                                                        </div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colspan="2" valign="middle">
                                                        <iframe src="attachment.php?text_area_id=${type}_box_bbcode" width="100%" height="24" frameborder="0" scrolling="no" marginheight="0" marginwidth="0">
                                                        </iframe>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="left">
                                                        <textarea class="${type}_box_bbcode" cols="100" style="width: 99%" id="${type}_box_bbcode" rows="20"></textarea>
                                                        </td>
                                                        <td align="center" width="150">
                                                        <table id="${type}_smile-icon" cellspacing="1" cellpadding="3">
                                                            <tbody>
                                                            </tbody>
                                                        </table>
                                                        <br>
                                                        <a onclick="ShowSmileWindow(&quot;${type}_compose_custom&quot;, &quot;${type}_box_bbcode&quot;)">更多表情</a>
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
                                                        <input id="${type}_post_box" type="button" class="btn" value="发送">
                                                    </td>
                                                    <td class="embedded">
                                                        <input id="${type}_close_box" type="button" class="btn" value="关闭">
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
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>`
    parse_html = jq.parseHTML('<table>' + basic_html + '</table>');  // 转为对象
    const bbcode_button = [
        { "style": "font-weight: bold;font-size:11px; margin-right:3px", "value": "B" },
        { "style": "font-style: italic;font-size:11px;margin-right:3px", "value": "I" },
        { "style": "text-decoration: underline;font-size:11px;margin-right:3px", "value": "U" },
        { "style": "text-decoration: line-through;font-size:11px;margin-right:3px", "value": "S" },
        // { "style": "font-size:11px;margin-right:3px", "value": "URL" },
        { "style": "font-size:11px;margin-right:3px", "value": "URL*" },
        { "style": "font-size:11px;margin-right:3px", "value": "IMG" },
        { "style": "font-size:11px;margin-right:3px", "value": "IMGINK" },
        { "style": "font-size:11px;margin-right:3px", "value": "RT*" },
        { "style": "font-size:11px;margin-right:3px", "value": "LIST" },
        { "style": "font-size:11px;margin-right:3px", "value": "PRE" },
        { "style": "font-size:11px;margin-right:3px", "value": "CODE" },
        { "style": "font-size:11px;margin-right:3px", "value": "QUOTE" },
        { "style": "font-size:11px;margin-right:3px", "value": "QUOTE*" },
        { "style": "font-size:11px;margin-right:3px", "value": "INFO" },
        { "style": "font-size:11px;margin-right:3px", "value": "MEDIAINFO" },
        { "style": "font-size:11px;margin-right:3px", "value": "SPOILER" },
        { "style": "font-size:11px;margin-right:3px", "value": "SPOILER*" }
    ];
    const smile_list = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 16, 17, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 192, 198];
    const font_list = ['Arial', 'Arial Black', 'Arial Narrow', 'Book Antiqua', 'Century Gothic', 'Comic Sans MS', 'Courier New',
        'Fixedsys', 'Garamond', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
        'Palatino Linotype', 'System', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
    const color_list = ["Black", "Sienna", "Dark Olive Green", "Dark Green", "Dark Slate Blue", "Navy", "Indigo",
        "Dark Slate Gray", "Dark Red", "Dark Orange", "Olive", "Green", "Teal", "Blue", "Slate Gray", "Dim Gray",
        "Red", "Sandy Brown", "Yellow Green", "Sea Green", "Medium Turquoise", "Royal Blue", "Purple", "Gray",
        "Magenta", "Orange", "Yellow", "Lime", "Cyan", "Deep Sky Blue", "Dark Orchid", "Silver", "Pink",
        "Wheat", "Lemon Chiffon", "Pale Green", "Pale Turquoise", "Light Blue", "Plum", "White"];
    // 插入表情
    smile_list.forEach(function (item, index) {
        if (Number.isInteger((index + 4) / 4)) jq(parse_html).find(`#${type}_smile-icon`).children('tbody').append(`<tr></tr>`);
        jq(parse_html).find(`#${type}_smile-icon`).find('tr:last').append(`<td class="embedded smile-icon"><a href="javascript:void('em${item}');" name="${type}_bbcode_smile"><img style="max-width: 25px;" src="pic/smilies/${item}.gif" alt=""></a></td>`);
    });
    // 插入字体大小菜单
    [1, 2, 3, 4, 5, 6, 7].forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_size"]`).append(`<option value="${item}">${item}</option>`); })
    // 插入字体菜单
    font_list.forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_font"]`).append(`<option value="${item}">${item}</option>`); });
    // 插入颜色菜单
    color_list.forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_color"]`).append(`<option style="background-color: ${item.replace(/\s/g, '').toLowerCase()}" value="${item.replace(/\s/g, '')}">${item}</option>`); });
    // 插入按钮
    bbcode_button.forEach(function (item) {
        jq(parse_html).find(`#${type}_bbcode_button`).find('tr:last').append(`<td class="embedded"><input class="codebuttons" style="${item.style}" type="button" value="${item.value}" name="${type}_bbcode_button"></td>`);
    });
    // 插入预览框
    jq(parse_html).find(`#${type}_box_bbcode`).parents("tr:eq(1)").after(`<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">${lang['preview']}</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2"><div id="${type}_bbcode2_box" style="min-height: 25px; max-height: 1px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;"><div class="child"></div></div></td></tr></tbody></table></td>`);
    return jq(parse_html).html().replace(/^<tbody>([\s\S]*)<\/tbody>$/gm, '$1');
};


/**
* 同步窗口大小变化
*/
// https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver
function syncWindowChange(input, preview) {
    let MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
    let element = document.querySelector(input);
    var height_now, height_last;
    var observer = new MutationObserver((mutations) => {
        mutations.forEach(function (mutation) {
            if (mutation.type == "attributes") {
                height_now = Number(mutation.target.style.height.replace('px', '')) + 30;
                if (height_last === height_now) { return } else { height_last = height_now; };
                jq(preview).css("max-height", height_now + "px");
            };
        })
    });
    observer.observe(element, {
        attributes: true,
        attributeFilter: ['style']
    });
};


/**
* 监听用户动作
* @param {string} type - BBCODE窗口类型
*/
async function btnListener(type) {
    // 下拉菜单监听
    jq(`[name="${type}_bbcode_color"]`).change(function () { onEditorActionBox('COLOR', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
    jq(`[name="${type}_bbcode_font"]`).change(function () { onEditorActionBox('FONT', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
    jq(`[name="${type}_bbcode_size"]`).change(function () { onEditorActionBox('SIZE', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
    // 按钮监听
    jq(`[name="${type}_bbcode_button"]`).click(function () { onEditorActionBox(this.value, `#${type}_box_bbcode`); });
    // 输入框右边表情，鼠标悬浮图标变大
    jq(`[name="${type}_bbcode_smile"]`).mouseenter(function () { jq(this).children('img').css({ "transform": "scale(1.35)", "transition": "all 0.3s" }); });
    // 输入框右边表情，鼠标离开图标恢复原状
    jq(`[name="${type}_bbcode_smile"]`).mouseleave(function () { jq(this).children('img').css({ "transform": "" }); });
    // 输入框右边表情，点击图标输入表情
    jq(`[name="${type}_bbcode_smile"]`).click(function () { onEditorActionBox(jq(this).attr('href'), `#${type}_box_bbcode`); });
    // 监听各种按钮的点击事件
    jq(`[name="${type}_bbcode_color"],[name="${type}_bbcode_font"],[name="${type}_bbcode_size"],[name="${type}_bbcode_button"],[name="${type}_bbcode_smile"],td.embedded.${type}_smile-icon a`).click(async function () { jq(`#${type}_bbcode2_box`).children('.child').html(await bbcode2html(jq(`#${type}_box_bbcode`).val())); });
    // 监听bbcode写入事件
    jq(`#${type}_box_bbcode`).bind('input propertychange', async function () { jq(`#${type}_bbcode2_box`).children('.child').html(await bbcode2html(jq(this).val())); });

};

// attach 标签转 img 标签
const attach2Img = async (emid, dom) => {
    const db = localforage.createInstance({ name: "attachmap" });
    let cbbcode = jq(`#${emid}`, dom).val();
    cbbcode = await replaceAsync(cbbcode, /\[attach\](?<hash>\w{32})\[\/attach\]/gi, async (...args) => {
        const { hash } = args.slice(-1)[0];
        return await db.getItem(hash).then(async (value) => {
            if (value !== null) if (value.attach_type === 'img') return `[img]${value.attach_url}[/img]`;
            // 没有匹配到数据时，直接返回原标签
            return args[0];
        });
    });
    // console.log(cbbcode);
    jq(`#${emid}`, dom).val(cbbcode);
    // 手动触发bbcode内容更改
    // jq(`#${emid}`, window.parent.document).trigger("input");
    dom.getElementById(emid).dispatchEvent(new Event('input'));
};

// 判断链接是否有效
const urlCheck = (url) => {
    return new Promise((resolve) => {
        jq.ajax({
            type: 'get',
            cache: false,
            url: url,
            success: function (d) {
                console.log('url有效');
                resolve(true)
            },
            error: function (d) {
                console.log('url无效');
                resolve(false);
            }
        });
    });
};

// 从弹窗添加表情实时预览结果 [https://u2.dmhy.org/moresmilies.php?form=upload&text=descr]
// 考虑更换成内部悬浮窗
// 外部窗口填入，不记录光标位置
(async () => {
    if (location.pathname !== '/moresmilies.php') return;

    jq('td[align="center"] a').each(function () {
        let scriptAction = jq(this).attr('href');
        jq(this).attr('href', scriptAction.replace('SmileIT', 'SmileIT2'));
    });

    jq('body').append(`<script type="text/javascript">
function SmileIT2(smile, form, text) {
    window.opener.document.forms[form].elements[text].value = window.opener.document.forms[form].elements[text].value + " " + smile + " ";
    window.opener.document.forms[form].elements[text].focus();
    window.opener.document.forms[form].elements[text].dispatchEvent(new Event('input'));
    window.close();
};
</script>`)

})();


// 举报
(async () => {
    let type = 'report';
    // 查找举报提交页面
    const $report_form = jq('form[action="report.php"]');
    if ($report_form.length === 0) return;
    $report_form.find('[type="submit"]').after(`<input id="${type}_bbcode" type="button" value="高级">`);
    // 插入框架
    jq('#outer').parent().after(await basicFrame('举报', type));
    // 插入同步窗口滚动按钮
    await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
    // 插入自动保存按钮
    await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
    const $outer = jq(`#${type}_outer`);
    // 监听按钮
    await btnListener(type);
    // 同步窗口大小变化
    syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

    // 关闭窗口
    jq(`#${type}_close_box`).click(function () {
        jq('#outer').show();
        $outer.hide();
    });
    // 发送
    jq(`#${type}_post_box`).click(function () {
        jq('[name="reason"]').val(jq(`#${type}_box_bbcode`).val());
        $outer.hide();
        jq('#outer').show();
        $report_form.find('[type="submit"]').trigger("submit");
    });
    //显示窗口
    jq(`#${type}_bbcode`).click(async function () {
        // 获取输入框的值，如引用之类的数据
        let text = $report_form.find('textarea').val();
        // 如果外部输入框不为空，则引入外部输入框的值
        if (text !== '') jq(`#${type}_box_bbcode`).val(text);
        // 显示窗口
        $outer.show();
        // 隐藏窗口
        jq('#outer').hide();
        // 设置悬浮窗口中预览窗口的最大高度
        jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
        const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
        jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
        // 手动触发bbcode内容更改
        jq(`#${type}_box_bbcode`).trigger("input");
    });
})();


// 聊天
(async () => {
    let type = 'shbox';
    const $shbox_button = jq('#hbsubmit');  // 查找聊天版清除按钮
    if ($shbox_button.length === 0) return;  // 聊天版自动刷新时，会再次触发当前函数 || 未开启聊天版
    $shbox_button.after(`<input id="${type}_bbcode" type="button" class="${$shbox_button.attr('class')}" value="高级">`);
    // 插入框架
    $shbox_button.parents('tr:last()').after(await basicFrame('群聊区', type));
    // 插入同步窗口滚动按钮
    await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
    // 插入自动保存按钮
    await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
    const $outer = jq(`#${type}_outer`);
    // 监听按钮
    await btnListener(type);
    // 同步窗口大小变化
    syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

    // 点击关闭窗口按钮
    jq(`#${type}_close_box`).click(function () { $outer.hide(); });
    // 发送
    jq(`#${type}_post_box`).click(async function () {
        // 强制将attach中的img附件转为img tag <u2已经在聊天区拒绝显示attach，见日志 67eba9ca892af4931ced86921fd017b9ee457730>
        await attach2Img(`${type}_box_bbcode`, window.document);
        // 更改输入框类型 方法有点蠢，懒的改，又不是不能用
        jq('#shbox_text').each(function () {
            const textarea = jq(document.createElement('textarea')).attr({
                'name': jq(this).attr('name'),
                'id': jq(this).attr('id'),
                'size': jq(this).attr('size'),
                'style': jq(this).attr('style')
            });
            jq(this).replaceWith(textarea);
        });
        jq('#shbox_text').val(jq(`#${type}_box_bbcode`).val());
        jq('[name="shbox"]').trigger("submit");
        jq('#shbox_text').each(function () {
            const textarea = jq(document.createElement('input')).attr({
                'name': jq(this).attr('name'),
                'id': jq(this).attr('id'),
                'size': jq(this).attr('size'),
                'style': jq(this).attr('style')
            });
            jq(this).replaceWith(textarea);
        });
        $outer.hide();
    });
    //点击按钮
    jq(`#${type}_bbcode`).click(async function () {
        // 获取输入框的值，如引用之类的数据
        let text = jq('#shbox_text').val();
        // 如果外部输入框不为空，则引入外部输入框的值
        if (text !== '') jq(`#${type}_box_bbcode`).val(text);
        // 显示窗口
        $outer.is(':hidden') ? $outer.show() : $outer.hide();
        // 设置窗口中预览窗口的最大高度
        jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
        const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
        jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
        // 手动触发bbcode内容更改
        jq(`#${type}_box_bbcode`).trigger("input");
    });
})();


// 请求续种
(async () => {
    if (location.pathname !== '/request.php') return;
    let type = 'request';
    // 查找按钮
    const $request_button = jq('#qr');
    if ($request_button.length === 0) return;
    $request_button.after(`<input id="${type}_bbcode" type="button" class="codebuttons" value="高级">`)
    // 插入框架
    jq('#outer').find('tbody:first').append(await basicFrame('回应/评论', type));
    // 插入同步窗口滚动按钮
    await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
    // 插入自动保存按钮
    await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
    const $outer = jq(`#${type}_outer`);

    // 监听按钮
    await btnListener(type);
    // 同步窗口大小变化
    syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

    // 关闭窗口
    jq(`#${type}_close_box`).click(function () {
        jq('#compose').parentsUntil('.embedded').eq(-1).show();
        $outer.hide();
    });
    // 发送
    jq(`#${type}_post_box`).click(function () {
        jq('#compose textarea').val(jq(`#${type}_box_bbcode`).val());
        $outer.hide();
        jq('#compose').parentsUntil('.embedded').eq(-1).show();
        jq('#compose').trigger("submit");
    });
    //点击弹出窗口
    jq(`#${type}_bbcode`).click(async function () {
        // 获取输入框的值，如引用之类的数据
        let text = jq('#compose textarea').val();
        // 如果外部输入框不为空，则引入外部输入框的值
        if (text !== '') jq(`#${type}_box_bbcode`).val(text);
        // 显示窗口
        $outer.show();
        // 隐藏窗口
        jq('#compose').parentsUntil('.embedded').eq(-1).hide();
        // 设置悬浮窗口中预览窗口的最大高度
        jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
        const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
        jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
        // 手动触发bbcode内容更改
        jq(`#${type}_box_bbcode`).trigger("input");
    });
})();


// 控制面板
(async () => {
    if (location.pathname !== '/usercp.php') return;
    let action;
    let type = 'usercp';
    const $signature_window = jq('[name="signature"]');  // 查找BBCODE窗口
    const $info_window = jq('[name="info"]');  // 查找BBCODE窗口
    if ($signature_window.length !== 0) { type = `${type}_signature`; action = 'signature'; }
    else if ($info_window.length !== 0) { type = `${type}_info`; action = 'info'; }
    else return;

    jq(`[name="${action}"]`).parent().find('a').attr({ 'href': 'javascript:void(0);false;', 'target': '', 'id': `${action}_bbcode_a` });
    // await basicFrame(action === 'signature' ? '论坛签名档' : '个人说明', type);  
    // 插入框架
    jq('#outer').find('tbody:first').append(await basicFrame(action === 'signature' ? '论坛签名档' : '个人说明', type));
    // 插入同步窗口滚动按钮
    await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
    // 插入自动保存按钮
    await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
    const $outer = jq(`#${type}_outer`);

    await btnListener(type);  // 监听按钮
    syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);  // 同步窗口大小变化

    // 关闭窗口
    jq(`#${type}_close_box`).click(function () {
        jq('#outer').children('table:last').show();
        $outer.hide();
    });
    // 发送
    jq(`#${type}_post_box`).click(function () {
        jq(`[name="${action}"]`).val(jq(`#${type}_box_bbcode`).val());
        jq('#outer').children('table:last').show();
        $outer.hide();
    });
    // 点击弹出窗口
    jq(`#${action}_bbcode_a`).click(async function () {
        // 获取输入框的值，如引用之类的数据
        let text = jq(`[name="${action}"]`).val();
        // 如果外部输入框不为空，则引入外部输入框的值
        if (text !== '') jq(`#${type}_box_bbcode`).val(text);
        // 显示悬浮窗口
        $outer.show();
        // 隐藏窗口
        jq('#outer').children('table:last').hide();
        // 设置悬浮窗口中预览窗口的最大高度
        jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
        const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
        jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
        // 手动触发bbcode内容更改
        jq(`#${type}_box_bbcode`).trigger("input");
        jq(`#${type}_post_box`).attr("value", '填写');
    });
})();


// 附件
(async () => {
    if (location.pathname !== '/attachment.php') return;
    const url = window.URL || window.webkitURL;
    jq('input[type="file"]').attr('multiple', 'multiple'); // 允许多文件上传
    jq('input[type="file"]').attr('accept', '.jpg,.jpeg,.png,.gif,.torrent,.zip,.rar,.7z,.gzip,.gz'); // 限制上传文件类型
    jq('input[name="submit"]').attr('type', 'button'); // 更改按钮类型
    jq('input[type="file"]').css('width', '20%'); // 调整文件输入框的宽度
    jq('.embedded').after(`<td name="progress" width="25%"><div class="progress"><div></div></div></td>
                           <td name="progress" style="width: 23%; text-align: center; font-style: italic;";><span name="progress-percent"></span></td>
                           <td name="progress" style="width: 8%; text-align: center; font-style: italic;"><span name="progress-total"></span></td>
                           <td name="progress" style="font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                            <span name="progress-name"></span>
                           </td>`);
    jq('.progress').css({
        'width': '99%',
        'height': '8px',
        'border': '1px solid #ccc',
        'border-radius': '5px',  // 圆角
        'margin': '8px 2px',
        'overflow': 'hidden',  // 控制内容溢出元素框时在对应的元素区间内添加滚动条
    });
    jq('.inframe').css('background', 'none'); // 去除背景色
    jq('table').css('table-layout', 'fixed'); // 设置表格宽度固定
    jq('table tr td').css("border", "0px solid"); // 去除边框
    jq('.progress > div').css({
        'width': '0px',
        'height': '100%',
        'background-color': '#8db8ff',
        'transition': 'all 300ms ease'
    }); // 设置进度条颜色
    jq('[name="progress"]').hide();  // 隐藏进度条

    jq('input[name="submit"]').click(async function () {
        const emfile = jq('input[type="file"]')[0];
        if (!emfile.value) {
            // 没有选择文件时，不触发上传
            window.alert('请选择文件');
            return;
        };
        jq('.embedded').hide();
        jq('[name="progress"]').show();
        let attach_hash_list = []; // 存储上传文件的hash值
        await (async () => {
            for (let i = 0, len = emfile.files.length; i < len; i++) {
                console.log(emfile.files[i]);
                jq('[name="progress-total"]').text(`${i + 1} / ${len}`); // 显示当前上传文件的序号
                let thumb = await imgThumb(emfile.files[i]).catch(e => { });
                if (thumb !== 0 && thumb !== 1 && thumb !== '') continue;  // 如果不是有效的文件，则跳过
                let hash = await upload(emfile.files[i], thumb).catch(e => { }); // 上传文件 返回文件hash
                if (hash) attach_hash_list.push(hash); // 存储hash值
            };
        })();
        console.log(attach_hash_list);
        let bbcode = '';
        attach_hash_list.forEach(async (hash) => { bbcode += `[attach]${hash}[/attach]`; })
        let em = /text_area_id=(?<id>[^\?&]+)/i.exec(location.search);  // 获取text_area_id
        addTextBox(window.parent.document.getElementById(em.groups.id), bbcode); // 添加附件bbcode
        window.parent.document.getElementById(em.groups.id).dispatchEvent(new Event('input'));  // 触发input事件
        jq('[name="progress"]').hide();  // 隐藏进度条
        jq('.embedded').show();  // 显示附件菜单
        jq('[name="file"]').val(''); // 清空输入框
    });

    // 判断是否会触发缩图
    const imgThumb = (file) => {
        return new Promise((resolve, reject) => {
            if (file.type.indexOf('image') === 0) {
                // console.log('载入');
                let img = new Image();              //创建个Image对象
                img.src = url.createObjectURL(file); //将图片路径存入Image对象
                img.onload = function () {
                    console.log('长: ' + this.height + ' | 宽: ' + this.width)
                    resolve((this.height > 500 || this.width > 500) ? 1 : 0);
                };
                img.onerror = function () {
                    window.alert(`${file.name} 不是有效的图片文件`);
                    reject('invalid');
                }
            } else {
                resolve('');
            };
        });
    };

    // 上传文件
    const upload = (file, attach_thumb) => {
        return new Promise((resolve, reject) => {
            let formData = new FormData();  // 创建一个form类型的数据
            formData.append('file', file);  // 获取上传文件的数据
            if (!/\.(jpg|jpeg|png|gif|torrent|zip|rar|7z|gzip|gz)$/i.test(file.name)) { window.alert(`${file.name} 文件类型不支持`); reject(); return; }
            if (file.size > 1024 * 1024 * 4) { window.alert(`${file.name} 文件过大`); reject(); return; }
            jq.ajax({
                url: "attachment.php", // 接口
                type: 'post',
                cache: false,
                contentType: false,
                processData: false,
                data: formData,
                xhr: function () {
                    const xhr = new XMLHttpRequest();
                    xhr.upload.addEventListener('progress', function (e) {
                        let progressRate = ((e.loaded / e.total) * 100).toFixed(2) + '%';  // 计算上传进度
                        jq('.progress > div').css('width', progressRate);  // 设置进度条宽度
                        jq('[name="progress-percent"]').text(`${e.loaded} / ${e.total} | ${progressRate}`);
                        jq('[name="progress-name"]').text(file.name);
                    });
                    return xhr;
                },
                success: async function (d) {
                    let attach_hash_obj = /(?<hash>\w{32})/i.exec(jq(d).find('script').text());
                    // if (!attach_hash_obj) return;  // 没有找到id直接返回 
                    // <span class="striking">失败！不允许该文件扩展名。</span>
                    const attach_hash = attach_hash_obj.groups.hash; // 附件的hash值
                    console.log(attach_hash)
                    const db = localforage.createInstance({ name: "attachmap" });
                    const attach = { "attach_thumb": attach_thumb };
                    await db.setItem(attach_hash, attach); // 写入数据库
                    // 不知道怎么计算的，怎么传都用不完配额
                    let n = jq(d).find('font[color="red"]').text();  // 剩余上传附件数量
                    jq('font[color="red"]').text(n); // 更新剩余上传附件数量
                    jq('.progress > div').css('width', '0%');  // 重置进度条宽度
                    resolve(attach_hash);
                },
                error: function (e) {
                    console.log(e)
                    reject(e);
                }
            });
        });
    };

    // 将 attach 标签内的图片转为 img 标签 <attach的图片太糊了，要大图还要点一下，好麻烦xd>
    jq('input[name="submit"]').after(`<input id="bigimg" type="button" value="转IMG">`);
    jq(`#bigimg`).click(async function () {
        let em = /text_area_id=(?<id>[^\?&]+)/i.exec(location.search);
        if (!em) return;  // 没有找到id直接返回 
        await attach2Img(em.groups.id, window.parent.document)
    });

})();
