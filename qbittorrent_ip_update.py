# -*- coding: utf-8 -*-

import os
import json
import asyncio
import aiohttp
import aiofiles
from loguru import logger

''' 编写环境
Python3.9.9
aiofiles==0.8.0
aiohttp==3.8.1
loguru==0.5.3
'''

QBTURL = 'http://127.0.0.1:8080'  # 地址
QBTUSER = 'admin'  # 账号
QBTPASS = 'password'  # 密码
EXITTIME = 5  # 运行结束后等待x秒再退出


async def getIP():
    async with aiohttp.ClientSession() as session:
        url = 'http://whois.pconline.com.cn/ipJson.jsp?json=true'
        async with session.post(url=url) as response:
            if response.status == 200:
                return await response.text()
            else:
                return None


async def qbittorrent(ipAddress):
    # 登录
    async with aiohttp.ClientSession() as session:
        url = f'{QBTURL}/api/v2/auth/login'
        data = {'username': QBTUSER, 'password': QBTPASS}
        timeout = aiohttp.ClientTimeout(total=10, sock_connect=5, sock_read=5)
        async with session.post(url=url, timeout=timeout, data=data) as response:
            if response.status != 200 or 'Fails.' == await response.text():
                logger.info('登录qbittorrent失败.')
            elif response.status == 200 and 'Ok.' == await response.text():
                logger.info('登录qbittorrent成功.')
                # 设置IP
                url = f'{QBTURL}/api/v2/app/setPreferences'
                form = aiohttp.FormData()
                form.add_field('json', json.dumps(
                    {"announce_ip": ipAddress}))
                async with session.post(url=url, cookies=response.cookies, timeout=timeout, data=form) as response:
                    if response.status == 200:
                        logger.info('设置qbittorrent成功.')
                        await response.text()
                        return True
                    else:
                        logger.info('设置qbittorrent失败.')


class ipAddress:
    @classmethod
    async def record(self, address):
        _path = os.path.join(abs_path, 'ip.json')
        _json = {'ip': address}
        async with aiofiles.open(_path,  mode='w', encoding='utf8') as f:
            await f.write(json.dumps(_json))

    @classmethod
    async def acquire(self):
        _path = os.path.join(abs_path, 'ip.json')
        if not os.path.exists(_path):
            logger.warning('ip.json 文件不存在.')
            return None
        async with aiofiles.open(_path, mode='r', encoding='utf8') as f:
            try:
                _json = json.loads(await f.read())
                return _json.get('ip')
            except json.JSONDecodeError:
                logger.warning('ip.json 文件无效.')
                return None


async def run():
    global abs_path
    abs_path = os.path.split(os.path.realpath(__file__))[0]
    ip_last = await ipAddress.acquire()

    ip_text = await getIP()
    if ip_text is None:
        logger.error('获取IP数据发生错误.')
    else:
        ip_json = json.loads(ip_text)
        ip = ip_json.get('ip')
        if ip is None:
            logger.error('提取IP数据发生错误.')
        elif ip == ip_last:
            logger.info('IP没有更新.')
        else:
            logger.info(f'当前IP: {ip}  上次IP: {ip_last}')
            if await qbittorrent(ip) is True:
                await ipAddress.record(ip)

    await asyncio.sleep(EXITTIME)


if __name__ == '__main__':
    asyncio.run(run())
