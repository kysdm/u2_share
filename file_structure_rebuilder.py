import sys
import hashlib
import shutil
import requests
from loguru import logger
from pathlib import Path
from collections import defaultdict
from requests.exceptions import RequestException
from tenacity import retry, wait_exponential, stop_after_attempt


UID = ""
API_TOKEN = ""


def generate_sha256(work_dir: Path, file_list: list, hash_list: list) -> None:
    temp_sha256_path = work_dir / "checksum.sha256.tmp"
    final_sha256_path = work_dir / "checksum.sha256"

    if temp_sha256_path.is_file():
        with temp_sha256_path.open("r", encoding="utf-8") as f:
            for line in f.read().splitlines():
                sha256, file = line.split(" *")
                absolute_file_path = work_dir / file
                hash_list.append([absolute_file_path, sha256])

    def append_to_temp(sha256_hash: str, file_path: Path) -> None:
        linux_style_path = file_path.as_posix()
        with temp_sha256_path.open("a", encoding="utf-8") as f:
            f.write(f"{sha256_hash} *{linux_style_path}\n")

    for index, file_path in enumerate(file_list, start=1):
        if ".!qB" in str(file_path) or file_path == temp_sha256_path:
            continue

        logger.info(f"Processing {index} / {len(file_list)}: {file_path.name}")
        for existing_hash in hash_list:
            if file_path == existing_hash[0]:
                sha256_hash = existing_hash[1]
                append_to_temp(sha256_hash, file_path.relative_to(work_dir))
                logger.info(f"Found existing hash for {file_path.name}: *{sha256_hash}")
                break
        else:
            with file_path.open("rb") as f:
                sha256_obj = hashlib.sha256()
                while chunk := f.read(8192):
                    sha256_obj.update(chunk)
                sha256_hash = sha256_obj.hexdigest()

            logger.info(f"Computed hash for {file_path.name}: {sha256_hash}")
            append_to_temp(sha256_hash, file_path.relative_to(work_dir))

    if temp_sha256_path.is_file():
        shutil.move(temp_sha256_path, final_sha256_path)
        logger.info("Checksum file moved successfully.")
    else:
        logger.warning("Directory is empty!")
        if final_sha256_path.is_file():
            final_sha256_path.unlink()
            logger.info("Checksum file removed.")

        remove_empty_directories(work_dir)
        sys.exit(0)


def create_file_list(base_path: Path) -> tuple:
    file_list = []
    hash_list = []

    for file_path in base_path.rglob("*"):
        if file_path.is_file():
            relative_parts = file_path.relative_to(base_path).parts

            # 检查相对路径的第一层是否为数字
            if len(relative_parts) > 1 and relative_parts[0].isdigit():
                continue

            if len(relative_parts) == 1 and file_path.name == "checksum.sha256":
                with file_path.open("r", encoding="utf-8") as f:
                    for line in f.read().splitlines():
                        sha256, file = line.split(" *")
                        absolute_file_path = file_path.parent / file
                        hash_list.append([absolute_file_path, sha256])

            elif file_path.suffix.lower() in [".py", ".bat", ".sh", ".ps1", ".sha256"]:
                logger.info(f"Ignoring script file: {file_path}")
            elif file_path.name == "log.txt":
                logger.info(f"Ignoring log file: {file_path}")
            else:
                file_list.append(file_path)

    return file_list, hash_list


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5))
def fetch_api_1(params: dict) -> dict:
    url = f"https://u2.kysdm.com/api/v1/filehash/?uid={UID}&token={API_TOKEN}"
    response = requests.get(url, params=params)

    if response.status_code == 200:
        return response.json()
    raise RequestException(f"Failed to fetch: {response.status_code}")


@retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5))
def fetch_api_2(torrent_id: int) -> dict:
    url = "https://u2.kysdm.com/api/v1/torrent_checksum/"
    json_data = {"uid": UID, "token": API_TOKEN, "torrent_id": torrent_id}
    response = requests.post(url, json=json_data)

    if response.status_code == 200:
        return response.json()
    raise RequestException(f"Failed to fetch: {response.status_code}")


def move_file(source_file: Path, target_relative_path: Path, base_directory: Path) -> None:
    target_full_path = base_directory / target_relative_path
    target_full_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        shutil.move(source_file, target_full_path)
        logger.info(f"File moved to: {target_relative_path}")
    except Exception as e:
        logger.error(f"File move failed: {e}")


def verify_torrent_paths(torrent_dict: dict, base_directory: Path) -> bool:
    for folder_path in base_directory.iterdir():
        if folder_path.is_dir() and folder_path.name.isdigit():
            torrent_id = int(folder_path.name)

            if torrent_id in torrent_dict:
                logger.info(f"Local torrent found: {torrent_id}")

                for path in torrent_dict[torrent_id]:
                    local_path = folder_path / path

                    if local_path.exists():
                        return True
                return False
    return False


