// ==UserScript==
// @name         U2候选处理辅助
// @namespace    https://u2.dmhy.org/
// @version      0.2.1
// @description  U2候选处理辅助
// @author       kysdm
// @match        *://u2.dmhy.org/offers.php?*
// @match        *://u2.dmhy.org/details.php?*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @downloadURL  https://gist.githubusercontent.com/kysdm/23e9247f2c31ac6a7f0ba4b09aa93ae6/raw
// @updateURL    https://gist.githubusercontent.com/kysdm/23e9247f2c31ac6a7f0ba4b09aa93ae6/raw
// ==/UserScript==

// 可用作测试的种子
// https://u2.dmhy.org/details.php?id=58873&hits=1
// https://u2.dmhy.org/offers.php?id=16312&off_details=1
// https://u2.dmhy.org/offers.php?id=58971&off_details=1
// https://u2.dmhy.org/offers.php?id=51488&off_details=1
// https://u2.dmhy.org/offers.php?id=59743&off_details=1
// https://u2.dmhy.org/offers.php?id=59308&off_details=1
// https://u2.dmhy.org/offers.php?id=59911&off_details=1
// https://u2.dmhy.org/offers.php?id=59985&off_details=1
// https://u2.dmhy.org/details.php?id=60091&hit=1

'use strict';

class Logger {
    constructor() {
        this.logs = [];
    }

    addLog(content) {
        const formattedContent = content.replace(/^([^→]+) → (.+)$/, '$1 → <span style="color: rgb(128, 128, 128);">$2</span>');
        this.logs.push(formattedContent);
    }

    renderLogs(targetElementId) {
        const targetElement = document.getElementById(targetElementId);
        if (targetElement) {
            targetElement.innerHTML = this.logs.join('<br>');
        }
    }
}

const logger = new Logger();

(async () => {
    let torrentId = /.*id=(?<torrentId>\d{3,5})/i.exec(location.search)?.groups?.torrentId || null; // 当前种子ID

    let userId = $('#info_block').find('a:first').attr('href').match(/\.php\?id=(\d{3,5})/i)?.[1] || ''; // 当前用户ID
    const db = localforage.createInstance({ name: "history" });  // API 数据库
    const token = await db.getItem('token');  // API Token

    if (!token || token.length !== 96) {
        window.alert('未找到有效 API Token，将无法使用此脚本。');
        return;
    }

    const newRow = `
    <tr>
        <td class="rowhead nowrap" valign="top" align="right">检查</td>
        <td class="rowfollow" valign="top" align="left" id="mod_check"></td>
    </tr>
`;

    $('#top').nextAll('table').first().find('tr:first').before(newRow);

    const apiData = await fetchApi('history', { token, maximum: 1, uid: userId, torrent_id: torrentId });

    if (apiData.msg !== 'success') {
        $('#mod_check').html('API INFO 获取失败');
        return;
    }

    const historyData = apiData.data.history;
    const torrent = historyData[0];
    const { torrent_tree: torrentTree, torrent_size: torrentSize } = torrent;

    if (isNaN(torrentSize)) {
        logger.addLog('API 种子体积获取失败');
    } else {
        const sizeApiData = await fetchApi('search_torrents_size', { token, size: torrentSize, uid: userId });

        if (sizeApiData.msg !== 'success') {
            logger.addLog('API SIZE 获取失败');
        } else {
            console.log(sizeApiData.data.torrents);

            sizeApiData.data.torrents.forEach(({ torrent_id: _torrentId, banned: _banned, deleted: _deleted }) => {
                if (String(_torrentId) === torrentId) return; // 跳过与自身 ID 相同的种子
                let ban_status = _banned ? ' (屏蔽)' : '';
                let del_status = _deleted ? ' (删除)' : '';
                logger.addLog(`体积相同 → <a href="https://u2.dmhy.org/details.php?id=${_torrentId}&hit=1" target="_blank">#${_torrentId}${ban_status}${del_status}</a>`);
            });
        }

    }

    console.log(torrentTree);
    check(torrentTree);
    logger.addLog('完成');

    logger.renderLogs('mod_check');

    const aTag = document.querySelector("#top a");
    const textInsideATag = aTag.textContent;
    const newTextElement = document.createTextNode(textInsideATag);
    aTag.replaceWith(newTextElement);

})();


