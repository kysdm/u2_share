# -*- coding: utf-8 -*-
# by kysdm

import os
import sys
import re
import json
import logging
import asyncio
import aiohttp
import datetime
from lxml import etree
from loguru import logger
from apscheduler.schedulers.asyncio import AsyncIOScheduler
'''
Python3.9.9
lxml==4.7.1
apscheduler==3.6.3
aiohttp==3.8.1
loguru==0.5.3
'''

INTERVAL = 60  # 周期性循环间隔 单位秒
UID = 00000  # 自己的UID
UPLOAD = 1.00  # 魔法上传倍率 | 上传比率范围1.3~2.33
DOWNLOAD = 0.00  # 魔法下载倍率 | 下载比率范围0~0.8
HOURS = 24  # 魔法时长  最低24小时
RANGE = 'ALL'  # ALL 是地图炮 | SELF 是恢复系
COMMENT_SWITCH = False  # True 备注消耗魔法数量 | False 反之
DELAY = 0  # 魔法生效时间延迟x秒 适当延迟地图炮魔法生效时间，魔法消息不再显示在群聊区
COOKIE = {'nexusphp_u2': 'xxx'}  # cookie值
PROXIES = ''  # 代理服务器 PROXIES="http://user:pass@some.proxy.com"
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'}


class U2():

    def __init__(self):
        self.session = None

    async def get(self, url):
        if self.session is None:
            self.session = aiohttp.ClientSession()
        for i in range(15):
            try:
                timeout = aiohttp.ClientTimeout(total=80, sock_connect=15, sock_read=45)
                async with self.session.get(url, headers=HEADERS, cookies=COOKIE, proxy=PROXIES, timeout=timeout) as resp:
                    if resp.status == 200:
                        text = await resp.text()
                        return etree.HTML(text)
                    else:
                        logger.error(f'状态码不正确<{resp.status}> * {i} | 10秒后重试... | {url}')
                        await asyncio.sleep(10)
            except asyncio.TimeoutError as e:
                logger.error(f'超时 * {i} | 10秒后重试... | {url} | {e}')
                await asyncio.sleep(10)
            except Exception as e:
                logger.error(f'发生致命错误 | 30秒后重试... | {url} | {e}')
                await asyncio.sleep(30)

    async def post(self, url, data):
        if self.session is None:
            self.session = aiohttp.ClientSession()
        for i in range(15):
            try:
                timeout = aiohttp.ClientTimeout(total=80, sock_connect=15, sock_read=45)
                async with self.session.post(url, data=data, headers=HEADERS, cookies=COOKIE, proxy=PROXIES, timeout=timeout) as resp:
                    if resp.status == 200:
                        return await resp.text()
                    else:
                        logger.error(f'状态码不正确<{resp.status}> * {i}  | 10秒后重试... | {url}')
                        await asyncio.sleep(10)
            except asyncio.TimeoutError as e:
                logger.error(f'超时 * {i} | 10秒后重试... | {url} | {e}')
                await asyncio.sleep(10)
            except Exception as e:
                logger.error(f'发生致命错误 | 30秒后重试... | {url} | {e}')
                await asyncio.sleep(30)

    async def close(self) -> None:
        if self.session is not None:
            await self.session.close()


async def getUserTorrentList():
    logger.info('开始下载列表... (如果报错，代表连接U2失败)')
    html = await u2.get(f'https://u2.dmhy.org/getusertorrentlistajax.php?userid={UID}&type=leeching')
    # _h1 = re.findall(r'<tr><td class="rowfollow nowrap".*?>(?:---</td></tr>|\d+?\.\d+?</font></td></tr>)', html, re.S | re.I)
    _h1 = html.xpath('/html/body/table/tr')
    _h1.pop(0)
    __list = []

    for each in _h1:
        # x = etree.tostring(each, encoding='utf-8').decode('utf-8')
        _id = re.search(r'id=(\d+)', each.xpath('.//*[@class="torrentname"]/.//a/@href')[0], flags=re.I).group(1)  # 种子ID
        # y = each.xpath('.//*[contains(@href,"#seeders")]/text()')[0]
        seeders = each.xpath('.//a[contains(@href,"#seeders")]/text()')[0]  # 做种人数

        if len(each.xpath('.//img[@class="pro_free2up"]')) != 0:
            # 2x 0x
            __list.append([_id, seeders, '2.00 / 0.00'])
        elif len(each.xpath('.//img[@class="pro_free"]')) != 0:
            # 1x 0x
            __list.append([_id, seeders, '1.00 / 0.00'])
        elif len(each.xpath('.//img[@class="pro_2up"]')) != 0:
            # 2x 1x
            __list.append([_id, seeders, '2.00 / 1.00'])
        elif len(each.xpath('.//img[@class="pro_custom"]')) != 0:
            # 自定义魔法
            _u = each.xpath('.//img[@class="arrowup"]/following-sibling::b[1]')[0].xpath("string(.)").replace('X', '')
            _d = each.xpath('.//img[@class="arrowdown"]/following-sibling::b[1]')[0].xpath("string(.)").replace('X', '')
            __list.append([_id, seeders, f'{_u} / {_d}'])
        elif len(each.xpath('.//img[@class="pro_50pctdown2up"]')) != 0:
            # 2x 0.5x
            __list.append([_id, seeders, '2.00 / 0.50'])
        elif len(each.xpath('.//img[@class="pro_50pctdown"]')) != 0:
            # 1x 0.5x
            __list.append([_id, seeders, '1.00 / 0.50'])
        elif len(each.xpath('.//img[@class="pro_30pctdown"]')) != 0:
            # 1x 0.3x
            __list.append([_id, seeders, '1.00 / 0.30'])
        else:
            # 没有魔法
            __list.append([_id, seeders, '1.00 / 1.00'])

    return sorted([list(t) for t in set(tuple(_) for _ in __list)], key=__list.index)


