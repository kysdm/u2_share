# -*- coding: utf-8 -*-
# 批量发糖
# 不知怎么的，小鸟用头飞了起来.mp4

import os
import re
import time
from time import sleep
import requests
import platform
import sqlite3
import logging
from logging import Handler, FileHandler, StreamHandler
"""
回帖者需将UID用#包围 (#UID#)
支持任意数量UC发送
支持中断续发
支持 Windows 和 Linux
需要 Python 3.6+
///
运行脚本后，按提示输入对应信息，其中 "留言" 可以为空。
* 发糖帖子的ID可以在地址栏看到，“topicid” 后面跟的数字就是ID。
  如 'https://u2.dmhy.org/forums.php?action=viewtopic&forumid=1&topicid=12968'，ID就是12968。
* 重复发帖要糖的，取最早回帖中的UID。
* 开始新的一次发糖，需要删除 'u2_ucoin.db' 文件。
  不删除运行脚本，将执行上次未完成的队列任务。
  注：存在 db 文件时运行脚本，可能会因主键的关系报 'UNIQUE constraint failed' 错误。
* 发帖时需要注明回帖UID要求(#UID#)，示例建议填入自己的 UID，
  脚本开始时会要求输入发糖人的 UID，执行时会排除掉填入的 UID。
  注：发糖数量需要加上示例UID，例如发5人需填6人。
* proxies 填入 http 代理，访问将通过代理服务器。
"""

# proxies = {"http": "http://127.0.0.1:36441", "https": "http://127.0.0.1:36441"}
proxies = {"http": "", "https": ""}

abs_path = os.path.split(os.path.realpath(__file__))[0]
sqlfile = f'{abs_path}/u2_ucoin.db'
logfile = f'''{time.strftime('%Y%m%d',time.localtime(time.time()))}.log'''
logpath = f'{abs_path}'
useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36'


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
        'debug': logging.DEBUG,
        'info': logging.INFO,
        'warning': logging.WARNING,
        'error': logging.ERROR,
        'critical': logging.CRITICAL
    }

    def __init__(self,
                 filename=logfile,
                 level='info',
                 log_dir=logpath,
                 fmt='%(asctime)s - %(levelname)s: %(message)s',
                 datefmt='%Y-%m-%d %H:%M:%S %A'):
        self.logger = logging.getLogger(filename)
        abspath = os.path.dirname(os.path.abspath(__file__))
        self.directory = os.path.join(abspath, log_dir)
        format_str = logging.Formatter(fmt)
        self.logger.setLevel(self.level_relations.get(level))
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(format_str)
        file_handler = PathFileHandler(path=self.directory,
                                       filename=filename,
                                       mode='a')
        file_handler.setFormatter(format_str)
        self.logger.addHandler(stream_handler)
        self.logger.addHandler(file_handler)


class SQL():
    def __init__(self, dbfile=sqlfile):
        if not os.path.isfile(dbfile):
            self.dbfile = dbfile
            self.conn = sqlite3.connect(self.dbfile)
            self.cursor = self.conn.cursor()
            self.cursor.execute('''CREATE TABLE "info" (
                "pid" integer NOT NULL,
                "useractualid" integer NOT NULL,
                "userid" integer NOT NULL,
                "ucoin" integer NOT NULL,
                "ucoind" integer NOT NULL,
                PRIMARY KEY ("pid", "useractualid")
                );''')
        else:
            self.dbfile = dbfile
            self.conn = sqlite3.connect(self.dbfile)
            self.cursor = self.conn.cursor()

    def Insert(self, column, value):
        try:
            sql = f'''INSERT INTO "main"."info" ({column}) VALUES ({value})'''
            log.debug(sql)
            self.cursor.execute(sql)
        except sqlite3.IntegrityError as e:
            log.warning(f'{sql} ==> {e}')
            self.cursor.close()
        except Exception as e:
            log.error(f'{sql} ==> {e}')
            self.cursor.close()
        else:
            self.cursor.close()
            self.conn.commit()
        finally:
            self.conn.close()

    def Update(self, columnvalue, newcolumnvalue):
        try:
            sql = f'UPDATE "main"."info" SET {newcolumnvalue} WHERE {columnvalue}'
            log.debug(sql)
            self.cursor.execute(sql)
        except sqlite3.IntegrityError as e:
            log.warning(f'{sql} ==> {e}')
            self.cursor.close()
        except Exception as e:
            log.error(f'{sql} ==> {e}')
            self.cursor.close()
        else:
            self.cursor.close()
            self.conn.commit()
        finally:
            self.conn.close()

    def Select(self, sql):
        try:
            log.debug(sql)
            self.cursor.execute(sql)
        except sqlite3.IntegrityError as e:
            log.warning(f'{sql} ==> {e}')
            self.cursor.close()
            sqlvalue = None
        except Exception as e:
            log.error(f'{sql} ==> {e}')
            self.cursor.close()
            sqlvalue = None
        else:
            sqlvalue = self.cursor.fetchall()
            self.cursor.close()
        finally:
            self.conn.close()
        return sqlvalue


