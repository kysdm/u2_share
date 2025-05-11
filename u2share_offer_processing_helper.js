// ==UserScript==
// @name         U2候选处理辅助
// @namespace    https://u2.dmhy.org/
// @version      0.3.7
// @description  U2候选处理辅助
// @author       kysdm
// @match        *://u2.dmhy.org/offers.php?*
// @match        *://u2.dmhy.org/details.php?*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js
// @downloadURL  https://scriptcat.org/scripts/code/3079/U2%E5%80%99%E9%80%89%E5%A4%84%E7%90%86%E8%BE%85%E5%8A%A9.user.js
// @updateURL    https://scriptcat.org/scripts/code/3079/U2%E5%80%99%E9%80%89%E5%A4%84%E7%90%86%E8%BE%85%E5%8A%A9.user.js
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
// https://u2.dmhy.org/offers.php?id=60537&off_details=1
// https://u2.dmhy.org/details.php?id=60981 - 55cde51dafb8eb6a72adfc3034ba6d7507bfe27d
// https://u2.dmhy.org/details.php?id=29446&hit=1 - 79021415017f7a4302fa59705f9e355952b41ad4

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
    const torrentId = getTorrentId(); // 当前种子ID
    if (!torrentId) return;

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
    const { torrent_tree: torrentTree, torrent_size: torrentSize, torrent_piece_length: torrentPieceLength } = torrent;

    if (torrentPieceLength > 16 * 1024 * 1024) {
        logger.addLog(`区块过大  → ${torrentPieceLength / (1024 * 1024)}MB`);
        // 可以加入通过种子体积判断是否超过允许区块大小，但是大种子太少了，鸽了
    }

    if (isNaN(torrentSize)) {
        logger.addLog('API 种子体积获取失败');
    } else {
        const sizeApiData = await fetchApi('search_torrents_size', { token, size: torrentSize, uid: userId });

        if (sizeApiData.msg !== 'success') {
            logger.addLog('API SIZE 获取失败');
        } else {
            // console.log(sizeApiData.data.torrents);

            sizeApiData.data.torrents.forEach(({ torrent_id: _torrentId, banned: _banned, deleted: _deleted }) => {
                if (String(_torrentId) === torrentId) return; // 跳过与自身 ID 相同的种子
                let ban_status = _banned ? ' (屏蔽)' : '';
                let del_status = _deleted ? ' (删除)' : '';
                logger.addLog(`体积相同 → <a href="https://u2.dmhy.org/details.php?id=${_torrentId}&hit=1" target="_blank">#${_torrentId}${ban_status}${del_status}</a>`);
            });
        }

    }

    // console.log(torrentTree);
    check(torrentTree);
    logger.addLog('完成');

    logger.renderLogs('mod_check');

    const aTag = document.querySelector("#top a");
    const textInsideATag = aTag.textContent;
    const newTextElement = document.createTextNode(textInsideATag);
    aTag.replaceWith(newTextElement);

})();


function getTorrentId() {
    const params = new URLSearchParams(location.search);

    // 如果是评论页面，则不处理
    if (params.has('cmtpage')) {
        return null;
    }

    // 获取 torrent_id 参数
    const id = params.get('id');

    // 判断 id 是否为3到5位数字
    if (id && /^\d{3,5}$/.test(id)) {
        return id;
    }

    return null;
}

const getFileExtension = (filePath) => {
    const ext = filePath.split('.').pop().toLowerCase();
    return ext === filePath ? '' : ext; // 如果没有扩展名，则返回空字符串
}


