# -*- coding: utf-8 -*-
# by kysdm

import re
import json
import requests
from time import sleep

uid = 00000  # 自己的UID
Upload = 1.00  # 魔法上传倍率
Download = 0.00  # 魔法下载倍率
Hours = 24  # 魔法时长
Range = 'SELF'  # ALL 是地图炮 | SELF 是恢复系
cookie = '__cfduid=; nexusphp_u2='  # cookie值
proxies = {
    "http": "",
    "https": ""
}  # 代理服务器 http://127.0.0.1:1088
useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'


def GetHtml(url):
    headers = {'user-agent': useragent, 'cookie': cookie}
    i = 1
    while i <= 15:
        try:
            html = requests.get(url,
                                headers=headers,
                                proxies=proxies,
                                timeout=10)
            if html.status_code < 400:
                return html.text
        except Exception:
            print(f'打开网页发生错误！* {i} | {i * 5}秒后重试...')
            sleep(i * 5)
            i += 1


def tlist():
    print('开始下载列表... (如果报错，代表连接U2失败)\n')
    html = GetHtml(
        f'https://u2.dmhy.org/getusertorrentlistajax.php?userid={uid}&type=leeching'
    )
    _h1 = re.findall(
        r'<tr><td class="rowfollow nowrap".*?>(?:---</td></tr>|\d+?\.\d+?</font></td></tr>)',
        html, re.S | re.I)
    _Magic_List = []
    for each in _h1:
        # print(each)
        _id = re.search(r'<a href="details.php\?id=(\d+?)&hit=1">', each,
                        re.M | re.I).group(1)  # 种子ID
        seeders = re.search(
            r'<a href="details.php\?id=\d+?&amp;hit=1&amp;dllist=1#seeders">(\d+?)</a>',
            each, re.M | re.I).group(1)  # 做种人数
        pro_free2up_search = re.search(
            r'<img class="pro_free2up" src="pic/trans.gif" alt="2X Free"(?:\s/)?>',
            each, re.M | re.I)
        pro_custom_search = re.search(
            r'<img class="arrowup" src="pic/trans.gif" alt="上传比率"(?:\s/)?><b>(.+?)X</b>&nbsp;<img class="arrowdown" src="pic/trans.gif" alt="下载比率"(?:\s/)?><b>(.+?)X</b>',
            each, re.M | re.I)
        pro_50pctdown2up_search = re.search(
            r'<img class="pro_50pctdown2up" src="pic/trans.gif" alt="2X 50%"(?:\s/)?>',
            each, re.M | re.I)
        pro_2up_search = re.search(
            r'<img class="pro_2up" src="pic/trans.gif" alt="2X"(?:\s/)?>',
            each, re.M | re.I)
        pro_50pctdown_search = re.search(
            r'<img class="pro_50pctdown" src="pic/trans.gif" alt="50%"(?:\s/)?>',
            each, re.M | re.I)
        pro_30pctdown_search = re.search(
            r'<img class="pro_30pctdown" src="pic/trans.gif" alt="30%"(?:\s/)?>',
            each, re.M | re.I)
        pro_free_search = re.search(
            r'<img class="pro_free" src="pic/trans.gif" alt="FREE"(?:\s/)?>',
            each, re.M | re.I)

        if pro_free2up_search:  # 2倍上传 免费下载 img.pro_free2up
            _Magic_List.append([_id, seeders, '2.00 / 0.00'])
        elif pro_custom_search:  # 2倍上传 30%下载 img.pro_custom
            _Magic_List.append([
                _id, seeders,
                f'{pro_custom_search.group(1)} / {pro_custom_search.group(2)}'
            ])
        elif pro_50pctdown2up_search:  # 2倍上传 50%下载 img.pro_50pctdown2up
            _Magic_List.append([_id, seeders, '2.00 / 0.50'])
        elif pro_2up_search:  # 2倍上传 img.pro_2up
            _Magic_List.append([_id, seeders, '2.00 / 1.00'])
        elif pro_50pctdown_search:  # 50%下载 pro_50pctdown
            _Magic_List.append([_id, seeders, '1.00 / 0.50'])
        elif pro_30pctdown_search:  # 30%下载 img.pro_30pctdown
            _Magic_List.append([_id, seeders, '1.00 / 0.30'])
        elif pro_free_search:  # 免费下载 img.pro_free
            _Magic_List.append([_id, seeders, '1.00 / 0.00'])
        else:
            _Magic_List.append([_id, seeders, '1.00 / 1.00'])

    return _Magic_List