function check(directory) {
    // 垃圾文件夹的名称
    const junkFolders = new Set(["makemkv", "any!", "xrvl", "fab!"]);

    // 垃圾文件的完整名称
    const junkFiles = new Set([".ds_store", "thumbs.db", "disc.inf"]);

    // 垃圾文件后缀名
    const junkFileExtensions = new Set([".m3u8", ".m3u", ".lwi", ".bat", ".md5", ".nfo", ".accurip", ".miniso"]);

    // 可疑文件后缀名
    const suspiciousFileExtensions = new Set([".txt"]);

    // 必须存在的 BDMV 文件和目录
    const bdmvStructure = {
        files: ["index.bdmv", "MovieObject.bdmv"],
        directories: ["BACKUP", "CLIPINF", "PLAYLIST", "STREAM"]
    };

    // 不可见字符
    const invisibleCharPattern = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF\u200E]/g;

    // Windows 系统中不允许的字符
    const invalidCharsPattern = /[<>:"/\\|?*]/g;

    // 用栈模拟递归
    let stack = [];
    stack.push({ directory, currentPath: '' });

    // 迭代栈，直到栈为空
    while (stack.length > 0) {
        const { directory, currentPath } = stack.pop();

        // 遍历目录中的每个子项
        for (const [key, item] of Object.entries(directory)) {
            const lowerKey = key.toLowerCase(); // 将文件名或文件夹名转为小写
            const fullPath = `${currentPath}/${key}`; // 构造当前文件或文件夹的绝对路径

            // 检查文件或文件夹名中是否包含非法字符
            const invalidCharsMatches = key.match(invalidCharsPattern);
            if (invalidCharsMatches) {
                // const invalidChars = invalidCharsMatches.join(', ');
                const invalidChars = Array.from(new Set(invalidCharsMatches)).join(', ');
                logger.addLog(`非法字符 → ${invalidChars} - ${fullPath}`); // 输出包含非法字符的路径和字符
            }

            // 检查是否存在不可见字符
            const invisibleCharMatches = key.match(invisibleCharPattern);
            if (invisibleCharMatches) {
                // 将不可见字符转换为 Unicode 转义序列
                // const unicodeChars = invisibleCharMatches.map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', ');
                const unicodeChars = Array.from(new Set(invisibleCharMatches))
                    .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', '); // 去重并转换为 Unicode
                logger.addLog(`不可见字符 → ${unicodeChars} - ${fullPath}`);
            }

            // 如果是目录，则将目录压入栈中
            if (item.type === "directory") {
                if (junkFolders.has(lowerKey)) {
                    logger.addLog(`垃圾文件夹 → ${fullPath}`); // 输出垃圾文件夹的绝对路径
                }

                // 检测是否为 BDMV 文件夹
                if (lowerKey === "bdmv") {
                    // 检测 BDMV 文件夹是否有缺失
                    checkBDMV(item.children, fullPath, bdmvStructure);
                }

                // 将子目录压入栈中
                stack.push({ directory: item.children, currentPath: fullPath });
            }
            // 如果是文件
            else if (item.type === "file") {
                // 如果文件大小为 0
                if (item.length === 0) {
                    logger.addLog(`空文件 → ${fullPath}`); // 输出空文件的绝对路径
                }

                // 检查是否是垃圾文件（通过完整名称匹配）
                if (junkFiles.has(lowerKey)) {
                    logger.addLog(`垃圾文件 → ${fullPath}`); // 输出垃圾文件的绝对路径
                }
                // 检查是否是垃圾文件后缀
                else if (junkFileExtensions.has("." + lowerKey.split('.').pop())) {
                    logger.addLog(`垃圾文件 → ${fullPath}`); // 输出带垃圾后缀的文件路径
                }
                // 检查是否是可疑文件后缀
                else if (suspiciousFileExtensions.has("." + lowerKey.split('.').pop())) {
                    logger.addLog(`可疑文件 → ${fullPath}`); // 输出可疑文件的绝对路径
                }
            }
        }
    }
}


function checkBDMV(directory, currentPath, structure) {
    // console.log(directory, currentPath, structure);

    const presentFiles = new Set(Object.keys(directory).map(key => key.toLowerCase()));

    // 检测必需的文件是否缺失
    structure.files.forEach(file => {
        if (!presentFiles.has(file.toLowerCase())) {
            logger.addLog(`BDMV 缺失文件 → ${currentPath}/${file}`);
        }
    });

    // 检测必需的子目录是否缺失
    structure.directories.forEach(dir => {
        if (!presentFiles.has(dir.toLowerCase())) {
            logger.addLog(`BDMV 缺失目录 → ${currentPath}/${dir}`);
        }
    });

    // 检测 BACKUP 目录是否存在
    if (presentFiles.has('backup')) {
        // log(`检测到 BACKUP 目录 ${currentPath}/BACKUP`);

        // 检查 BACKUP 目录结构是否与主目录一致
        const backupDirectory = directory['BACKUP'].children;
        checkBackup(backupDirectory, directory, currentPath);  // 比较 BACKUP 目录与主 BDMV 目录
    }

    // 检测 STREAM 和 CLIPINF 目录
    if (presentFiles.has('stream') && presentFiles.has('clipinf')) {
        // log(`检测到 STREAM 和 CLIPINF 目录 ${currentPath}/STREAM 和 ${currentPath}/CLIPINF`);

        const streamDirectory = directory['STREAM'].children;
        const clipinfDirectory = directory['CLIPINF'].children;

        // 调用 checkClipInfo 函数，检测 STREAM 和 CLIPINF 文件的对应关系
        checkClipInfo(streamDirectory, clipinfDirectory, currentPath);
    }
}


