"use strict";
// uglifyjs index.js -c -m -o index.min.js

// 浏览器支持检查 - 确保浏览器支持 Web Crypto API
if ('crypto' in window && crypto.subtle && crypto.subtle.digest) {
    // 启用文件和文件夹上传以及种子创建功能
    document.getElementById('upload_file').disabled = false;
    document.getElementById('upload_folder').disabled = false;
    document.getElementById('torrent_create').disabled = false;
} else {
    // 不支持则弹窗提示
    window.alert('浏览器不支持 Web Crypto API，无法使用种子创建功能。');
}

/**
 * DOM 操作工具类
 * 提供统一的 DOM 元素批量操作方法
 */
const DOMUtils = {
    // 批量设置元素文本内容
    setText: (selector, text) => document.querySelectorAll(selector).forEach(el => el.textContent = text),
    
    // 批量设置元素样式
    setStyle: (selector, property, value) => document.querySelectorAll(selector).forEach(el => el.style[property] = value),
    
    // 批量设置元素属性（智能判断是属性还是特性）
    setAttr: (selector, attr, value) => document.querySelectorAll(selector).forEach(el =>
        attr in el ? el[attr] = value : el.setAttribute(attr, value)
    ),
    
    // 批量淡出元素
    fadeOut: (selector, duration = 300) => {
        document.querySelectorAll(selector).forEach(el => {
            el.style.transition = `opacity ${duration}ms`;
            el.style.opacity = '0';
            setTimeout(() => el.style.display = 'none', duration);
        });
    }
};

/**
 * 应用状态管理器
 * 使用闭包模式封装应用全局状态
 */
const AppState = (() => {
    const state = {
        allFiles: [],           // 文件夹模式：所有文件列表
        singleFile: null,       // 单文件模式：当前文件
        totalSize: 0,           // 总文件大小（字节）
        torrentChanged: false,  // 种子是否已修改
        trackersOverlayVisible: false,  // Tracker 覆盖层是否可见
        creationFinished: false,        // 种子创建是否完成
        blockSize: 16 * 1024 * 1024,    // 种子区块大小（16MB）
        torrentObject: null     // 当前种子对象
    };

    return {
        // 获取状态值
        get: key => state[key],
        
        // 设置状态值
        set: (key, value) => state[key] = value,
        
        // 重置状态
        reset: () => {
            state.allFiles = [];
            state.singleFile = null;
            state.totalSize = 0;
            state.torrentChanged = false;
            state.torrentObject = null;
        }
    };
})();

/**
 * 处理文件夹选择
 * @param {FileList} files - 文件列表
 * @returns {string} 文件夹名称
 */
const folderSelected = files => {
    // 排除系统文件
    const excludedFiles = ['Thumbs.db', '.DS_Store', 'desktop.ini'];
    const allFiles = [...files].filter(file => !excludedFiles.includes(file.name));
    
    // 保存文件列表和总大小到状态
    AppState.set('allFiles', allFiles);
    AppState.set('totalSize', allFiles.reduce((size, file) => size + file.size, 0));
    console.log(allFiles);
    
    // 返回文件夹名称（从相对路径中提取）
    return files[0]?.webkitRelativePath?.split("/")[0];
};

/**
 * 处理单文件选择
 * @param {FileList} files - 文件列表
 * @returns {string} 文件名
 */
const fileSelected = files => {
    const file = files[0];
    
    // 保存文件信息到状态
    AppState.set('singleFile', file);
    AppState.set('totalSize', file.size);
    AppState.set('allFiles', null);
    
    return file.name;
};

/**
 * 设置种子数据并验证
 * @param {string} fileName - 文件或文件夹名称
 * @returns {boolean} 是否设置成功
 */
