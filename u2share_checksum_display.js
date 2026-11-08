// ==UserScript==
// @name         U2显示文件校验和
// @namespace    U2显示文件校验和
// @version      0.1.4
// @description  为文件列表添加校验和信息，并标注是否已被二次校验
// @author       kysdm
// @match        *://u2.dmhy.org/details.php?id=*
// @grant        none
// @license      MIT
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://unpkg.com/xhook@1.6.2/dist/xhook.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// ==/UserScript==

// 校验值列表接口（公开，无需 token），只用来取当前种子的二次校验次数
const VERIFY_COUNT_API = 'https://u2.kysdm.com/api/v2/torrents/checksum/list';

(async () => {
    'use strict';

    xhook.before(async (request, callback) => {
        if (request.url.match(/viewfilelist\.php\?id=\d+/)) { await checkTorrentChecksum(); }
        callback();
    })

    xhook.after(function (request, response) {
        if (request.url.match(/viewfilelist\.php\?id=\d+/)) {
            if (torrent_checksum === 'null') return;
            const resp = response.text;
            const doc = $('<div></div>').html(resp);
            const f_ids = doc.find('[id^=f_id_]');
            const f_obj = new Object();
            const f_tmp = [];
            let f_id = '';

            f_ids.each(function () {
                const f_name = $(this).find('td').first().text();
                const f_name_trim = f_name.trimStart();
                const leadingSpaceCount = countLeadingSpaces(f_name);
                const _depth = leadingSpaceCount / 4;
                const f_depth = f_tmp.length - 1;

                if (_depth === f_depth + 1) {
                    // root
                } else if (_depth === f_depth) {
                    if (f_tmp.length !== 0) f_obj[f_tmp.join('/')] = f_id;
                    f_tmp.pop();
                } else {
                    f_obj[f_tmp.join('/')] = f_id;
                    f_tmp.splice(-(f_depth - _depth + 1));
                }

                f_tmp.push(f_name_trim);
                f_id = $(this).attr("id");
            });

            f_obj[f_tmp.join('/')] = f_id;

            if (torrent_checksum && typeof torrent_checksum === 'object' && Object.keys(torrent_checksum).length !== 0) {
                doc.append(`<style>.checksum { 
                    font-family: ui-monospace,SFMono-Regular,SF Mono,Menlo,Consolas,Liberation Mono,monospace;
                    text-align: center;
                    color: rgb(128, 128, 128);
                    border-left: none;
                    border-right: none;
                }</style>`);
                doc.find("td.rowfollow.dir_size").attr("colspan", "2");
                doc.find("tr:first").find("td.colhead:last").attr("colspan", "2");

                torrent_checksum.torrent_files_info.files.forEach(function (item) {
                    const path = item.path.split("/").slice(1).join("/");
                    const hash = item.hash;
                    const f_id = f_obj[path];
                    const td2 = doc.find(`#${f_id}`).find('td:last');
                    td2.css({ "border-left": "none" });
                    td2.before(`<td class="rowfollow checksum">&nbsp;${hash}&nbsp;</td>`)
                });
            }
            response.text = doc.html();
        }
    })

    var checkTorrentChecksumPromise, uid, tid, torrent_checksum;

    function checkTorrentChecksum() {
        return new Promise((resolve, reject) => {
            if (typeof torrent_checksum !== 'undefined') { resolve(); } else { checkTorrentChecksumPromise = resolve; }
        });
    }

    function assignTorrentChecksum() {
        if (checkTorrentChecksumPromise) checkTorrentChecksumPromise();
    }

    let em = /.*id=(?<tid>\d{3,5})/i.exec(location.search); if (em) tid = em.groups.tid; else tid = null; // 当前种子ID
    uid = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i) || ['', '']; if (uid[1] !== '') uid = uid[1]; // 当前用户ID
    const lang = new lang_init($('#locale_selection').val()); // 获取当前网页语言
    const db = localforage.createInstance({ name: "history" });
    const token = await db.getItem('token');
    if (token === null || token.length !== 96) { window.alert('未找到有效 API Token，将无法使用此脚本。') };

    torrent_checksum = await getApi(token, tid);
    assignTorrentChecksum();

    if (torrent_checksum === 'null') {
        $("#closeall").after(`<span id="checksum">[校验和获取失败]</a></span>`);
        return;
    }

    const isSingleFile = $('#showfl').length === 0;
    let checksumSpan = '';
    let copyLines = null;

    if (torrent_checksum === '404') {
        if (!isSingleFile) $("#closeall").after(`<span id="checksum">[无校验和信息]</a></span>`);
    } else {
        const verifyCount = await getVerifyCount(tid);
        checksumSpan = `<span id="checksum">${checksumLink(verifyCount)}</span>`;
        copyLines = torrent_checksum.torrent_files_info.files.map(item => `${item.hash} *${item.path}`);

        // 多文件种子：链接跟在文件列表的「关闭所有」后面
        if (!isSingleFile) $("#closeall").after(checksumSpan);
    }

    if (isSingleFile) {
        // 单文件种子没有文件列表，把「[复制校验和✓]」放进「文件校验和」这一行
        const checksum = torrent_checksum && typeof torrent_checksum === 'object' && Object.keys(torrent_checksum).length !== 0 ? torrent_checksum.torrent_files_info.files[0].hash : '---';
        const link = checksumSpan ? `&nbsp;&nbsp;${checksumSpan}` : '';

        $(`td[class='rowhead nowrap']:contains('${lang['torrent_info']}')`).next('td').find('tr:first')
            .after(`<tr><td style="border: none;" colspan="4"><b>文件校验和:</b>&nbsp;${checksum}${link}</td></tr>`);

        if (copyLines) bindCopy(copyLines);

        return;
    }

    if (copyLines) bindCopy(copyLines);

})();