// 检查 BACKUP 目录和主 BDMV 目录是否一致
function checkBackup(backupDirectory, mainDirectory, currentPath) {
    // 必须备份的文件和文件夹
    const requiredBackupItems = {
        files: ['index.bdmv', 'MovieObject.bdmv'],
        directories: ['CLIPINF', 'PLAYLIST']
    };

    // 检查必需备份的文件
    requiredBackupItems.files.forEach(file => {
        const mainFileExists = mainDirectory[file];
        const backupFileExists = backupDirectory[file];

        if (!backupFileExists && mainFileExists) {
            logger.addLog(`BDMV/BACKUP 缺失文件 → ${currentPath}/BACKUP/${file}`);
        }
    });

    // 检查必需备份的文件夹并比较文件
    requiredBackupItems.directories.forEach(dir => {
        const mainSubDir = mainDirectory[dir];
        const backupSubDir = backupDirectory[dir];
        const innerPath = `${currentPath}/BACKUP/${dir}`;

        if (!backupSubDir && mainSubDir) {
            logger.addLog(`BDMV/BACKUP 缺失目录 → ${innerPath}`);
        } else if (backupSubDir && mainSubDir) {
            // 比较文件夹中的文件 (.clpi / .m2ts)
            compareFilesInDirectory(backupSubDir.children, mainSubDir.children, innerPath);
        }
    });
}


// 比较主目录和 BACKUP 目录中的文件
function compareFilesInDirectory(backupFiles, mainFiles, currentPath) {
    const mainFileSet = new Set(Object.keys(mainFiles));
    const backupFileSet = new Set(Object.keys(backupFiles));

    mainFileSet.forEach(file => {
        const mainFile = mainFiles[file];
        const backupFile = backupFiles[file];

        if (!backupFile) {
            logger.addLog(`BDMV/BACKUP 缺失文件 → ${currentPath}/${file}`);
        } else {
            // 检查文件大小是否不同
            if (mainFile.length !== backupFile.length) {
                logger.addLog(`BDMV/BACKUP 文件大小不匹配 → ${currentPath}/${file}`);
            }
        }
    });

    backupFileSet.forEach(file => {
        if (!mainFileSet.has(file)) {
            logger.addLog(`BDMV/BACKUP 多余文件 → ${currentPath}/BACKUP/${file}`);
        }
    });
}


// 检测 .clpi 文件是否与 .m2ts 文件对应
function checkClipInfo(streamDirectory, clipinfDirectory, currentPath) {
    const m2tsFiles = Object.keys(streamDirectory)
        .filter(key => key.toLowerCase().endsWith('.m2ts'))
        .map(key => key.toLowerCase().replace('.m2ts', ''));

    const clpiFiles = Object.keys(clipinfDirectory)
        .filter(key => key.toLowerCase().endsWith('.clpi'))
        .map(key => key.toLowerCase().replace('.clpi', ''));

    // 比对两个文件夹的文件
    m2tsFiles.forEach(file => {
        if (!clpiFiles.includes(file)) {
            logger.addLog(`缺少对应的 CLIPINF 文件 → ${currentPath}/CLIPINF/${file}.clpi`);
        }
    });

    clpiFiles.forEach(file => {
        if (!m2tsFiles.includes(file)) {
            logger.addLog(`缺少对应的 STREAM 文件 → ${currentPath}/STREAM/${file}.m2ts`);
        }
    });
}


async function fetchApi(endpoint, params) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const response = await fetch(`https://u2.kysdm.com/api/v1/${endpoint}?${queryString}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-cache'
        });

        if (!response.ok) {
            logger.addLog(`API 请求失败 → ${endpoint}: HTTP ${response.status}`);
            return { msg: 'error' };
        }
        return await response.json();
    } catch (error) {
        logger.addLog(`API 请求异常 → ${endpoint}: ${error.message}`);
        return { msg: 'error' };
    }
}