async def sendMagic(_id, _ur, _dr):
    html = await u2.get(f'https://u2.dmhy.org/promotion.php?action=magic&torrent={_id}')

    try:
        _divergence = html.xpath('//input[@name="divergence"]/@value')[0]
        _base_everyone = html.xpath('//input[@name="base_everyone"]/@value')[0]
        _base_self = html.xpath('//input[@name="base_self"]/@value')[0]
        _base_other = html.xpath('//input[@name="base_other"]/@value')[0]
        _tsize = html.xpath('//input[@name="tsize"]/@value')[0]
        _ttl = html.xpath('//input[@name="ttl"]/@value')[0]
    except IndexError:
        logger.error(f'#{_id} | 获取种子基础信息错误，可能种子已被屏蔽。')
        return 404

    data = {
        'action': 'magic',
        'divergence': _divergence,  # 全站基数
        'base_everyone': _base_everyone,
        'base_self': _base_self,
        'base_other': _base_other,
        'torrent': _id,  # 种子ID
        'tsize': _tsize,  # 种子大小
        'ttl': _ttl,  # 种子已存在时间
        'user': RANGE,  # 为类型
        # 'user_other':'', # 为他人放魔法才有用
        'start': '0',  # 魔法立即生效
        'hours': str(HOURS if HOURS > 24 else 24),  # 魔法有效期24小时
        'promotion': '8',  # 魔法类型为其他
        'ur': _ur,  # 上传比率
        'dr': _dr,  # 下载比率
        'comment': ''  # 评论
    }

    __j = await u2.post('https://u2.dmhy.org/promotion.php?test=1', data)

    if __j is None:
        return 503

    __json = json.loads(__j)

    if not __json['status'] == 'operational':
        logger.warning(f'#{_id}  魔法不可用')
        return 403

    _uc = re.search(r'title="(.+?)"', __json['price'], re.M | re.I).group(1).replace(',', '')

    if COMMENT_SWITCH is True:
        data['comment'] = f'UCoin: {_uc}'

    data['start'] = 0 if DELAY == 0 else (datetime.datetime.now() + datetime.timedelta(seconds=DELAY)).strftime('%Y-%m-%d %H:%M:%S')

    await asyncio.sleep(3)

    try:
        f = await u2.post(f'https://u2.dmhy.org/promotion.php?action=magic&torrent={_id}', data=data)
        return 200 if re.match(r'^<script.+<\/script>$', f) else 503
    except Exception as e:
        logger.error(f'#{_id} | 释放魔法发生错误 | {e}')
        return 503


async def main():
    __list = await getUserTorrentList()

    for _id, _seeders, _magic in __list:

        if _seeders == '0':
            logger.debug(f'ID:{_id} | 无人做种暂不释放魔法')
            continue

        __upload = float(_magic.split(' / ')[0])  # 上传
        __download = float(_magic.split(' / ')[1])  # 下载

        if UPLOAD <= __upload and DOWNLOAD >= __download:
            logger.info(f'ID:{_id} | 魔法已存在')
            continue

        ur = str(UPLOAD) if __upload < UPLOAD else '1.00'
        dr = str(DOWNLOAD) if __download > DOWNLOAD else '1.00'

        if await sendMagic(_id, ur, dr) == 200:
            logger.info(f'ID:{_id} | 成功施加马猴烧酒')
        else:
            logger.error(f'ID:{_id} | 发送错误')

        await asyncio.sleep(1)

    logger.info('END')


if __name__ == "__main__":
    job_defaults = {'coalesce': True, 'max_instances': 1, 'misfire_grace_time': 60}
    scheduler = AsyncIOScheduler(job_defaults=job_defaults, timezone='Asia/Shanghai')
    logging.getLogger('apscheduler.scheduler').setLevel(level=logging.ERROR)
    logger.remove()
    logger.add(sink=sys.stdout, backtrace=True, diagnose=True, enqueue=True)
    u2 = U2()

    scheduler.add_job(func=main, trigger='interval', seconds=INTERVAL, next_run_time=datetime.datetime.now())
    scheduler.start()

    logger.info('Press Ctrl+{0} to exit'.format('Break' if os.name == 'nt' else 'C'))
    try:
        loop_forever = asyncio.new_event_loop()
        coro = asyncio.get_event_loop().run_forever()
        future = asyncio.run_coroutine_threadsafe(coro, loop_forever)
    except (KeyboardInterrupt, SystemExit):
        pass
