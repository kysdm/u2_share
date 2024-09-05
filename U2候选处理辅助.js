// ==UserScript==
// @name         U2候选处理辅助
// @namespace    https://u2.dmhy.org/
// @version      0.0.3
// @description  U2候选处理辅助
// @author       kysdm
// @match        *://u2.dmhy.org/offers.php?*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// ==/UserScript==

'use strict';

(async () => {
    let tid = /.*id=(?<tid>\d{3,5})/i.exec(location.search)?.groups?.tid || null; // 当前种子ID

    let uid = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i)?.[1] || ''; // 当前用户ID
    const db = localforage.createInstance({ name: "history" });  // API 数据库
    const token = await db.getItem('token');  // API Token

    if (!token || token.length !== 96) {
        window.alert('未找到有效 API Token，将无法使用此脚本。');
        return;
    }

    // console.log($('#top').siblings('table'));

    $('#top').nextAll('table').first().find('tr:first').before(`
        <tr>
            <td class="rowhead nowrap" valign="top" align="right">检查</td>
            <td class="rowfollow" valign="top" align="left" id="mod_check"></td>
        </tr>
    `);

    const apiData = await getApi(token, uid, tid);

    if (apiData.msg !== 'success') {
        $('#mod_check').html('API INFO 获取失败');
        return;
    }

    const historyData = apiData.data.history;
    const torrent = historyData[0];
    const { torrent_tree: torrentTree, torrent_size: torrentSize } = torrent;

    if (isNaN(torrentSize)) {
        log('API 种子体积获取失败');
    } else {
        const sizeApiData = await getApiSize(token, uid, torrentSize);

        if (sizeApiData.msg !== 'success') {
            log('API SIZE 获取失败');
        } else {
            sizeApiData.data.torrents.forEach(({ torrent_id: torrentId }) => {
                if (String(torrentId) === tid) return; // 跳过与自身 ID 相同的种子
                log(`体积相同: <a href="https://u2.dmhy.org/details.php?id=${torrentId}&hit=1" target="_blank">#${torrentId}</a>`);
            });
        }

    }

    console.log(torrentTree);
    check(torrentTree);
    log('完成');

    const aTag = document.querySelector("#top a");
    const textInsideATag = aTag.textContent;
    const newTextElement = document.createTextNode(textInsideATag);
    aTag.replaceWith(newTextElement);

})();

function log(newContent) {
    const logContainer = $('#mod_check');

    if (!logContainer.length) return; // 防止 logContainer 不存在

    // 如果容器为空，直接插入新内容；否则追加新行
    logContainer.append(logContainer.html().trim() === ''
        ? newContent
        : `<br>${newContent}`);
}

function check(directory, currentPath = '') {
    // 垃圾文件夹的名称
    const junkFolders = new Set(["makemkv", "any!", "xrvl"]);

    // 垃圾文件的完整名称
    const junkFiles = new Set([".ds_store", "thumbs.db", "disc.inf"]);

    // 垃圾文件后缀名
    const junkFileExtensions = [".m3u8", ".m3u", ".lwi", ".bat", ".md5", ".nfo"];

    // 可疑文件后缀名
    const suspiciousFileExtensions = [".txt"];

    // 遍历目录中的每个子项
    for (const [key, item] of Object.entries(directory)) {
        const lowerKey = key.toLowerCase(); // 将文件名或文件夹名转为小写
        const fullPath = `${currentPath}/${key}`; // 构造当前文件或文件夹的绝对路径

        // 如果是目录，则递归调用 check() 函数
        if (item.type === "directory") {
            if (junkFolders.has(lowerKey)) {
                log(`垃圾文件夹 ${fullPath}`); // 输出垃圾文件夹的绝对路径
            }
            check(item.children, fullPath); // 递归检查子目录
        }
        // 如果是文件
        else if (item.type === "file") {
            // 如果文件大小为 0
            if (item.length === 0) {
                log(`空文件 ${fullPath}`); // 输出空文件的绝对路径
            }

            // 检查是否是垃圾文件（通过完整名称匹配）
            if (junkFiles.has(lowerKey)) {
                log(`垃圾文件 ${fullPath}`); // 输出垃圾文件的绝对路径
            }
            // 检查是否是垃圾文件后缀
            else if (junkFileExtensions.some(ext => lowerKey.endsWith(ext))) {
                log(`垃圾文件 ${fullPath}`); // 输出带垃圾后缀的文件路径
            }
            // 检查是否是可疑文件后缀
            else if (suspiciousFileExtensions.some(ext => lowerKey.endsWith(ext))) {
                log(`可疑文件 ${fullPath}`); // 输出可疑文件的绝对路径
            }
        }
    }
}


async function getApi(token, uid, tid) {
    try {
        const response = await fetch(`https://u2.kysdm.com/api/v1/history?token=${token}&maximum=1&uid=${uid}&torrent_id=${tid}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'force-cache'
        });
        if (!response.ok) {
            throw new Error(`HTTP 状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('发生错误:', error);
        throw error;
    }
}

async function getApiSize(token, uid, size) {
    try {
        const response = await fetch(`https://u2.kysdm.com/api/v1/search_torrents_size?token=${token}&size=${size}&uid=${uid}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            cache: 'force-cache'
        });
        if (!response.ok) {
            throw new Error(`HTTP 状态码: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('发生错误:', error);
        throw error;
    }
}