const setTorrentData = fileName => {
    const torrentName = fileName.trim();

    // 验证：名称不能为空
    if (!torrentName) {
        window.alert("种子名称不能为空");
        return false;
    }
    
    // 验证：不能包含非法字符
    if (torrentName.match(/[<>:"\\\/|\?\*]/)) {
        window.alert("种子名称不能包含以下字符: < > : \\ / | ? *");
        return false;
    }
    
    // 验证：长度不能超过 255 个字符
    if (torrentName.length > 255) {
        window.alert("种子名称长度不能超过 255 个字符");
        return false;
    }

    // 构建种子信息对象
    const infoObject = AppState.get('torrentObject')?.info || { name: "", pieces: "", "piece length": 0 };
    infoObject["private"] = 1;                          // 标记为私有种子
    infoObject["name"] = torrentName;                   // 种子名称
    infoObject["piece length"] = AppState.get('blockSize');  // 分块大小
    infoObject["source"] = '';                          // 来源标记

    // 保存完整的种子对象到状态
    AppState.set('torrentObject', {
        "info": infoObject,
        "announce": 'https://daydream.dmhy.best/announce',  // Tracker 地址
        "creation date": (Date.now() / 1000) | 0,           // 创建时间（Unix 时间戳）
        "created by": "https://u2.dmhy.org/forums.php?action=viewtopic&topicid=13384"  // 创建者信息
    });
    return true;
};

/**
 * 从单个文件创建种子
 * @param {FileList} files - 文件列表
 */
const createTorrentFile = async files => {
    const fileName = fileSelected(files);
    if (!setTorrentData(fileName) || !AppState.get('torrentObject')) return;
    
    // 重置状态
    AppState.set('torrentChanged', false);
    AppState.set('creationFinished', false);
    
    // 开始创建种子
    await createFromFile(AppState.get('torrentObject'));
};

/**
 * 从文件夹创建种子
 * @param {FileList} files - 文件列表
 */
const createTorrentFolder = async files => {
    const folderName = folderSelected(files);
    if (!setTorrentData(folderName) || !AppState.get('torrentObject')) return;
    
    // 重置状态
    AppState.set('torrentChanged', false);
    AppState.set('creationFinished', false);
    
    // 开始创建种子
    await createFromFolder(AppState.get('torrentObject'));
};

/**
 * 创建进度更新器 - 带节流功能
 * 避免频繁更新 DOM 导致性能问题
 * @returns {Object} 包含 update 方法的对象
 */
const createProgressUpdater = () => {
    let lastUpdateTime = 0;   // 上次更新时间
    let lastPercent = 0;       // 上次更新的百分比

    return {
        /**
         * 更新进度
         * @param {number} bytesProcessed - 已处理字节数
         * @param {number} totalSize - 总字节数
         */
        update: (bytesProcessed, totalSize) => {
            const percent = bytesProcessed / totalSize * 100;
            const now = performance.now();

            // 节流：每100ms或进度变化>0.5%或完成时才更新
            if (now - lastUpdateTime >= 100 || Math.abs(percent - lastPercent) >= 0.5 || percent >= 100) {
                requestAnimationFrame(() => {
                    DOMUtils.setStyle('.progress > div', 'width', `${percent}%`);
                    DOMUtils.setText('[name="progress-total"]', `${percent.toFixed(2)}%`);
                });
                lastUpdateTime = now;
                lastPercent = percent;
            }
        }
    };
};

/**
 * 种子创建完成处理
 * 保存种子文件到 IndexedDB 并更新界面状态
 */
const finished = async () => {
    // 创建 localforage 实例用于存储
    const db = localforage.createInstance({ name: "bbcodejs" });
    AppState.set('creationFinished', true);
    
    const torrentObject = AppState.get('torrentObject');
    if (!torrentObject?.info) return;

    // 将种子对象编码为 Bencode 格式并创建 Blob
    // pieces 已在 createFromFile/createFromFolder 中转换为字符串，无需重复转换
    const blob = new Blob([new Uint8Array(Bencode.EncodeToBytes(torrentObject))], { type: "application/octet-stream" });
    
    // 保存到 IndexedDB
    await db.setItem('upload_autoSaveMessageTorrentBlob', blob);
    await db.setItem('upload_autoSaveMessageTorrentName', torrentObject.info.name);

    // 更新进度显示为完成状态
    DOMUtils.setStyle('.progress > div', 'width', "100%");
    DOMUtils.setText('[name="progress-total"]', '100%');
    DOMUtils.setText('[name="progress-name"]', '完成');
    
    // 禁用上传和创建按钮，启用下载和清理按钮
    DOMUtils.setAttr('#upload_torrent,#upload_file,#upload_folder,#torrent_create', 'disabled', true);
    DOMUtils.setAttr('#torrent_download,#torrent_clean', 'disabled', false);
    
    // 3秒后淡出进度条
    DOMUtils.fadeOut('[name="progress"]', 3000);
};



/**
 * 从单个文件创建种子（核心算法）
 * 将文件分块并计算每块的 SHA-1 哈希值
 * @param {Object} torrentObject - 种子对象
 */
const createFromFile = async torrentObject => {
    const infoObject = torrentObject.info;
    const file = AppState.get('singleFile');
    const fileSize = file.size;
    const blockSize = AppState.get('blockSize');
    
    // 创建 pieces 数组：每个块 20 字节（SHA-1 哈希长度）
    const pieces = new Uint8Array(20 * Math.ceil(fileSize / blockSize));

    infoObject["length"] = fileSize;
    let bytesProcessed = 0;

    // 初始化进度显示
    const progressUpdater = createProgressUpdater();
    DOMUtils.setText('[name="progress-name"]', file.name);
    DOMUtils.setText('[name="progress-total"]', '0%');

    // 顺序处理每个块
    for (let offset = 0, index = 0; offset < fileSize; offset += blockSize, index++) {
        try {
            // 读取文件块
            const chunk = file.slice(offset, offset + blockSize);
            const arrayBuffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = () => {
                    reader.abort();
                    reject(reader.error);
                };
                reader.readAsArrayBuffer(chunk);
            });

            // 计算块的 SHA-1 哈希
            const bytes = new Uint8Array(arrayBuffer);
            const hash = await crypto.subtle.digest('SHA-1', bytes);

            // 将哈希值存入 pieces 数组的对应位置
            pieces.set(new Uint8Array(hash), index * 20);
            bytesProcessed += bytes.length;

            // 更新进度
            progressUpdater.update(bytesProcessed, fileSize);
            DOMUtils.setText('[name="progress-percent"]', `${bytesProcessed} / ${fileSize}`);
        } catch (error) {
            failed(file.name, error);
            return;
        }
    }

    // 将 Uint8Array 转换为二进制字符串（Bencode 编码需要）
    infoObject["pieces"] = uint8ArrayToBinaryString(pieces);
    await finished();
};


