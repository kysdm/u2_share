#coding = utf-8
# 将有新发布的种子自动加入 qBittorrent

import time
import os
import re
import requests
import json
import csv
from bs4 import BeautifulSoup
import logging
from logging import Handler, FileHandler, StreamHandler
from time import sleep

"""
姑且改了个出来。
脚本原来的数据库是 mysql,现在改成 csv，为了方便修改就不用 sqlite。
依赖安装 pip3 install bs4 lxml requests，其余的应该会自带。
一开始瞎写，现在瞎改，迫真能跑。 (自己都不知道为什么能跑起来)
用户变量必须全部填写，否则可能什么都不会发生。
需要 python 3.6 +
"""

# **************用户变量********************
cookie = '' # u2 账户的 cookie
passkey = '' # u2 账户的 passkey
upLimit = '52219084'  # 上传限速
qbthost = '127.0.0.1:8080' # qb 的 web 地址
qbtusername = 'admin' # qb 的 web 登陆账户
qbtpassword = '' # qb 的 web 登陆密码
username = ''  # u2 账户的用户名，如果用户名有斜体，加入 <i></i>  懒得写自动获取了
savepath = '/mnt/virtual/qbt/'  # 保存下载文件的路径
proxies = {"http": "http://127.0.0.1:7890","https": "http://127.0.0.1:7890",} # 默认不使用代理访问，没人会在本地跑这个脚本的吧。
# **************用户变量********************

# **************变量********************
mainurl = 'https://u2.dmhy.org/torrents.php'
abs_path = os.path.split(os.path.realpath(__file__))[0]
logpath = f'{abs_path}/log/自动加新种'
logfile = f'''{time.strftime('%Y%m%d',time.localtime(time.time()))}.log'''
useragent = 'Mozilla/5.0 (Macintosh Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36'
# **************变量********************

class PathFileHandler(FileHandler):
    def __init__(self, path, filename, mode='a', encoding=None, delay=False):
        filename = os.fspath(filename)
        if not os.path.exists(path):
            os.makedirs(path)
        self.baseFilename = os.path.join(path, filename)
        self.mode = mode
        self.encoding = encoding
        self.delay = delay
        if delay:
            Handler.__init__(self)
            self.stream = None
        else:
            StreamHandler.__init__(self, self._open())


class Loggers(object):
    # 日志级别关系映射
    level_relations = {
        'debug': logging.DEBUG, 'info': logging.INFO, 'warning': logging.WARNING,
        'error': logging.ERROR, 'critical': logging.CRITICAL
    }

    def __init__(self, filename=logfile, level='info', log_dir=logpath,
                 fmt='%(asctime)s - [line:%(lineno)d] - %(levelname)s: %(message)s'):
        self.logger = logging.getLogger(filename)
        abspath = os.path.dirname(os.path.abspath(__file__))
        self.directory = os.path.join(abspath, log_dir)
        format_str = logging.Formatter(fmt)  # 设置日志格式
        self.logger.setLevel(self.level_relations.get(level))  # 设置日志级别
        stream_handler = logging.StreamHandler()  # 往屏幕上输出
        stream_handler.setFormatter(format_str)
        file_handler = PathFileHandler(
            path=self.directory, filename=filename, mode='a')
        file_handler.setFormatter(format_str)
        self.logger.addHandler(stream_handler)
        self.logger.addHandler(file_handler)