def Send(_id, _ur, _dr):
    html = GetHtml(
        f'https://u2.dmhy.org/promotion.php?action=magic&torrent={_id}')
    divergence = re.search(
        r'<input type="hidden" name="divergence" value="(.+?)"(?:\s/)?>', html,
        re.M | re.I).group(1)
    base_everyone = re.search(
        r'<input type="hidden" name="base_everyone" value="(.+?)"(?:\s/)?>',
        html, re.M | re.I).group(1)
    base_self = re.search(
        r'<input type="hidden" name="base_self" value="(.+?)"(?:\s/)?>', html,
        re.M | re.I).group(1)
    base_other = re.search(
        r'<input type="hidden" name="base_other" value="(.+?)"(?:\s/)?>', html,
        re.M | re.I).group(1)
    tsize = re.search(
        r'<input type="hidden" name="tsize" value="(.+?)"(?:\s/)?>', html,
        re.M | re.I).group(1)
    ttl = re.search(r'<input type="hidden" name="ttl" value="(.+?)"(?:\s/)?>',
                    html, re.M | re.I).group(1)
    headers = {
        'Referer':
        f'https://u2.dmhy.org/promotion.php?action=magic&torrent={_id}',
        'origin': 'https://u2.dmhy.org',
        'User-Agent': useragent,
        'cookie': cookie
    }
    data = {
        'action': 'magic',
        'divergence': divergence,  # 全站基数
        'base_everyone': base_everyone,
        'base_self': base_self,
        'base_other': base_other,
        'torrent': _id,  # 种子ID
        'tsize': tsize,  # 种子大小
        'ttl': ttl,  # 种子已存在时间
        'user': Range,  # 为自己放魔法
        # 'user_other':'', # 为他人放魔法才有用
        'start': '0',  # 魔法立即生效
        'hours': str(Hours),  # 魔法有效期24小时
        'promotion': '8',  # 魔法类型为其他
        'ur': _ur,  # 上传比率
        'dr': _dr,  # 下载比率
        'comment': ''  # 评论
    }
    try:
        f1 = requests.post('https://u2.dmhy.org/promotion.php?test=1',
                           data=data,
                           headers=headers,
                           proxies=proxies,
                           timeout=10)
    except Exception:
        pass
    finally:
        return f1.status_code
    JsonObj = json.loads(f1.text)
    if not JsonObj['status'] == 'operational':
        print(f'{_id} | 魔法不可用')
        return 403
    uc = re.search(r'title="(.+?)"', JsonObj['price'],
                   re.M | re.I).group(1).replace(',', '')
    data['comment'] = f'消耗UCoin: {uc}'
    sleep(3)
    try:
        f2 = requests.post(
            f'https://u2.dmhy.org/promotion.php?action=magic&torrent={_id}',
            data=data,
            headers=headers,
            proxies=proxies,
            timeout=10)
    except Exception:
        pass
    finally:
        return f2.status_code


def Magic():
    _List = tlist()
    for _id, _seeders, _magic in _List:
        if _seeders == '0':
            print(f'ID:{_id} | 无人做种暂不释放魔法')
            continue
        _Upload = float(_magic.split(' / ')[0])  # 上传
        _Download = float(_magic.split(' / ')[1])  # 下载
        if Upload <= _Upload and Download >= _Download:
            print(f'ID:{_id} | 魔法已存在')
            continue
        if _Upload < Upload:
            ur = str(Upload)
        else:
            ur = '1.00'
        if _Download > Download:
            dr = str(Download)
        else:
            dr = '1.00'

        if Send(_id, ur, dr) == 200:
            print(f'ID：{_id} | 成功施加马猴烧酒')
        else:
            print(f'ID：{_id} | 发送错误')


if __name__ == "__main__":
    Magic()