/**
 * 从文件夹创建种子（核心算法）
 * 将多个文件视为连续的虚拟文件，按固定块大小分块并计算哈希
 * @param {Object} torrentObject - 种子对象
 */
const createFromFolder = async torrentObject => {
    try {
        const allFiles = AppState.get('allFiles');
        if (!allFiles || !torrentObject.info) return;

        const infoObject = torrentObject.info;
        const blockSize = AppState.get('blockSize');

        // 构建文件信息列表和计算总大小
        let totalSize = 0;
        const fileOffsets = [0];  // 每个文件在虚拟文件中的起始偏移量

        infoObject["files"] = allFiles.map(file => {
            totalSize += file.size;
            fileOffsets.push(totalSize);
            return {
                "length": file.size,
                "path": file.webkitRelativePath.split("/").slice(1)  // 去掉根文件夹名
            };
        });

        // 创建 pieces 数组
        const pieces = new Uint8Array(20 * Math.ceil(totalSize / blockSize));

        // 初始化进度更新器
        const progressUpdater = createProgressUpdater();

        DOMUtils.setText('[name="progress-name"]', '正在处理文件...');
        DOMUtils.setText('[name="progress-percent"]', `0 / ${allFiles.length}`);
        DOMUtils.setText('[name="progress-total"]', '0%');

        /**
         * 根据全局偏移量找到对应的文件和文件内偏移
         * @param {number} globalOffset - 在虚拟文件中的全局偏移量
         * @returns {Object|null} 文件信息
         */
        const findFileAndOffset = globalOffset => {
            for (let i = 0; i < allFiles.length; i++) {
                if (globalOffset >= fileOffsets[i] && globalOffset < fileOffsets[i + 1]) {
                    return {
                        fileIndex: i,
                        file: allFiles[i],
                        offsetInFile: globalOffset - fileOffsets[i]  // 文件内的相对偏移
                    };
                }
            }
            return null;
        };

        /**
         * 读取指定全局范围的数据（可能跨越多个文件）
         * @param {number} start - 起始全局偏移量
         * @param {number} length - 要读取的长度
         * @returns {Uint8Array} 读取的数据
         */
        const readGlobalRange = async (start, length) => {
            const buffer = new Uint8Array(length);
            let bufferOffset = 0;
            let currentPos = start;

            // 可能需要从多个文件中读取数据
            while (bufferOffset < length) {
                const info = findFileAndOffset(currentPos);
                if (!info) break;

                // 计算本次读取大小（不超过当前文件剩余大小和缓冲区剩余大小）
                const remainingInFile = info.file.size - info.offsetInFile;
                const remainingInBuffer = length - bufferOffset;
                const readSize = Math.min(remainingInFile, remainingInBuffer);

                // 读取文件片段
                const blob = info.file.slice(info.offsetInFile, info.offsetInFile + readSize);
                const arrayBuffer = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(reader.error);
                    reader.readAsArrayBuffer(blob);
                });

                // 将读取的数据复制到缓冲区
                buffer.set(new Uint8Array(arrayBuffer), bufferOffset);
                bufferOffset += readSize;
                currentPos += readSize;
            }

            return buffer;
        };

        // 按固定块大小处理整个虚拟文件
        let lastDisplayedFileIndex = -1;  // 用于避免重复更新文件名显示

        for (let chunkIndex = 0, globalOffset = 0; globalOffset < totalSize; chunkIndex++, globalOffset += blockSize) {
            const chunkLength = Math.min(blockSize, totalSize - globalOffset);

            // 更新进度显示（仅在文件切换时更新）
            const currentFileInfo = findFileAndOffset(globalOffset);
            if (currentFileInfo && currentFileInfo.fileIndex !== lastDisplayedFileIndex) {
                DOMUtils.setText('[name="progress-name"]', currentFileInfo.file.name);
                DOMUtils.setText('[name="progress-percent"]', `${currentFileInfo.fileIndex + 1} / ${allFiles.length}`);
                lastDisplayedFileIndex = currentFileInfo.fileIndex;
            }

            // 读取块数据并计算 SHA-1 哈希
            const chunkData = await readGlobalRange(globalOffset, chunkLength);
            const hash = await crypto.subtle.digest('SHA-1', chunkData);
            pieces.set(new Uint8Array(hash), chunkIndex * 20);

            // 更新进度
            progressUpdater.update(globalOffset + chunkLength, totalSize);
        }

        // 完成 - 将 Uint8Array 转换为二进制字符串
        infoObject["pieces"] = uint8ArrayToBinaryString(pieces);
        DOMUtils.setText('[name="progress-percent"]', `${allFiles.length} / ${allFiles.length}`);
        await finished();

    } catch (error) {
        failed('文件夹处理', error);
    }
};


