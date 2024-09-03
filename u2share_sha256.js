// ==UserScript==
// @name         标记U2种子是否存在文件检验值
// @namespace    https://u2.dmhy.org/
// @version      0.1
// @author       kysdm
// @grant        none
// @match        *://u2.dmhy.org/torrents.php*
// @downloadURL  https://github.com/kysdm/u2_share/raw/main/u2share_sha256.js
// @updateURL    https://github.com/kysdm/u2_share/raw/main/u2share_sha256.js
// @icon         https://u2.dmhy.org/favicon.ico
// ==/UserScript==


(async () => {
    'use strict';

    const tList = await getList();
    const tSet = new Set(tList.split("\n").map(Number));

    const torrentTable = $('table.torrents');
    torrentTable.find('> tbody > tr:not(:first-child)').each(function () {
        const idLink = $(this).find("[href*='id=']")[0].getAttribute('href');
        const id = parseInt(idLink.substr(idLink.indexOf('id=') + 3));
        const exists = tSet.has(id);

        if (exists) {
            const GstaticIco = $(this).find('td.embedded')[1];
            $(GstaticIco).width(60);
            $(GstaticIco).prepend('<img src="https://p.sda1.dev/19/956e079a49cbcdb2a02d47a5ad6e144e/4048602.png" style="padding-bottom: 2px; width:16px;height:16px;">');
        }

    })

})()


function getList() {
    return new Promise((resolve, reject) => {
        // https://www.w3school.com.cn/jquery/ajax_ajax.asp
        $.ajax({
            type: 'get',
            url: 'https://u2.kysdm.com/api/v1/filehash_list',
            contentType: 'text/plain',
            dataType: 'text',
            cache: false,
            success: r => resolve(r),
            error: r => {
                console.log('下载列表发生错误，HTTP状态码[' + r.status + ']。');
                reject(r.status)
            }
        })
    })

}
