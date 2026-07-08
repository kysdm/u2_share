// ==UserScript==
// @name         U2候选处理辅助
// @namespace    https://u2.dmhy.org/
// @version      0.4.8
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
// https://u2.dmhy.org/details.php?id=60981 - 55cde51dafb8eb6a72adfc3034ba6d7507bfe27d
// https://u2.dmhy.org/details.php?id=29446&hit=1 - 79021415017f7a4302fa59705f9e355952b41ad4
// https://u2.dmhy.org/details.php?id=43720 - m2ts 体积错误
// https://u2.dmhy.org/offers.php?id=65466&off_details=1 - BD 缺失 BACKUP 目录

'use strict';

(() => {
    const style = document.createElement('style');
    style.innerHTML = `
        .char-box-rounded {
            display: inline-block;
            border: 1.5px solid;
            border-radius: 6px;
            padding: 1px 2px;
            margin: 0 2px;
            line-height: 1.1;
        }
    `;
    document.head.appendChild(style);
})();

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

    // 移除候选种子标题超链接
    const aTag = document.querySelector("#top a");
    if (aTag) {
        const textInsideATag = aTag.textContent;
        const newTextElement = document.createTextNode(textInsideATag);
        aTag.replaceWith(newTextElement);
    }

    const newRow = `
    <tr>
        <td class="rowhead nowrap" valign="top" align="right">检查</td>
        <td class="rowfollow" valign="top" align="left" id="mod_check"></td>
    </tr>
`;

    $('#top').nextAll('table').first().find('tr:first').before(newRow);

    const apiData = await fetchApi(`/torrents/${torrentId}/history`, { limit: 1 }, 'GET', token);

    if (apiData.message !== 'success') {
        $('#mod_check').html('API INFO 获取失败');
        return;
    }

    const historyData = apiData.data.items;
    const torrent = historyData[0];
    const { torrent_tree: torrentTree, torrent_size: torrentSize, torrent_piece_length: torrentPieceLength } = torrent;

    if (torrentPieceLength > 16 * 1024 * 1024) {
        logger.addLog(`区块过大  → ${torrentPieceLength / (1024 * 1024)}MB`);
        // 可以加入通过种子体积判断是否超过允许区块大小，但是大种子太少了，鸽了
    }

    if (isNaN(torrentSize)) {
        logger.addLog('API 种子体积获取失败');
    } else {
        const sizeApiData = await fetchApi(`/torrents/search/by-size`, { size: torrentSize }, 'GET', token);

        if (sizeApiData.message !== 'success') {
            logger.addLog('API SIZE 获取失败');
        } else {
            // console.log(sizeApiData.data.torrents);

            sizeApiData.data.items.forEach(({ torrent_id: _torrentId, banned: _banned, deleted: _deleted }) => {
                if (String(_torrentId) === torrentId) return; // 跳过与自身 ID 相同的种子
                let ban_status = _banned ? ' (屏蔽)' : '';
                let del_status = _deleted ? ' (删除)' : '';
                logger.addLog(`体积相同 → <a href="https://u2.dmhy.org/details.php?id=${_torrentId}&hit=1" target="_blank">#${_torrentId}${ban_status}${del_status}</a>`);
            });
        }

    }

    // console.log(torrentTree);
    check(torrentTree);
    // 检查 BDMV / CERTIFICATE 与各自 BACKUP 目录下的文件是否相同
    await handleTorrentChecksum(userId, token, torrentId);

    logger.addLog('完成');

    logger.renderLogs('mod_check');

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
    { pattern: /\/(?:scans?|bk)\/(?:[^\/]+\/){0,3}$/i, allowedFileNames: /[^\/]+\.(bmp|tif|tiff|png|jpg|jpeg|webp|jxl)$/i },  // 确保扫描文件夹中只包含图片文件
    { pattern: /^\/(?:[^\/]+\/){0,5}$/, allowedFileNames: /[^\/]+\.(iso|mds|mkv|ts|mp4|png|jpg|jpeg|bmp|webp|tif|tiff|flac|wav|aiff|m4a|cue|log)$/i },  // 0-5层文件夹
];