/**
 * 处理文件读取失败
 * @param {string} fileName - 失败的文件名
 * @param {Error} error - 错误对象
 */
const failed = (fileName, error) => {
    let errorText = fileName ? `读取文件失败: ${fileName}` : "读取文件出错";
    if (error) {
        errorText += `\n原因: ${error.message} (${error.name})`;
        console.error(errorText);
        window.alert(errorText);
    }
};

// ==================== Bencode 编码器（精简版） ====================

// 工具函数
const textEncoder = new TextEncoder();
const toUTF8Array = str => textEncoder.encode(str);  // 字符串转 UTF-8 字节数组
const toByteArray = str => [...str].map(c => c.charCodeAt(0));  // 字符串转字节数组

/**
 * 将 Uint8Array 转换为二进制字符串
 * 每个字节作为一个字符（用于 pieces 字段）
 */
const uint8ArrayToBinaryString = uint8Array => String.fromCharCode.apply(null, uint8Array);

/**
 * 根据值类型创建对应的 Bencode 对象
 * @param {*} value - 要编码的值
 * @returns {BencodeInt|BencodeString|BencodeList|BencodeDict|null}
 */
const getBencodeObject = value => {
    if (!value && value !== 0) return null;
    const type = typeof value;
    if (type === "number") return new BencodeInt(value);
    if (type === "string") return new BencodeString(value);
    return Array.isArray(value) ? new BencodeList(value) : new BencodeDict(value);
};