async function getApi(token, tid) {
    return new Promise(async (resolve) => {
        $.ajax({
            type: 'get',
            url: `https://u2.kysdm.com/api/v2/torrents/${tid}/checksum`,
            headers: { "Authorization": "Bearer " + token },
            success: async function (d) {
                if (d.message === 'success') {
                    return resolve(d.data.checksum);
                } else {
                    window.alert('checksum 获取失败')
                    return resolve('null');
                };
            },
            error: async function (d) {
                if (d.status === 404) return resolve('404');
                // window.alert('checksum 获取失败')
                return resolve('null');
            },
        })
    })
};

function countLeadingSpaces(s) {
    return s.length - s.trimStart().length;
}

function lang_init(lang) {
    const lang_json = {
        "zh_CN": {
            "torrent_info": "种子信息",
        },
        "zh_TW": {
            "torrent_info": "種子訊息",
        },
        "zh_HK": {
            "torrent_info": "種子訊息",
        },
        "en_US": {
            "torrent_info": "Torrent Info",
        },
        "ru_RU": {
            "torrent_info": "Информация о торренте",
        }
    };
    return lang_json[lang];
};

/**
 * 取种子的二次校验次数（公开接口，失败按 0 处理）
 * @param {string} tid 种子 ID
 * @returns {Promise<number>}
 */
async function getVerifyCount(tid) {
    if (!tid) return 0;

    try {
        const resp = await fetch(`${VERIFY_COUNT_API}?ids=${tid}`, { cache: 'default' });
        if (!resp.ok) return 0;

        const body = await resp.json();
        if (!body || body.code !== 200 || !body.data || !Array.isArray(body.data.items)) return 0;

        for (let i = 0; i < body.data.items.length; i++) {
            const item = body.data.items[i];
            if (!item || Number(item.torrent_id) !== Number(tid)) continue;

            const count = Number(item.verify_count);
            return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
        }

        return 0;
    } catch (e) {
        console.log('校验次数获取失败，本次不显示次数：' + e);
        return 0;
    }
}

/**
 * 生成「[复制校验和]」链接；已二次校验时在方括号内补一个 ✓
 * @param {number} verifyCount
 * @returns {string}
 */
function checksumLink(verifyCount) {
    const label = verifyCount > 0
        ? '[复制校验和✓]'
        : '[复制校验和]';

    return `<a href="javascript:void(0)">${label}</a>`;
}

/**
 * 绑定「[复制校验和]」的复制行为
 * @param {string[]} lines 每行一条「hash *path」
 */
function bindCopy(lines) {
    $("#checksum").click(function () {
        navigator.clipboard.writeText(lines.join('\n')).then(() => {
            window.alert('成功')
        }).catch(() => {
            window.alert('失败 - 可能是你的浏览器太古老了')
        });
    });
}