def remove_empty_directories(base_directory: Path) -> None:
    all_dirs = [d for d in base_directory.rglob("*") if d.is_dir()]

    for dir_path in reversed(all_dirs):
        try:
            # 获取目录内所有文件
            files = list(dir_path.iterdir())

            # 检查目录是否为空
            if not files:  # 目录为空
                dir_path.rmdir()
                logger.info(f"Removed empty directory: {dir_path}")
            # 检查目录是否只包含 .sha256 文件且没有子目录
            elif all(file.suffix.lower() == ".sha256" for file in files) and not any(file.is_dir() for file in files):
                shutil.rmtree(dir_path)  # 删除非空目录
                logger.info(f"Removed directory with only .sha256 files: {dir_path}")
        except OSError as e:
            # 如果目录无法删除，捕获异常并继续
            logger.error(f"Failed to remove directory: {dir_path}, {e}")
            continue


def main():
    files_info = {}

    with (work_dir / "checksum.sha256").open("r", encoding="utf-8") as f:
        for line in f.read().splitlines():
            sha256, file = line.split(" *")
            size = (work_dir / file).stat().st_size
            files_info[file] = {"sha256": sha256, "size": size}

    sorted_files = sorted(files_info.items(), key=lambda item: item[1]["size"], reverse=True)

    for file_path, info in sorted_files:
        file_sha256 = info["sha256"]
        response = fetch_api_1({"filehash": file_sha256})

        if "error" in response:
            logger.error(response["error"])
            raise SystemExit(1)
        elif "File not found" in response["msg"]:
            logger.warning(f"Corresponding torrent not found: {file_path}, {file_sha256}")
        else:
            data = response["data"]["torrents"]

            if not data:
                logger.warning(f"Corresponding torrent not found: {file_path}, {file_sha256}")
            elif len(data) == 1:
                torrent_id = str(data[0]["torrent_id"])
                target_path = data[0]["path"]
                logger.info(f"Found 1 torrent: {torrent_id}, {file_path}, {file_sha256}")
                full_target_path = Path(torrent_id) / target_path
                logger.info(f"Relation guessed: {file_path} -> {full_target_path}")

                if full_target_path.exists():
                    logger.warning(f"Target path already exists: {full_target_path}")
                    continue

                move_file(Path(file_path), full_target_path, work_dir)
            else:
                logger.info(f"Found {len(data)} torrents, {file_path}, {file_sha256}")
                torrent_dict = defaultdict(list)

                for item in data:
                    torrent_dict[item["torrent_id"]].append(item["path"])

                found = False
                for torrent_id, paths in torrent_dict.items():
                    if (work_dir / str(torrent_id)).exists():
                        logger.info(f"Local torrent exists #{torrent_id}, {file_sha256}")

                        for path in paths:
                            full_target_path = Path(str(torrent_id)) / path
                            logger.info(f"Relation guessed: {file_path} -> {full_target_path}")
                            if full_target_path.exists():
                                logger.info(f"File already exists: {full_target_path}, {file_sha256}")
                            else:
                                move_file(Path(file_path), full_target_path, work_dir)
                                found = True
                                break

                        if found:
                            break

                if not found:
                    logger.warning("No local torrents found, using the latest result from the API")
                    latest_torrent = data[-1]
                    torrent_id = str(latest_torrent["torrent_id"])
                    target_path = latest_torrent["path"]
                    full_target_path = Path(torrent_id) / target_path
                    logger.info(f"Relation guessed: {file_path} -> {full_target_path}")
                    move_file(Path(file_path), full_target_path, work_dir)

    for folder_path in work_dir.iterdir():
        if folder_path.is_dir() and folder_path.name.isdigit():
            torrent_id = int(folder_path.name)
            response_data = fetch_api_2(torrent_id)

            if "error" in response_data:
                logger.error(response_data["error"])
                raise SystemExit(1)
            else:
                torrent_files_info = response_data["data"]["torrent"][0]["torrent_files_info"]["files"]
                existing_files = []
                missing_files = []

                for item in torrent_files_info:
                    path = item["path"]
                    hash_value = item["hash"]

                    if not (folder_path / path).exists():
                        logger.warning(f"Torrent file missing: {(folder_path / path).relative_to(work_dir)}")
                        missing_files.append(f"{hash_value} *{path}\n")
                    else:
                        existing_files.append(f"{hash_value} *{path}\n")

                with (folder_path / "checksum.sha256").open("w", encoding="utf-8") as f:
                    f.writelines(existing_files)

                # 如果有缺失文件，写入 missing_files.sha256
                if missing_files:
                    with (folder_path / "missing_files.sha256").open("w", encoding="utf-8") as f:
                        f.writelines(missing_files)
                else:
                    missing_file_path = folder_path / "missing_files.sha256"
                    if missing_file_path.is_file():
                        missing_file_path.unlink()
                        logger.info(f"Removed missing_files.sha256: {missing_file_path}")


if __name__ == "__main__":
    work_dir = Path(__file__).resolve().parent
    logger.add("log.txt")

    generate_sha256(work_dir, *create_file_list(work_dir))
    main()
    remove_empty_directories(work_dir)
