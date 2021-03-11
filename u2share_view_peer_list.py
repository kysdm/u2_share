# -*- coding: utf-8 -*-
# 获取特定种子的做种列表，将做种服务器位置写入 CSV。

import re
import os
from time import sleep
import csv
import requests
from bs4 import BeautifulSoup


'''
对一般人估计没什么用。
当需要超大规模的下载时(如全站备份)。
下载服务器的位置就非常重要。
做种服务器在法国，下载服务器在中国大陆和同在法国的下载速度可能差400多倍。
筛选后，不同的种子不同的服务器下载，从而达到最高下载速度。

在脚本所在目录，新建 'id.txt'，一行一个种子id，然后运行脚本即可生成 csv。
注意：梦幻单线程！ 不考虑多线程，多线程会给服务器带来不必要的压力。
可能还有些会匹配不到，无伤大雅了。
'''

cookie = '' # u2 账户的 cookie


# **************变量********************
abs_path = os.path.split(os.path.realpath(__file__))[0]
useragent = 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36'
# **************变量********************


def ViewPeerList(_id):
    headers = {'user-agent': useragent, 'cookie': cookie}
    i = 0
    url = 'https://u2.dmhy.org/viewpeerlist.php'
    params = {'id': _id}
    while i <= 15:
        try:
            # html = requests.get(url, headers=headers, proxies=proxies, timeout=10) # 使用代理访问
            html = requests.get(url, headers=headers, params=params, timeout=10)
            break
        except Exception:
            print(f'请求数据发生错误！* {i}')
            sleep(i * 5)
            i += 1
    return html.text


def ProcessingPeerList(_id, _html):
    html = _html
    try:
        User_ID = (re.findall(r'<a class=".+?" href="userdetails.php\?id=(\d+?)".+?>', html, re.S))[0]  # 用户ID
        User_Name = (re.findall(r'<bdo dir="ltr">(.*?)</bdo>', html, re.S))[0]  # 用户名称
    except IndexError:
        User_ID = ''
        User_Name = '匿名'
    try:
        Ipv4 = (re.findall(r'<span class="net_tag ipv4_.+?" title=".*?\nGeoIP:\s?(.+?)">4</span>', html, re.S))[0]
    except IndexError:
        Ipv4 = ''
    try:
        Ipv6 = (re.findall(r'<span class="net_tag ipv6_.+?" title="GeoIP:\s?(.+?)">6</span>', html, re.S))[0]
    except IndexError:
        Ipv6 = ''
    PeerList.append([_id, User_ID, User_Name, Ipv4, Ipv6])


if __name__ == "__main__":
    with open(f'{abs_path}/PeerIdList.csv', 'w', newline='', encoding='utf-8-sig') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(['种子ID', '用户ID', '用户名', 'IPV4', 'IPV6'])
    csv_file.close()

    with open(f'{abs_path}/id.txt', "r", encoding='utf-8-sig') as f:
        for string in f:
            print('############## Start ###################')
            torrent_id = int(string.replace("\n", "").replace("\r", ""))
            print(f'{torrent_id} 查询中...\n')
            soup = BeautifulSoup(ViewPeerList(torrent_id), 'lxml')
            if '<b>0 做种者</b>' in str(soup): 
                print('无人做种，跳过处理...')
                continue
            souplist = soup.find_all('tr')
            PeerList = []
            mode = 0
            for v in souplist:
                if '>平均速度</td>' in str(v):
                    if mode == 1:
                        break
                    else:
                        mode = 1
                        continue
                ProcessingPeerList(torrent_id, str(v))
            print(PeerList)
            with open(f'{abs_path}/PeerIdList.csv', 'a', newline='', encoding='utf-8-sig') as csv_file:
                writer = csv.writer(csv_file)
                for v in PeerList:
                    writer.writerow(v)
            csv_file.close()
