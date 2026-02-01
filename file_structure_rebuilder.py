import os
import sys
import hashlib
import shutil
import requests
import json

from loguru import logger
from pathlib import Path
from collections import defaultdict
from requests.exceptions import RequestException
from tenacity import retry, wait_exponential, stop_after_attempt
from tqdm import tqdm


# ================= 配置区 =================
UID = 0  # 请替换为实际的整数 UID
API_TOKEN = ""
API_BASE_URL = "https://u2.kysdm.com/api/v1"
BATCH_SIZE = 50  # 每次批量查询的数量，最大 100
# =========================================

# 初始化日志
LOG_FILE = "rebuild_log.txt"
logger.remove()
logger.add(sys.stderr, format="<green>{time:HH:mm:ss}</green> | <level>{message}</level>", level="INFO")
logger.add(LOG_FILE, rotation="10 MB")


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5))
def fetch_filehash_batch(hashes: list) -> dict:
    """
    调用新的批量查询接口
    """
    url = f"{API_BASE_URL}/filehash"
    payload = {"uid": int(UID), "token": API_TOKEN, "filehashes": hashes}

    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Batch API request failed: {e}")
        raise


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5))
def fetch_torrent_info(torrent_id: int) -> dict:
    """
    查询单个种子详情（用于最后生成校验文件）
    """
    url = f"{API_BASE_URL}/torrent_checksum/"
    payload = {"uid": UID, "token": API_TOKEN, "torrent_id": torrent_id}

    response = requests.post(url, json=payload, timeout=30)
    if response.status_code == 200:
        return response.json()
    raise RequestException(f"Failed to fetch torrent info: {response.status_code}")


def generate_sha256(work_dir: Path) -> dict:
    """
    计算或读取目录下所有文件的 SHA256
    返回: {file_path_str: sha256, ...}
    """
    temp_sha256_path = work_dir / "checksum.sha256.tmp"
    final_sha256_path = work_dir / "checksum.sha256"
    log_file_path = work_dir / LOG_FILE

    logger.info("Scanning files...")
    all_files = []

    # 排除规则
    ignore_extensions = {".py", ".bat", ".sh", ".ps1", ".sha256", ".!qb"}

    for file_path in work_dir.rglob("*"):
        if not file_path.is_file():
            continue

        rel_path = file_path.relative_to(work_dir)
        parts = rel_path.parts

        # 忽略已整理好的数字目录
        if len(parts) > 1 and parts[0].isdigit():
            continue

        if file_path.suffix.lower() in ignore_extensions or file_path == temp_sha256_path or file_path == log_file_path:
            continue

        all_files.append(file_path)

    if not all_files:
        logger.warning("No files to process.")
        return {}

    existing_hashes = {}

    def load_hashes(path: Path):
        """辅助函数：读取 Hash 文件到字典"""
        if not path.is_file():
            return
        try:
            with path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or " *" not in line:
                        continue
                    sha, name = line.split(" *", 1)
                    # 只有当文件确实存在时才视为有效缓存
                    if (work_dir / name).exists():
                        existing_hashes[work_dir / name] = sha
        except Exception as e:
            logger.warning(f"Failed to read {path.name}: {e}")

    load_hashes(final_sha256_path)
    load_hashes(temp_sha256_path)

    logger.info(f"Loaded {len(existing_hashes)} existing hashes.")

    files_to_hash = [f for f in all_files if f not in existing_hashes]

    if files_to_hash:
        logger.info(f"Computing hashes for {len(files_to_hash)} new files...")

        with temp_sha256_path.open("a", encoding="utf-8") as tmp_f:
            for file_path in tqdm(files_to_hash, unit="file"):
                # 计算 Hash
                sha256_obj = hashlib.sha256()
                with file_path.open("rb") as f:
                    while chunk := f.read(1024 * 1024):
                        sha256_obj.update(chunk)
                sha256 = sha256_obj.hexdigest()

                # 更新内存字典
                existing_hashes[file_path] = sha256

                posix_path = file_path.relative_to(work_dir).as_posix()
                tmp_f.write(f"{sha256} *{posix_path}\n")
                tmp_f.flush()

    logger.info("Finalizing checksum file...")
    final_lines = []

    for file_path in all_files:
        if file_path in existing_hashes:
            posix_path = file_path.relative_to(work_dir).as_posix()
            final_lines.append(f"{existing_hashes[file_path]} *{posix_path}\n")

    with final_sha256_path.open("w", encoding="utf-8") as f:
        f.writelines(final_lines)

    # 计算完成后删除临时文件
    if temp_sha256_path.exists():
        temp_sha256_path.unlink()

    return existing_hashes


def safe_fill_file(src: Path, target_rel_path: str, torrent_id: int, base_dir: Path, mode="move"):
    """
    填充文件到目标位置。支持移动、硬链接或复制。
    """
    dst = base_dir / str(torrent_id) / target_rel_path
    if dst.exists():
        return True  # 已经存在了，跳过

    dst.parent.mkdir(parents=True, exist_ok=True)

    try:
        if mode == "move":
            shutil.move(src, dst)
        elif mode == "link":
            try:
                # 尝试硬链接 (不占空间)
                os.link(src, dst)
            except (OSError, AttributeError):
                # 如果跨分区或不支持，则复制
                shutil.copy2(src, dst)
        return True
    except Exception as e:
        logger.error(f"Failed to fill {target_rel_path}: {e}")
        return False