function isFileNameValidForPath(filePath, fileName) {
    const directoryPath = getDirectoryFromPath(filePath, fileName)
    const rule = pathBasedRules.find(rule => rule.pattern.test(directoryPath));
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
    const junkFolders = new Set(["makemkv", "any!", "xrvl", "fab!", "aac!"]);

    // 垃圾文件的完整名称
    const junkFiles = new Set([".ds_store", "thumbs.db", "disc.inf"]);

    // 垃圾文件扩展名
    const junkFileExtensions = new Set([".m3u8", ".m3u", ".lwi", ".bat", ".md5", ".nfo", ".accurip", ".miniso"]);

    // 可疑文件扩展名 <总感觉会漏，还是维护白名单吧>
    // const suspiciousFileExtensions = new Set([".txt", ".xml"]);

    // BD 目录的最小完整性要求。
    // BDMV 和 CERTIFICATE 在标准 Blu-ray 目录结构中应当作为同级目录出现，
    // 因此这里用同一张配置表维护两类目录的必需项、同级依赖和专属检查函数。
    // 遍历目录树时只需要查表并调用 checkBluRayDirectory，避免在主循环里分别写两套分支。
    const bluRayStructures = {
        bdmv: {
            label: 'BDMV',
            peerDirectory: 'CERTIFICATE',
            files: ["index.bdmv", "MovieObject.bdmv"],
            directories: ["BACKUP", "CLIPINF", "PLAYLIST", "STREAM"],
            shouldSkip: hasNestedBDMV,
            checker: checkBDMV
        },
        certificate: {
            label: 'CERTIFICATE',
            peerDirectory: 'BDMV',
            files: ["id.bdmv"],
            directories: ["BACKUP"],
            checker: checkCertificate
        }
    };

    // 不可见字符
    const invisibleCharPattern = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF\u200E]/g;

    // 日文变音符号
    const japaneseDiacriticPattern = /(.[\u3099\u309A])/g;

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
                const highlightedPath = key.replace(invalidCharsPattern, char =>
                    `<span class="char-box-rounded">${char}</span>`
                );
                logger.addLog(`非法字符 → ${invalidChars} - ${highlightedPath}`); // 输出包含非法字符的路径和字符
            }

            // 检查是否存在不可见字符
            const invisibleCharMatches = key.match(invisibleCharPattern);
            if (invisibleCharMatches) {
                // 将不可见字符转换为 Unicode 转义序列
                // const unicodeChars = invisibleCharMatches.map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', ');
                const unicodeChars = Array.from(new Set(invisibleCharMatches))
                    .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', '); // 去重并转换为 Unicode
                // 将 fullPath 中的不可见字符替换成带下划线的 Unicode 字符
                const highlightedPath = key.replace(invisibleCharPattern, char =>
                    `<span class="char-box-rounded">\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}</span>`
                );
                logger.addLog(`不可见字符 → ${unicodeChars} - ${currentPath}/${highlightedPath}`);
            }

            // 检查是否存在日文变音符号
            const japaneseDiacriticMatches = key.match(japaneseDiacriticPattern);
            if (japaneseDiacriticMatches) {
                const unicodeChars = Array.from(new Set(japaneseDiacriticMatches))
                    .map(m => `\\u${m.charCodeAt(1).toString(16).padStart(4, '0')}`)
                    .join(', ');
                const highlightedPath = fullPath.replace(japaneseDiacriticPattern, (match) => {
                    const diacriticUnicode = match.charCodeAt(1).toString(16).padStart(4, '0');
                    return `<span class="char-box-rounded">${match} \\u${diacriticUnicode}</span>`;
                });
                logger.addLog(`日文变音符号 → ${unicodeChars} - ${highlightedPath}`);
            }

            // 如果是目录，则将目录压入栈中
            if (item.type === "directory") {
                if (junkFolders.has(lowerKey)) {
                    logger.addLog(`垃圾文件夹 → ${fullPath}`); // 输出垃圾文件夹的绝对路径
                    continue;  // 如果是垃圾文件夹，那么内部的文件都没用
                }
                else {
                    const bluRayStructure = bluRayStructures[lowerKey];
                    if (bluRayStructure && !bluRayStructure.shouldSkip?.(item.children)) {
                        checkBluRayDirectory(directory, currentPath, key, item.children, bluRayStructure);
                    }
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


/**
 * Blu-ray 目录完整性检查的统一入口。
 *
 * 主循环只负责发现当前目录名是否命中 bluRayStructures 配置表；
 * 命中后由本函数统一完成两件事：
 * - 检查 BDMV / CERTIFICATE 是否在同一父目录中成对出现
 * - 调用该目录自己的 checker 处理必需项、BACKUP 和其它专属规则
 *
 * @param {Object} parentDirectory - 当前 BD 目录的父目录对象，用于查找同级目录。
 * @param {string} parentPath - 父目录路径，用于输出缺失同级目录的日志。
 * @param {string} directoryName - 实际命中的目录名，保留原始大小写用于拼接路径。
 * @param {Object} directory - 当前 BD 目录对象。
 * @param {Object} structure - bluRayStructures 中对应的规则配置。
 */
function checkBluRayDirectory(parentDirectory, parentPath, directoryName, directory, structure) {
    // BDMV 与 CERTIFICATE 必须同级出现。
    // 通过配置表中的 peerDirectory 做互检，可以同时覆盖：
    // - 只有 BDMV、缺少 CERTIFICATE
    // - 只有 CERTIFICATE、缺少 BDMV
    const peerItem = getDirectoryItem(parentDirectory, structure.peerDirectory);
    if (!peerItem || peerItem.type !== 'directory') {
        logger.addLog(`${structure.peerDirectory} 缺失目录 → ${parentPath}/${structure.peerDirectory}`);
    }

    structure.checker(directory, `${parentPath}/${directoryName}`, structure);
}


/**
 * 检查 BDMV 目录的结构完整性。
 *
 * 通用部分交给 checkDiscStructure：
 * - BDMV 根目录下必须存在 index.bdmv / MovieObject.bdmv
 * - BDMV 根目录下必须存在 BACKUP / CLIPINF / PLAYLIST / STREAM
 *
 * BDMV 特有部分在本函数处理：
 * - BACKUP 中的关键文件、CLIPINF、PLAYLIST 需要与主目录对应
 * - STREAM 与 CLIPINF 的编号需要一一对应
 * - STREAM 下的 m2ts 文件体积应为 192 字节的倍数
 */
function checkBDMV(directory, currentPath, structure) {
    checkDiscStructure('BDMV', directory, currentPath, structure);

    // 检测 BACKUP 目录是否存在
    const backupItem = getDirectoryItem(directory, 'BACKUP');
    if (backupItem && backupItem.type === 'directory') {
        // log(`检测到 BACKUP 目录 ${currentPath}/BACKUP`);

        // 检查 BACKUP 目录结构是否与主目录一致
        checkBackup(backupItem.children, directory, currentPath);  // 比较 BACKUP 目录与主 BDMV 目录
    }

    // 检测 STREAM 和 CLIPINF 目录
    const streamItem = getDirectoryItem(directory, 'STREAM');
    const clipinfItem = getDirectoryItem(directory, 'CLIPINF');
    if (streamItem && streamItem.type === 'directory' && clipinfItem && clipinfItem.type === 'directory') {
        // log(`检测到 STREAM 和 CLIPINF 目录 ${currentPath}/STREAM 和 ${currentPath}/CLIPINF`);

        const streamDirectory = streamItem.children;
        const clipinfDirectory = clipinfItem.children;

        // 调用 checkClipInfo 函数，检测 STREAM 和 CLIPINF 文件的对应关系
        checkClipInfo(streamDirectory, clipinfDirectory, currentPath);

        // 检测 M2TS 文件体积
        checkStreamFileSize(streamDirectory, currentPath);
    }
}

/**
 * 检查 CERTIFICATE 目录的结构完整性。
 *
 * CERTIFICATE 的规则比 BDMV 简单：
 * - 根目录必须存在 id.bdmv
 * - 根目录必须存在 BACKUP
 * - 如果 BACKUP 存在，则 BACKUP/id.bdmv 需要与根目录 id.bdmv 对应
 */
function checkCertificate(directory, currentPath, structure) {
    checkDiscStructure('CERTIFICATE', directory, currentPath, structure);

    // 如果 BACKUP 目录已经由 checkDiscStructure 报过缺失，这里直接结束，避免重复报错。
    const backupItem = getDirectoryItem(directory, 'BACKUP');
    if (!backupItem || backupItem.type !== 'directory') return;

    compareBackupFiles('CERTIFICATE/BACKUP', backupItem.children, directory, currentPath, structure.files);
}

/**
 * 从目录对象中按名称取子项，忽略大小写。
 *
 * 种子文件列表里目录名通常是标准大写，但真实发布中偶尔会出现大小写变化。
 * 检查完整性时不应因为 BACKUP / backup 这种大小写差异导致脚本取不到对象并报错。
 */
function getDirectoryItem(directory, itemName) {
    const lowerItemName = itemName.toLowerCase();
    const key = Object.keys(directory).find(key => key.toLowerCase() === lowerItemName);
    return key ? directory[key] : null;
}

/**
 * 通用目录结构检查。
 *
 * @param {string} label - 日志中使用的目录名，例如 BDMV 或 CERTIFICATE。
 * @param {Object} directory - 当前要检查的目录对象。
 * @param {string} currentPath - 当前目录在种子中的路径，用于输出日志。
 * @param {{ files: string[], directories: string[] }} structure - 必需文件和必需目录清单。
 */
function checkDiscStructure(label, directory, currentPath, structure) {
    structure.files.forEach(file => {
        const item = getDirectoryItem(directory, file);
        if (!item) {
            logger.addLog(`${label} 缺失文件 → ${currentPath}/${file}`);
        } else if (item.type !== 'file') {
            logger.addLog(`${label} 类型错误 → ${currentPath}/${file} 应为文件`);
        }
    });

    structure.directories.forEach(dir => {
        const item = getDirectoryItem(directory, dir);
        if (!item) {
            logger.addLog(`${label} 缺失目录 → ${currentPath}/${dir}`);
        } else if (item.type !== 'directory') {
            logger.addLog(`${label} 类型错误 → ${currentPath}/${dir} 应为目录`);
        }
    });
}

/**
 * 比较主目录与 BACKUP 目录中指定文件的存在性和大小。
 *
 * 这里只比较“必须备份”的文件：
 * - BDMV 使用 index.bdmv / MovieObject.bdmv
 * - CERTIFICATE 使用 id.bdmv
 *
 * 更完整的内容一致性比较会在 handleTorrentChecksum 中通过 SHA256 完成。
 */
function compareBackupFiles(label, backupDirectory, mainDirectory, currentPath, files) {
    files.forEach(file => {
        const mainFile = getDirectoryItem(mainDirectory, file);
        const backupFile = getDirectoryItem(backupDirectory, file);

        if (!backupFile && mainFile) {
            logger.addLog(`${label} 缺失文件 → ${currentPath}/BACKUP/${file}`);
        } else if (backupFile && mainFile && mainFile.length !== backupFile.length) {
            logger.addLog(`${label} 文件大小不匹配 → ${currentPath}/BACKUP/${file}`);
        }
    });
}

// 检测 M2TS 文件体积是否为 192 的倍数
function checkStreamFileSize(streamDirectory, currentPath) {
    for (const [name, file] of Object.entries(streamDirectory)) {
        if (name.toLowerCase().endsWith('.m2ts')) {
            const size = file.length;
            if (size % 192 !== 0) {
                logger.addLog(`体积非 192 的倍数 (余${size % 192}) → ${currentPath}/STREAM/${name}`);
            }
        }
    }
}

// 检查 BACKUP 目录和主 BDMV 目录是否一致
function checkBackup(backupDirectory, mainDirectory, currentPath) {
    // 必须备份的文件和文件夹
    const requiredBackupItems = {
        files: ['index.bdmv', 'MovieObject.bdmv'],
        directories: ['CLIPINF', 'PLAYLIST']
    };

    compareBackupFiles('BDMV/BACKUP', backupDirectory, mainDirectory, currentPath, requiredBackupItems.files);

    // 检查必需备份的文件夹并比较文件
    requiredBackupItems.directories.forEach(dir => {
        const mainSubDir = getDirectoryItem(mainDirectory, dir);
        const backupSubDir = getDirectoryItem(backupDirectory, dir);
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
    const mainFileMap = new Map(Object.keys(mainFiles).map(file => [file.toLowerCase(), file]));
    const backupFileMap = new Map(Object.keys(backupFiles).map(file => [file.toLowerCase(), file]));

    mainFileMap.forEach((mainFileName, lowerFileName) => {
        const backupFileName = backupFileMap.get(lowerFileName);
        const mainFile = mainFiles[mainFileName];
        const backupFile = backupFileName ? backupFiles[backupFileName] : null;

        if (!backupFile) {
            logger.addLog(`BDMV/BACKUP 缺失文件 → ${currentPath}/${mainFileName}`);
        } else {
            // 检查文件大小是否不同
            if (mainFile.length !== backupFile.length) {
                logger.addLog(`BDMV/BACKUP 文件大小不匹配 → ${currentPath}/${backupFileName}`);
            }
        }
    });

    backupFileMap.forEach((backupFileName, lowerFileName) => {
        if (!mainFileMap.has(lowerFileName)) {
            logger.addLog(`BDMV/BACKUP 多余文件 → ${currentPath}/${backupFileName}`);
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


/**
 * 比较 BD 目录中 BACKUP 文件与主文件的 SHA256。
 *
 * API 返回的是扁平文件列表，形如：
 * - xxx/BDMV/index.bdmv
 * - xxx/BDMV/BACKUP/index.bdmv
 * - xxx/CERTIFICATE/id.bdmv
 * - xxx/CERTIFICATE/BACKUP/id.bdmv
 *
 * 本函数先按 BDMV / CERTIFICATE 根路径分组，再把 BACKUP 文件路径中的
 * "/BACKUP/" 去掉，得到它理论上对应的主文件路径，最后比较两者 hash。
 *
 * @param {Array} fileList - 文件信息数组，每个元素包含 hash 和 path 属性。
 * @returns {Array<{ path: string, backupRoot: string }>} - hash 不匹配的 BACKUP 文件及其根目录类型。
 */
function getMismatchedDiscBackups(fileList) {
    const discGroups = {};
    const backupRoots = ['BDMV', 'CERTIFICATE'];

    // 按 BDMV / CERTIFICATE 根路径分组
    for (const { path, hash } of fileList) {
        // 只处理 BDMV 和 CERTIFICATE 内部文件，其它媒体文件、扫图等不参与 BACKUP 完整性比对。
        const backupRoot = backupRoots.find(root => path.includes(`/${root}/`));
        if (!backupRoot) continue;

        // rootPath 用于区分同一个种子中可能存在的多套 BD 目录结构。
        // 例如 /DISC1/BDMV 和 /DISC2/BDMV 会被分到两个组里，避免交叉比较。
        const rootIndex = path.indexOf(`/${backupRoot}/`);
        const rootPath = `${path.substring(0, rootIndex)}/${backupRoot}`;
        (discGroups[rootPath] ||= []).push({ path, hash, backupRoot });
    }

    const mismatched = [];

    for (const files of Object.values(discGroups)) {
        // 建立主文件映射
        const mainFiles = Object.fromEntries(
            files
                .filter(f => !f.path.includes("/BACKUP/"))
                .map(f => [f.path, f.hash])
        );

        // 检查 BACKUP 文件
        for (const { path, hash, backupRoot } of files) {
            if (!path.includes("/BACKUP/")) continue;

            // BACKUP 文件的主文件路径只差一个 /BACKUP/ 层级。
            // 如果主文件不存在，mainHash 为 undefined，也会被视为不匹配并输出错误。
            const mainPath = path.replace("/BACKUP/", "/");
            const mainHash = mainFiles[mainPath];

            if (mainHash !== hash) {
                mismatched.push({ path, backupRoot });
            }
        }
    }

    return mismatched;
}

async function handleTorrentChecksum(userId, token, torrentId) {
    const apiData = await fetchApi(`/torrents/${torrentId}/checksum`, {}, 'GET', token);

    if (apiData.code == 404) {
        logger.addLog("API 未找到 SHA256 信息");
        return;
    }

    if (apiData.message !== "success") {
        logger.addLog("API 获取 SHA256 信息失败");
        return;
    }

    const files = apiData?.data?.checksum?.torrent_files_info?.files || [];
    if (files.length === 0) {
        // 一般不可能发生这个，有 files 字段一定有哈希信息
        logger.addLog("API 文件 SHA256 信息为空");
        return;
    }

    const badFiles = getMismatchedDiscBackups(files);
    badFiles.forEach(file => logger.addLog(`文件错误 (${file.backupRoot}/BACKUP) → ${file.path}`));
}


async function fetchApi(path, params = {}, method = 'GET', token = null) {
    try {
        let url = `https://u2.kysdm.com/api/v2${path}`;

        let options = {
            method: method.toUpperCase(),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
        };

        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        if (options.method === 'GET') {
            const queryString = new URLSearchParams(params).toString();
            if (queryString) {
                // 处理原路径是否自带问号的情况
                url += (url.includes('?') ? '&' : '?') + queryString;
            }
        } else {
            options.body = JSON.stringify(params);
        }

        const response = await fetch(url, options);

        if (response.status === 401) {
            logger.addLog(`鉴权失败 → 请重新登录`);
            return { code: 401, message: 'unauthorized' };
        }

        return await response.json();
    } catch (error) {
        logger.addLog(`API 请求异常 → ${path}: ${error.message}`);
        return { code: 500, message: 'exception' };
    }
}