const pathBasedRules = [
    { pattern: /\/CERTIFICATE(\/BACKUP)?\/$/, allowedFileNames: /^id\.bdmv$|^(app|bu)\.discroot\.crt$|^online\.crl$|^online\.crt$|^online\.sig$/ },
    { pattern: /\/BDMV\/AUXDATA\/$/, allowedFileNames: /^(dvb.fontindex|_dsa_version_|bdtmdlist\.xml|sound\.bdmv|\d{5}\.otf)$/ },
    { pattern: /\/BDMV\/STREAM\/$/, allowedFileNames: /^\d{5}\.m2ts$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/JAR\/\d{5}\//, allowedFileNames: /^.+\.(png|txt|csv|xml|aca|bdmv|properties)$|^bluray_project\.bin$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/JAR\/$/, allowedFileNames: /^\d{5}\.jar$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/BDJO\/$/, allowedFileNames: /^\d{5}\.bdjo$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/PLAYLIST\/$/, allowedFileNames: /^\d{5}\.mpls$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/CLIPINF\/$/, allowedFileNames: /^\d{5}\.clpi$/ },
    // { pattern: /\/BDMV(\/BACKUP)?\/JAR\/00000\/$/, allowedFileNames: /^(main\.0\.aca|main\.1\.png|map\.txt)$/ },
    { pattern: /\/BDMV\/META\/DL\/$/, allowedFileNames: /^bdmt_(eng|jpn|deu|fra|ita|nld|spa|zho|kor)\.xml$|^[^\/]+\.jpg$|^(discinfo|disclib|titleinfo)\.xsd$/ },
    { pattern: /\/BDMV(\/BACKUP)?\/$/, allowedFileNames: /^(MovieObject|index)\.bdmv$/ },
    { pattern: /\/VIDEO_TS\/$/, allowedFileNames: /^(VIDEO_TS|VTS_\d{2}_\d)\.(BUP|IFO|VOB)$/ },
    { pattern: /\/scans?(?:[^\/]+\/){1,5}$/i, allowedFileNames: /[^\/]+\.(bmp|tif|tiff|png|jpg|webp|jxl)$/i },  // 确保扫描文件夹中只包含图片文件
    { pattern: /^\/(?:[^\/]+\/){0,5}$/, allowedFileNames: /[^\/]+\.(iso|mds|mkv|ts|mp4|png|jpg|bmp|webp|tif|tiff|flac|wav|aiff|m4a|cue|log)$/i },  // 0-5层文件夹
];

function isFileNameValidForPath(filePath, fileName) {
    const rule = pathBasedRules.find(rule => rule.pattern.test(getDirectoryFromPath(filePath, fileName)));
    if (rule) {
        if (rule.allowedFileNames.test(fileName)) {
            console.debug({ filePath, ...rule });
            return true;
        }
    }
    console.warn({ filePath, pattern: null, allowedFileNames: null });
    return false;
}

function getDirectoryFromPath(absolutePath, fileName) {
    // 如果绝对路径和文件名完全相等，则说明是单文件
    if (absolutePath === fileName) {
        return absolutePath;
    }

    // 定位文件名在路径中最后一次出现的位置
    const index = absolutePath.lastIndexOf(fileName);
    // 确保文件名位于路径末尾
    if (index !== -1 && index + fileName.length === absolutePath.length) {
        return absolutePath.substring(0, index);
    }

    return null;
}

function hasNestedBDMV(directory) {
    // 查找当前目录树中是否存在嵌套的 BDMV 文件夹
    for (const [name, item] of Object.entries(directory)) {
        if (item.type === "directory") {
            if (name.toLowerCase() === "bdmv") {
                // 发现更深层的 BDMV，立刻返回 true
                return true;
            }
            // 否则继续在子目录里查找
            if (hasNestedBDMV(item.children)) {
                return true;
            }
        }
    }
    return false;
}

function check(directory) {
    // 垃圾文件夹的名称
    const junkFolders = new Set(["makemkv", "any!", "xrvl", "fab!"]);

    // 垃圾文件的完整名称
    const junkFiles = new Set([".ds_store", "thumbs.db", "disc.inf"]);

    // 垃圾文件扩展名
    const junkFileExtensions = new Set([".m3u8", ".m3u", ".lwi", ".bat", ".md5", ".nfo", ".accurip", ".miniso"]);

    // 可疑文件扩展名 <总感觉会漏，还是维护白名单吧>
    // const suspiciousFileExtensions = new Set([".txt", ".xml"]);

    // 必须存在的 BDMV 文件和目录
    const bdmvStructure = {
        files: ["index.bdmv", "MovieObject.bdmv"],
        directories: ["BACKUP", "CLIPINF", "PLAYLIST", "STREAM"]
    };

    // 不可见字符
    const invisibleCharPattern = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF\u200E]/g;

    // 日文变音符号
    const japaneseDiacriticPattern = /[\u3099-\u309c]/g;

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

            // 检查是否存在日文变音符号
            const japaneseDiacriticMatches = key.match(japaneseDiacriticPattern);
            if (japaneseDiacriticMatches) {
                const unicodeChars = Array.from(new Set(japaneseDiacriticMatches))
                    .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', '); // 去重并转换为 Unicode
                logger.addLog(`日文变音符号 → ${unicodeChars} - ${fullPath}`);
            }

            // 如果是目录，则将目录压入栈中
            if (item.type === "directory") {
                if (junkFolders.has(lowerKey)) {
                    logger.addLog(`垃圾文件夹 → ${fullPath}`); // 输出垃圾文件夹的绝对路径
                    continue;  // 如果是垃圾文件夹，那么内部的文件都没用
                }
                // 检测是否为 BDMV 文件夹
                else if (lowerKey === "bdmv" && !hasNestedBDMV(item.children)) {
                    // 检测 BDMV 文件夹是否有缺失
                    checkBDMV(item.children, fullPath, bdmvStructure);
                }
                // 将子目录压入栈中
                stack.push({ directory: item.children, currentPath: fullPath });
            }
            // 如果是文件
            else if (item.type === "file") {
                const ext = getFileExtension(lowerKey);
                // const isValidExt = ext.length > 0 && ext.length <= 5;  // 扩展名长度检查

                // 如果文件大小为 0
                if (item.length === 0) {
                    logger.addLog(`空文件 → ${fullPath}`); // 输出空文件的绝对路径
                }
                else if (!isFileNameValidForPath(fullPath, key)) {
                    // 检查是否是垃圾文件（通过完整名称匹配）
                    if (junkFiles.has(lowerKey)) {
                        logger.addLog(`垃圾文件 → ${fullPath}`); // 输出垃圾文件的绝对路径
                    }
                    // 检查是否是垃圾文件后缀
                    else if (junkFileExtensions.has("." + ext)) {
                        logger.addLog(`垃圾文件 → ${fullPath}`); // 输出带垃圾后缀的文件路径
                    }
                    // 检查扩展名是否合法
                    else if (ext.length < 1) {
                        logger.addLog(`缺少扩展名 → ${fullPath}`);
                    }
                    // 扩展名长度检查
                    // else if (!isValidExt) {
                    //     logger.addLog(`扩展名长度异常 → ${fullPath}`); // 输出扩展名长度异常的文件路径
                    // }
                    // // 检查是否是可疑文件后缀
                    // else if (!allowedFileExtensions.has("." + ext)) {
                    //     logger.addLog(`可疑文件 → ${fullPath}`); // 输出可疑文件的绝对路径
                    // }
                    else {
                        logger.addLog(`可疑文件 → ${fullPath}`); // 输出可疑文件的绝对路径
                    }
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
            logger.addLog(`BDMV/BACKUP 多余文件 → ${currentPath}/${file}`);
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