def organize_files(file_hash_map: dict, work_dir: Path):
    """
    流式处理：按文件体积从大到小排序 Hash，分批查询并立即移动
    """

    hash_to_files = defaultdict(list)
    hash_max_size = defaultdict(int)

    logger.info("Analyzing file sizes for priority processing...")
    for rel_path_str, sha256 in file_hash_map.items():
        hash_to_files[sha256].append(rel_path_str)
        f_size = (work_dir / rel_path_str).stat().st_size
        if f_size > hash_max_size[sha256]:
            hash_max_size[sha256] = f_size

    sorted_hashes = sorted(hash_to_files.keys(), key=lambda h: hash_max_size[h], reverse=True)

    total_hashes = len(sorted_hashes)
    logger.info(f"Total unique hashes: {total_hashes}. Starting from largest files.")

    existing_torrent_ids = set()
    for d in work_dir.iterdir():
        if d.is_dir() and d.name.isdigit():
            existing_torrent_ids.add(int(d.name))

    with tqdm(total=total_hashes, unit="hash", desc="Organizing") as pbar:
        for i in range(0, total_hashes, BATCH_SIZE):
            batch_hashes = sorted_hashes[i : i + BATCH_SIZE]

            # API 请求
            try:
                resp = fetch_filehash_batch(batch_hashes)
                if resp.get("state") != "200":
                    logger.error(f"API Error at batch {i}: {resp.get('msg')}")
                    pbar.update(len(batch_hashes))
                    continue
                current_results = resp.get("data", {}).get("results", {})
            except Exception as e:
                logger.error(f"Batch request failed: {e}")
                pbar.update(len(batch_hashes))
                continue

            # 处理本批次
            for file_sha256 in batch_hashes:
                local_files = hash_to_files[file_sha256]
                candidates = current_results.get(file_sha256, [])

                if not candidates:
                    continue

                # 优先匹配本地已存在的 ID
                target = next((c for c in candidates if c["torrent_id"] in existing_torrent_ids), None)

                # 如果本地没有，选择最大的种子 ID
                if not target:
                    target = max(candidates, key=lambda x: x["torrent_id"])
                    existing_torrent_ids.add(target["torrent_id"])

                all_paths_in_torrent = [c["path"] for c in candidates if c["torrent_id"] == target["torrent_id"]]

                # 3. 遍历本地文件和种子目标路径进行填充
                source_ptr = 0

                for target_rel_path in all_paths_in_torrent:
                    # 如果本地还有多余的相同 Hash 文件，就用移动，否则用硬链接/复制
                    if source_ptr < len(local_files):
                        src = work_dir / local_files[source_ptr]
                        success = safe_fill_file(src, target_rel_path, target["torrent_id"], work_dir, mode="move")
                        if success:
                            source_ptr += 1
                    else:
                        first_src = work_dir / str(target["torrent_id"]) / all_paths_in_torrent[0]
                        safe_fill_file(first_src, target_rel_path, target["torrent_id"], work_dir, mode="link")

            pbar.update(len(batch_hashes))


def verify_and_generate_reports(work_dir: Path):
    """
    对整理后的数字文件夹进行完整性校验
    """
    logger.info("Verifying organized torrents...")

    for folder in work_dir.iterdir():
        if not (folder.is_dir() and folder.name.isdigit()):
            continue

        torrent_id = int(folder.name)
        try:
            data = fetch_torrent_info(torrent_id)
            torrent_data = data["data"]["torrent"][0]
            files_info_str = torrent_data["torrent_files_info"]

            if isinstance(files_info_str, str):
                files_list = json.loads(files_info_str)["files"]
            else:
                files_list = files_info_str["files"]

            existing_lines = []
            missing_lines = []

            for item in files_list:
                f_path = item["path"]
                f_hash = item["hash"]
                local_f = folder / f_path

                if local_f.exists():
                    # 写入 checksum.sha256
                    existing_lines.append(f"{f_hash} *{f_path}\n")
                else:
                    # 写入 missing
                    missing_lines.append(f"{f_hash} *{f_path}\n")

            # 写入结果
            if existing_lines:
                with (folder / "checksum.sha256").open("w", encoding="utf-8") as f:
                    f.writelines(existing_lines)

            if missing_lines:
                with (folder / "missing_files.sha256").open("w", encoding="utf-8") as f:
                    f.writelines(missing_lines)
                logger.warning(f"Torrent {torrent_id} has missing files.")
            else:
                # 清理旧的 missing 文件
                (folder / "missing_files.sha256").unlink(missing_ok=True)
                logger.info(f"Torrent {torrent_id} verified: 100% complete.")

        except Exception as e:
            logger.error(f"Failed to verify torrent {torrent_id}: {e}")


def remove_empty_directories(path: Path):
    """递归清理空目录"""
    for d in list(path.rglob("*"))[::-1]:
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()


if __name__ == "__main__":
    work_dir = Path(__file__).resolve().parent

    # 计算/读取 Hash
    file_map = generate_sha256(work_dir)

    # 批量查询与移动
    organize_files(file_map, work_dir)

    # 校验整理后的结果
    verify_and_generate_reports(work_dir)

    # 清理空目录
    remove_empty_directories(work_dir)

    logger.success("All tasks finished.")