def press_any_key():
    version = platform.system()
    if version == "Windows":
        import msvcrt
        log.info('请确认信息，无误按任意键继续...\n')
        ord(msvcrt.getch())
    elif version == "Linux":
        import sys
        import termios
        log.info('请确认信息，无误按任意键继续...\n')
        fd = sys.stdin.fileno()
        old_ttyinfo = termios.tcgetattr(fd)
        new_ttyinfo = old_ttyinfo[:]
        new_ttyinfo[3] &= ~termios.ICANON
        new_ttyinfo[3] &= ~termios.ECHO
        # sys.stdout.write(msg)
        # sys.stdout.flush()
        termios.tcsetattr(fd, termios.TCSANOW, new_ttyinfo)
        os.read(fd, 7)
        termios.tcsetattr(fd, termios.TCSANOW, old_ttyinfo)


def GetUID(_topicid, page=0):
    _html1 = GetHtml(
        f'https://u2.dmhy.org/forums.php?action=viewtopic&forumid=1&topicid={_topicid}&page={page}'
    )
    _list1 = re.findall(
        r'<div style="margin-top: 8pt; margin-bottom: 8pt;"><table id="pid(\d+?)".*?href="userdetails.php\?id=(\d{1,5})"',
        _html1, re.S | re.I)  # pid和用户id
    _list2 = re.findall(
        r'<div class="post-body" id="pid(\d+?)body"><span style="word-break: break-all; word-wrap: break-word;">(.*?)</div>',
        _html1, re.S | re.I)  # pid和用户评论
    for _pid2, _txt in _list2:
        for _pid1, _UserActualId in _list1:
            if _pid1 == _pid2:
                matchObj = re.search(r'#(\d{1,5})#', _txt, re.M | re.I)
                if matchObj:
                    UserInfo.append([_pid2, _UserActualId, matchObj.group(1)])
    if GetPages(_html1) == 1:
        page += 1
        GetUID(_topicid, page)
    else:
        return 0


def GetPages(html):
    matchObj = re.search(r'<font class="gray"><b>下一页 &gt;&gt;</b></font>',
                         html, re.M | re.I)
    return 0 if matchObj else 1


def GetHtml(url):
    headers = {'user-agent': useragent, 'cookie': cookie}
    i = 1
    while i <= 15:
        try:
            html = requests.get(url,
                                headers=headers,
                                proxies=proxies,
                                timeout=10)  # 使用代理访问
            if html.status_code < 400:
                return html.text
        except Exception:
            log.error(f'打开网页发生错误！* {i} |  {i * 5}秒后重试...')
            sleep(i * 5)
            i += 1


def TransferUC(uid, ucoin, message=''):
    headers = {
        'user-agent': useragent,
        'referer': f'https://u2.dmhy.org/ucoin.php?transfer_to={uid}',
        'origin': 'https://u2.dmhy.org',
        'cookie': cookie,
        'content-type': 'application/x-www-form-urlencoded'
    }
    data = {'event': '1003', 'recv': uid, 'amount': ucoin, 'message': message}
    i = 1
    while True:  # 递归函数还要控制返回值，死循环得了
        try:
            f1 = requests.post('https://u2.dmhy.org/mpshop.php',
                               data=data,
                               headers=headers,
                               timeout=10,
                               proxies=proxies,
                               allow_redirects=False)
        except Exception:
            log.error(f'POST 请求发送错误！* {i} | {i * 5}秒后重试...')
            sleep(i * 5)
            i += 1
        else:
            if f1.status_code == 302:
                url302 = f1.headers['Location']
                flash_msg = re.findall(r'flash_msg=(.+?);',
                                       f1.headers['Set-Cookie'])[0]
                headers['cookie'] = f'{cookie}; flash_msg={flash_msg}'
                headers.pop('content-type')
                f2 = requests.get(url302,
                                  headers=headers,
                                  timeout=10,
                                  proxies=proxies)
                if '<h3>成功！已完成转账。</h3>' in f2.text:
                    return ucoin
            elif f1.status_code == 200:
                # with open(f'{abs_path}/U2_TEST.html', 'w', encoding='utf-8-sig') as fX:
                #     fX.write(f1.text)
                if '接收人UID不存在或无法接受转账' in f1.text:
                    return -1
                matchObj = re.search(
                    r'<td class="text">请勿进行频繁转账，请(\d+?)秒后再试一次。</td>', f1.text,
                    re.M | re.I)
                if matchObj:
                    sleeptime = int(matchObj.group(1))
                    log.info(f'[ {uid} ] 触发频繁转账限制，将在{sleeptime}秒后重试。')
                    sleep(sleeptime + 5)
            else:
                log.error(f'POST 返回值未知。[HTTP: {f1.status_code}]')
                pass


