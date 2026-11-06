// ==UserScript==
// @name         标记U2种子是否存在文件检验值
// @namespace    https://u2.dmhy.org/
// @version      0.6
// @description  标记U2种子是否存在文件检验值，已被二次校验的种子以金色图标显示
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/torrents.php*
// @downloadURL  https://raw.githubusercontent.com/kysdm/u2_share/refs/heads/main/u2share_checksum_marker.js
// @updateURL    https://raw.githubusercontent.com/kysdm/u2_share/refs/heads/main/u2share_checksum_marker.js
// @icon         https://u2.dmhy.org/favicon.ico
// ==/UserScript==

/*
 * 数据源：v2 校验值列表接口（v1 /api/v1/filehash_list 仍在线，但本脚本不再使用）
 *
 *   GET https://u2.kysdm.com/api/v2/torrents/checksum/list?ids=209,241,24453
 *
 * 响应：
 *   {
 *     "code": 200,
 *     "message": "success",
 *     "data": {
 *       "items": [ {"torrent_id": 209, "verify_count": 0}, {"torrent_id": 241, "verify_count": 1} ],
 *       "total": 2
 *     }
 *   }
 *
 * 采用批量模式：一次带上当前页所有种子 ID，每批最多 100 个（接口上限，超出会被截断）。
 * 全量模式响应体积是批量模式的数百倍，不适合每页都拉，因此这里不用。
 *
 * 语义（verify_count 是「二次校验次数」，上传者首次提交校验值不计入）：
 *   - 不在 items 里      -> 没有校验值记录，不打图标
 *   - verify_count = 0   -> 有记录但还没有他人二次校验，保持原灰色图标
 *   - verify_count > 0   -> 已被二次校验，图标改为金色
 *   - 接口失败（4xx/5xx/网络错误） -> 静默跳过，页面不受影响
 */

// 校验值列表接口
const API_URL = 'https://u2.kysdm.com/api/v2/torrents/checksum/list';

// 单次请求最多携带的 ID 个数（接口上限 100，超过会被截断且不报错）
const MAX_IDS_PER_REQUEST = 100;

// 原图标
const ICON_URL = 'https://p.sda1.dev/19/956e079a49cbcdb2a02d47a5ad6e144e/4048602.png';

// 可选：单独的金色图标地址。留空则用金色渐变 + 原图轮廓合成（类似 hi-res 金标）。
const ICON_VERIFIED_URL = '';

// 金色渐变：顶部高光 → 中间正金 → 底部暗金，看起来有金属层次，不像刷了一层黄漆
const GOLD_GRADIENT = 'linear-gradient(180deg, #ffe7a0 0%, #d4af37 55%, #9e780c 100%)';

// 不支持 mask 时的退路：直接在原图上套滤镜（深金，避免以前那种浅黄）
const GOLD_FILTER = 'grayscale(1) sepia(1) saturate(4) hue-rotate(6deg) brightness(1.3)';

// 浏览器是否支持用 mask 把渐变裁成图标形状
const MASK_SUPPORTED = (() => {
    try {
        return typeof CSS !== 'undefined' && !!CSS.supports &&
            (CSS.supports('mask-image', 'url(x)') || CSS.supports('-webkit-mask-image', 'url(x)'));
    } catch (e) {
        return false;
    }
})();

(async () => {
    'use strict';

    const rows = collectRows();
    if (rows.length === 0) return;

    const ids = [...new Set(rows.map(r => r.id))];
    const counts = await fetchVerifyCounts(ids);

    rows.forEach(({ row, id }) => {
        if (!counts.has(id)) return;

        // 取第 2 个 td.embedded：第 1 个不是图标条，插进去会串位
        const tdEmbedded = $(row).find('td.embedded')[1];
        if (!tdEmbedded) return;

        $(tdEmbedded).width(60);
        $(tdEmbedded).prepend(buildIcon(counts.get(id)));
    });
})();

/**
 * 收集种子列表页的每一行及其种子 ID
 * @returns {{row: Element, id: number}[]}
 */
function collectRows() {
    const rows = [];

    $('table.torrents').find('> tbody > tr:not(:first-child)').each(function () {
        const id = getTorrentId($(this));
        if (!isValidId(id)) return;

        rows.push({ row: this, id: id });
    });

    return rows;
}

/**
 * 从种子行中取种子 ID
 * @param {object} $row 行对象（jQuery）
 * @returns {number|null}
 */
function getTorrentId($row) {
    const links = $row.find("a[href*='.php?id=']");

    for (let i = 0; i < links.length; i++) {
        const href = (links[i].getAttribute && links[i].getAttribute('href')) || '';
        const match = href.match(/(?:^|\/)details\.php\?id=(\d+)/);
        if (match) return parseInt(match[1], 10);
    }

    return null;
}