/**
 * Bencode 字典类
 * 编码格式: d<key1><value1><key2><value2>...e
 * 键必须按字典序排序
 */
class BencodeDict {
    constructor(dict) {
        this.data = {};
        // 将对象的每个属性转换为 Bencode 对象
        Object.keys(dict).forEach(key => {
            const bencodeValue = getBencodeObject(dict[key]);
            if (bencodeValue) this.data[key] = bencodeValue;
        });
    }
    
    /**
     * 编码为字节数组
     * @param {Array} array - 输出字节数组
     */
    encode(array) {
        array.push(100); // 'd' (ASCII 100)
        
        // 按字典序排序键并编码
        Object.keys(this.data).sort().forEach(key => {
            const value = this.data[key];
            getBencodeObject(key).encode(array);  // 先编码键
            
            // pieces 字段需要特殊处理为二进制字符串（不进行 UTF-8 编码）
            if (key === "pieces" && value instanceof BencodeString) {
                array.push(...toByteArray(value.value.length.toString()), 58, ...toByteArray(value.value));
            } else {
                value.encode(array);  // 再编码值
            }
        });
        
        array.push(101); // 'e' (ASCII 101)
    }
}

/**
 * Bencode 列表类
 * 编码格式: l<item1><item2>...e
 */
class BencodeList {
    constructor(list) {
        // 将数组的每个元素转换为 Bencode 对象
        this.data = list.map(item => getBencodeObject(item)).filter(Boolean);
    }
    
    /**
     * 编码为字节数组
     * @param {Array} array - 输出字节数组
     */
    encode(array) {
        array.push(108); // 'l' (ASCII 108)
        this.data.forEach(item => item.encode(array));
        array.push(101); // 'e' (ASCII 101)
    }
}

/**
 * Bencode 字符串类
 * 编码格式: <length>:<string>
 * 例如: "spam" -> "4:spam"
 */
class BencodeString {
    constructor(value) {
        this.value = value;
    }
    
    /**
     * 编码为字节数组
     * @param {Array} array - 输出字节数组
     */
    encode(array) {
        const utf8 = toUTF8Array(this.value);
        // 格式: 长度 + ':' + UTF-8 字节
        array.push(...toByteArray(utf8.length.toString()), 58, ...utf8);  // 58 是 ':' 的 ASCII
    }
}

/**
 * Bencode 整数类
 * 编码格式: i<number>e
 * 例如: 42 -> "i42e"
 */
class BencodeInt {
    constructor(value) {
        this.value = value;
    }
    
    /**
     * 编码为字节数组
     * @param {Array} array - 输出字节数组
     */
    encode(array) {
        // 格式: 'i' + 数字字符串 + 'e'
        array.push(105, ...toByteArray(this.value.toString()), 101); // 105='i', 101='e'
    }
}

/**
 * Bencode 编码器主入口
 */
const Bencode = {
    /**
     * 将字典编码为字节数组
     * @param {Object} dict - 要编码的字典对象
     * @returns {Array} 字节数组
     */
    EncodeToBytes: dict => {
        const result = [];
        new BencodeDict(dict).encode(result);
        return result;
    }
};