def main(limit):
    # 返回数据库中已赠送UC为空或未完成赠送的
    _sqlreturn = SQL().Select(
        f'SELECT * FROM "main"."info" WHERE "ucoin" >= "ucoind" ORDER BY "pid" LIMIT 0,{limit}'
    )
    log.info('打印赠送信息...')
    log.info('| 索引号 | 楼层ID | 赠送ID | 赠送UC |')
    for i, j in enumerate(_sqlreturn):
        log.info(
            f'| {str(i).center(6)} | {str(j[0]).center(6)} | {str(j[2]).center(6)} | {str(j[3]).center(6)} |'
        )
    press_any_key()
    log.info('开始!')
    for v, w, x, y, z in _sqlreturn:
        if x == myuid:
            log.info(f'[ {v} | {x} ] 跳过！接收人UID为发糖本人。')
            continue  # 跳过发糖人自己
        if z == -1:
            log.info(f'[ {v} | {x} ] 跳过！接收人UID不存在或无法接受转账。')
            continue
        a, b = divmod(y - z, 50000)
        if a == 0 and b == 0:  # 已完成赠送的
            log.info(f'[ {v} | {x} ] 跳过！上次已转账。')
            continue
        elif a == 0:  # 赠送的数量小于5金
            log.info(f'[ {v} | {x} | {b} ] 准备转账...')
            c = TransferUC(x, b, message)
            if c > 0:
                log.info(f'[ {v} | {x} | {c} ] 成功！已完成转账。')
                SQL().Update(f"pid={v}", f"ucoind={c}")
            else:
                log.info(f'[ {v} | {x} | {c} ] 失败！接收人UID不存在或无法接受转账。')
                SQL().Update(f"pid={v}", "ucoind=-1")
        else:
            i_uc = 0
            for i in range(a):  # 循环发送5金
                log.info(f'[ {v} | {x} | 50000 ] 准备转账...')
                c = TransferUC(x, 50000, message)
                if c > 0:
                    i_uc += c
                    log.info(f'[ {v} | {x} | {i_uc}/{y} ] 成功！已完成转账。')
                    SQL().Update(f"pid={v}", f"ucoind={i_uc}")
                else:
                    log.info(
                        f'[ {v} | {x} | {i_uc}/{y} ] 失败！接收人UID不存在或无法接受转账。')
                    SQL().Update(f"pid={v}", "ucoind=-1")
            if b != 0:  # 发送不足5金的部分
                log.info(f'[ {v} | {x} | {b} ] 准备转账...')
                c = TransferUC(x, b, message)
                if c > 0:
                    i_uc += c
                    log.info(f'[ {v} | {x} | {i_uc}/{y} ] 成功！已完成转账。')
                    SQL().Update(f"pid={v}", f"ucoind={i_uc}")
                else:
                    log.info(
                        f'[ {v} | {x} | {i_uc}/{y} ] 失败！接收人UID不存在或无法接受转账。')
                    SQL().Update(f"pid={v}", "ucoind=-1")
            else:
                pass


if __name__ == '__main__':
    # log = Loggers(level='debug').logger
    log = Loggers(level='info').logger
    UserInfo = []
    cookie = input("输入发糖人的Cookie：")
    myuid = int(input("输入发糖人UID: "))
    topicid = input("输入发糖帖子的ID: ")
    ucoin = input("输入发糖数量: ")
    limit = input("输入发糖的人数: ")
    message = input("输入留言：")
    print('\n')
    log.info(
        f'发糖人UID: {myuid} | 发糖帖子的ID: {topicid} | 发糖数量: {ucoin} | 发糖的人数: {limit} | 留言： {message}'
    )
    press_any_key()
    log.info('获取帖子信息...\n')
    GetUID(topicid)
    log.info('| 索引号 | 楼层ID | 用户ID | 赠送ID |')
    num = 0
    for i, j in enumerate(UserInfo):
        log.info(
            f'| {str(i).center(6)} | {str(j[0]).center(6)} | {str(j[1]).center(6)} | {str(j[2]).center(6)} |'
        )
    press_any_key()
    for x, y, z in UserInfo:
        SQL().Insert('"pid", "useractualid", "userid", "ucoin", "ucoind"',
                     f"'{x}','{y}','{z}','{ucoin}', 0")
    main(limit)