/**
 * 种子 ID 是否合法（正整数）
 * @param {number|null} id
 * @returns {boolean}
 */
function isValidId(id) {
    return Number.isInteger(id) && id > 0;
}

/**
 * 分批拉取校验次数
 * @param {number[]} ids
 * @returns {Promise<Map<number, number>>} torrent_id -> verify_count
 */
async function fetchVerifyCounts(ids) {
    const map = new Map();

    const parts = await Promise.all(chunk(ids, MAX_IDS_PER_REQUEST).map(fetchChunk));

    parts.forEach(part => {
        part.forEach((count, id) => {
            const prev = map.has(id) ? map.get(id) : 0;
            map.set(id, Math.max(prev, count));
        });
    });

    return map;
}

/**
 * 请求一批 ID，失败时返回空 Map（静默跳过）
 * @param {number[]} ids
 * @returns {Promise<Map<number, number>>}
 */
async function fetchChunk(ids) {
    if (ids.length === 0) return new Map();

    const url = API_URL + '?ids=' + ids.join(',');

    try {
        // cache: 'default' 让浏览器用上接口的 Cache-Control: public, max-age=60 与 ETag
        const resp = await fetch(url, { cache: 'default' });
        if (!resp.ok) return new Map();

        return parseItems(await resp.json());
    } catch (e) {
        console.log('校验值列表请求失败，本次不标记：' + e);
        return new Map();
    }
}

/**
 * 解析接口响应
 * @param {*} body
 * @returns {Map<number, number>} torrent_id -> verify_count
 */
function parseItems(body) {
    const map = new Map();

    if (!body || body.code !== 200 || !body.data || !Array.isArray(body.data.items)) return map;

    body.data.items.forEach(item => {
        if (!item) return;

        const id = Number(item.torrent_id);
        if (!isValidId(id)) return;

        const count = Number(item.verify_count);
        if (!Number.isFinite(count) || count < 0) return;

        map.set(id, Math.trunc(count));
    });

    return map;
}

/**
 * 把数组按固定长度切块
 * @param {Array} list
 * @param {number} size
 * @returns {Array[]}
 */
function chunk(list, size) {
    const parts = [];
    for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size));
    return parts;
}

/**
 * 生成图标 HTML
 * @param {number} verifyCount 二次校验次数，>0 时显示金色
 */
function buildIcon(verifyCount) {
    const golden = verifyCount > 0;
    const title = golden
        ? `存在文件检验值（已二次校验 ${verifyCount} 次）`
        : '存在文件检验值（暂未二次校验）';

    if (!golden) return imgIcon(ICON_URL, title, '');
    if (ICON_VERIFIED_URL) return imgIcon(ICON_VERIFIED_URL, title, '');

    // 有 mask 就用金色渐变填充原图轮廓，颜色准、边缘干净
    if (MASK_SUPPORTED) return goldMaskIcon(title);

    // 退路：给原图套深金滤镜
    return imgIcon(ICON_URL, title, GOLD_FILTER);
}

/**
 * 普通图标（与原脚本完全一致的写法）
 * @param {string} src
 * @param {string} title
 * @param {string} filter 为空则不套滤镜
 * @returns {string}
 */
function imgIcon(src, title, filter) {
    const styles = ['padding-bottom: 2px', 'width:16px', 'height:16px'];
    if (filter) {
        styles.push('filter:' + filter);
        styles.push('-webkit-filter:' + filter);
    }

    return `<img src="${src}" title="${title}" style="${styles.join(';')}">`;
}

/**
 * 金色图标：用金色渐变填充原图的 alpha 轮廓。
 * 盒模型（width/height/padding-bottom、display、baseline）与 imgIcon 保持一致，
 * 所以不会改变图标在单元格里的位置。
 * @param {string} title
 * @returns {string}
 */
function goldMaskIcon(title) {
    const mask = `url(${ICON_URL})`;

    const styles = [
        'display:inline-block',
        'width:16px',
        'height:16px',
        'padding-bottom: 2px',
        'background:' + GOLD_GRADIENT
    ];

    ['-webkit-', ''].forEach(prefix => {
        styles.push(prefix + 'mask-image:' + mask);
        styles.push(prefix + 'mask-position:center');
        styles.push(prefix + 'mask-size:contain');
        styles.push(prefix + 'mask-repeat:no-repeat');
        styles.push(prefix + 'mask-origin:content-box');
        styles.push(prefix + 'mask-clip:content-box');
    });

    return `<span title="${title}" style="${styles.join(';')}"></span>`;
}