class qbittorrent:
    def Login(self):
        headers = {
            'user-agent': useragent,
            'Origin': f'http://{qbthost}',
            'Referer': f'http://{qbthost}/',
            'Host': qbthost}
        data = {'username': qbtusername, 'password': qbtpassword}
        url = f'http://{qbthost}/api/v2/auth/login'
        f = requests.post(url, data=data, headers=headers)
        if f.status_code == 200:
            return f.cookies['SID']
        else:
            log.logger.debug('登录错误，请检查配置！')
            exit(1)

    def GetHash(self, sid, _id):
        headers = {
            'user-agent': useragent,
            'cookie': f'SID={sid}'}
        url = f'http://{qbthost}/api/v2/torrents/info'
        parameters = {'category': _id}
        f = requests.get(url, headers=headers, params=parameters)
        if f.status_code == 200:
            jsonobj = json.loads(f.text)[0]
            return jsonobj['hash']
        else:
            log.logger.debug('无法获取种子hash值')
            exit(1)

    def Getinfo(self, sid, _filter):
        headers = {
            'user-agent': useragent,
            'cookie': f'SID={sid}'}
        url = f'http://{qbthost}/api/v2/torrents/info?filter={_filter}'
        f = requests.get(url, headers=headers)
        if f.status_code == 200:
            jsonre = f.text
            jsonobj = json.loads(jsonre)
            __infolist = []
            for v in jsonobj:
                __infolist.append(
                    [v['hash'], v['category'], v['save_path'], v['time_active']])
            return __infolist
        else:
            log.logger.debug('无法获取种子info')
            exit(1)

    def AddTorrent(self, sid, _id, category, _savepath):
        headers = {
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'user-agent': useragent,
            'cookie': f'SID={sid}'}
        url = f'https://u2.dmhy.org/download.php?id={_id}&passkey={passkey}&https=1'
        # 下载种子文件
        r = requests.get(url)
        if r.status_code != 200:
            return r.status_code

        files = {'file': (f'{_id}.torrent', r.content,
                          'application/x-bittorrent')}
        data = {'savepath': _savepath,
                'category': category,
                'autoTMM': 'false',
                'paused': 'false',
                'skip_checking': 'false',
                'root_folder': 'true',
                'dlLimit': 'NaN',
                'upLimit': upLimit
                }
        f = requests.post(
            f'http://{qbthost}/api/v2/torrents/add', data=data, headers=headers, files=files)
        if f.status_code == 200:
            return 200
        else:
            log.logger.debug('种子添加失败，请检查配置！')
            exit(1)

    def DeleteTorrents(self, sid, _hash):
        headers = {
            'user-agent': useragent,
            'cookie': f'SID={sid}'}
        data = {'hashes': _hash,
                'deleteFiles': 'false',
                }
        url = f'http://{qbthost}/api/v2/torrents/delete'
        f = requests.post(url, headers=headers, data=data)
        return f.status_code

    def SetForceStart(self, sid, _hash):
        headers = {
            'user-agent': useragent,
            'cookie': f'SID={sid}'}
        url = f'http://{qbthost}/api/v2/torrents/setForceStart'
        data = {'hashes': _hash,
                'value': 'true'}
        f = requests.post(url, data=data, headers=headers)
        return f.status_code


def OpenHtml(url):
    headers = {'user-agent': useragent, 'cookie': cookie}
    i = 0
    # 用 retrying 可能更好看点
    while i <= 15:
        try:
            # html = requests.get(url, headers=headers, proxies=proxies, timeout=10) # 使用代理访问
            html = requests.get(url, headers=headers, timeout=10)
            break
        except Exception:
            log.logger.debug(f'打开网页发生错误！* {i}')
            sleep(i * 5)
            i += 1
    return html.text


def Savecsv(_id):
    with open(f'{abs_path}/NewIdList.csv', 'a', newline='', encoding='utf-8-sig') as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow([_id])
    csv_file.close()


if __name__ == "__main__":
    QBT = qbittorrent()
    log = Loggers(level='debug').logger
    soup = BeautifulSoup(OpenHtml(mainurl), 'lxml')
    link1 = soup.find_all(href=re.compile(r'details\.php\?id=\d+?.*hit=1$'))

    _IdList = []
    if os.path.exists(f'{abs_path}/NewIdList.csv'):
        with open(f'{abs_path}/NewIdList.csv', "r", encoding='utf-8-sig') as csv_file:
            reader = csv.reader(csv_file)
            for string in reader:
                _IdList.append(string[0])
        csv_file.close()

    for v in link1:
        v = str(v)
        _re = re.compile(r'href="details\.php\?id=(\d+?)&amp;hit=1">', re.S)
        reReturn = (re.findall(_re, v))[0]
        log.info('############## Start ###################')
        log.info(reReturn)
        torrent_id = int(reReturn.replace("\n", "").replace("\r", ""))
        log.info('查询数据库中...')

        if str(torrent_id) in _IdList:
            log.info(f'CSV数据库 => 已添加种子：{torrent_id}')
            time.sleep(0.2)
            continue
        else:
            save_path = f'{savepath}/{torrent_id}'
            log.info(f'{save_path}')
            if QBT.AddTorrent(QBT.Login(), torrent_id, f'new{torrent_id}', save_path) == 200:
                log.info('种子成功添加！开始下载...')
                time.sleep(10)
                _hash = QBT.GetHash(QBT.Login(), f'new{torrent_id}')
                if QBT.SetForceStart(QBT.Login(), _hash) == 200:
                    Savecsv(torrent_id)
                    log.info('启动下载成功！')
                else:
                    log.info('启动下载失败！')
                    time.sleep(1)
        log.info('############## End ###################')
