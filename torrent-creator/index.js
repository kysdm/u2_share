"use strict";
// uglifyjs index.js -c -m -o index.min.js


var DOMUtils = {
    // 查询单个元素
    query: function (selector) {
        return document.querySelector(selector);
    },
    // 查询所有元素
    queryAll: function (selector) {
        return document.querySelectorAll(selector);
    },
    // 设置元素文本
    setText: function (selector, text) {
        var elements = this.queryAll(selector);
        for (var i = 0; i < elements.length; i++) {
            elements[i].textContent = text;
        }
    },
    // 设置元素 CSS 样式
    setStyle: function (selector, property, value) {
        var elements = this.queryAll(selector);
        for (var i = 0; i < elements.length; i++) {
            elements[i].style[property] = value;
        }
    },
    // 设置元素属性
    setAttr: function (selector, attr, value) {
        var elements = this.queryAll(selector);
        for (var i = 0; i < elements.length; i++) {
            if (attr in elements[i]) {
                elements[i][attr] = value;
            } else {
                elements[i].setAttribute(attr, value);
            }
        }
    },
    // 淡出动画（简化版）
    fadeOut: function (selector, duration) {
        var elements = this.queryAll(selector);
        duration = duration || 300;
        var stepTime = 16; // 约 60fps
        var steps = Math.ceil(duration / stepTime);

        for (var i = 0; i < elements.length; i++) {
            (function (element) {
                var initialOpacity = parseFloat(window.getComputedStyle(element).opacity) || 1;
                var opacityStep = initialOpacity / steps;
                var currentStep = 0;

                var fadeInterval = setInterval(function () {
                    currentStep++;
                    var newOpacity = initialOpacity - (opacityStep * currentStep);
                    element.style.opacity = Math.max(0, newOpacity);

                    if (currentStep >= steps) {
                        element.style.opacity = '0';
                        element.style.display = 'none';
                        clearInterval(fadeInterval);
                    }
                }, stepTime);
            })(elements[i]);
        }
    }
};

var AppState = (function () {
    var state = {
        allFiles: [],
        singleFile: null,
        totalSize: 0,
        torrentChanged: false,
        trackersOverlayVisible: false,
        creationFinished: false,
        blockSize: 16 * 1024 * 1024, // 种子区块大小
        torrentObject: null
    };

    return {
        get: function (key) {
            return state[key];
        },
        set: function (key, value) {
            state[key] = value;
        },
        reset: function () {
            state.allFiles = [];
            state.singleFile = null;
            state.totalSize = 0;
            state.torrentChanged = false;
            state.torrentObject = null;
        }
    };
})();

function folderSelected(files) {
    const excludedFiles = ['Thumbs.db', '.DS_Store', 'desktop.ini'];
    const folderName = files[0]?.webkitRelativePath?.split("/")[0];
    AppState.set('allFiles', [...files].filter(file => !excludedFiles.includes(file.name)));
    AppState.set('totalSize', AppState.get('allFiles').reduce((size, file) => size + file.size, 0));
    console.log(AppState.get('allFiles'));
    return folderName;
}

function fileSelected(files) {
    AppState.set('singleFile', files[0]);
    let fileName = AppState.get('singleFile').name;
    AppState.set('totalSize', AppState.get('singleFile').size);
    AppState.set('allFiles', null);
    return fileName;
};

function setTorrentData(f_name) {
    let torrentName = f_name.trim();
    // console.log(torrentName);
    if (torrentName === "") {
        window.alert("Torrent name must not be empty");
        return false;
    };
    if (torrentName.match(/[<>:\"\\\/\|\?\*]/)) {
        window.alert("Torrent name cannot contain any of the following characters: < > : \\ / | ? *");
        return false;
    };
    if (torrentName.length > 255) {
        window.alert("Torrent name cannot be longer than 255 characters");
        return false;
    };

    let torrentObject = AppState.get('torrentObject');
    let blockSize = AppState.get('blockSize');
    let infoObject = (torrentObject && torrentObject["info"]) || { name: "", pieces: "", "piece length": 0 };
    torrentObject = { "info": infoObject };
    torrentObject["announce"] = 'https://daydream.dmhy.best/announce';
    // torrentObject["announce-list"] = [];
    torrentObject["creation date"] = (Date.now() / 1000) | 0;  // 种子创建时间
    torrentObject["created by"] = "https://u2.dmhy.org/forums.php?action=viewtopic&topicid=13384";  // 创建客户端
    infoObject["private"] = 1;  // 私有种子
    infoObject["name"] = torrentName;  // 种子名称
    infoObject["piece length"] = blockSize;  // 区块大小 默认16M
    infoObject["source"] = ''; // 来源
    AppState.set('torrentObject', torrentObject);
    return true;
};

async function createTorrentFile(emfile) {
    let f_name = fileSelected(emfile);
    if (!setTorrentData(f_name) || !AppState.get('torrentObject')) return;
    AppState.set('torrentChanged', false);
    // creationInProgress = true;
    AppState.set('creationFinished', false);
    await createFromFile(AppState.get('torrentObject'));
};

async function createTorrentFolder(emfile) {
    let f_name = folderSelected(emfile);
    if (!setTorrentData(f_name) || !AppState.get('torrentObject')) return;
    AppState.set('torrentChanged', false);
    // creationInProgress = true;
    AppState.set('creationFinished', false);
    await createFromFolder(AppState.get('torrentObject'));
};

async function finished() {
    const db = localforage.createInstance({ name: "bbcodejs" });
    AppState.set('creationFinished', true);
    let torrentObject = AppState.get('torrentObject');
    if (!torrentObject || !torrentObject.info) return;
    let pieceBytes = torrentObject.info["pieces"];
    let pieceStr = "";
    for (let i = 0; i < pieceBytes.length; ++i) pieceStr += String.fromCharCode(pieceBytes[i]);
    torrentObject.info["pieces"] = pieceStr;
    let blob = new Blob([new Uint8Array(Bencode.EncodeToBytes(torrentObject))], { type: "application/octet-stream" });
    await db.setItem(`upload_autoSaveMessageTorrentBlob`, blob)
    await db.setItem(`upload_autoSaveMessageTorrentName`, torrentObject.info.name);
    DOMUtils.setStyle('.progress > div', 'width', "100%");  // 整体进度
    DOMUtils.setText('[name="progress-total"]', '100%');
    DOMUtils.setText('[name="progress-name"]', 'Done.');
    DOMUtils.setAttr('#upload_torrent,#upload_file,#upload_folder,#torrent_create', 'disabled', true);  // 禁止按钮
    DOMUtils.setAttr('#torrent_download,#torrent_clean', 'disabled', false);  // 解除按钮禁用
    DOMUtils.fadeOut('[name="progress"]', 3000);  // 渐出进度一栏
};

function limitPromisePool(tasks, limit) {
    return new Promise((resolve, reject) => {
        const results = [];
        let running = 0;
        let current = 0;

        function runTask(task) {
            running++;
            task().then(result => {
                results.push(result);
                running--;
                runNext();
            }).catch(reject);
        };

        function runNext() {
            while (running < limit && current < tasks.length) runTask(tasks[current++]);
            if (running === 0) resolve(results);
        };

        runNext();
    });
};

const createFromFile = (obj) => {
    return new Promise((resolve) => {
        let infoObject = obj.info;
        let chunkSize = infoObject["piece length"];
        let file = AppState.get('singleFile');
        let fileSize = file.size;
        let readChunkSize = 16 * 1024 * 1024;
        let blockSize = AppState.get('blockSize');
        let blocksPerChunk = readChunkSize / blockSize;
        let maxBlockCount = Math.ceil(fileSize / blockSize);
        let pieces = new Uint8Array(20 * maxBlockCount);
        infoObject["length"] = fileSize;
        let bytesProcessedSoFar = 0;  // 已经处理的块数量

        function readAndProcessChunk(chunk, index) {
            // 读取和处理文件块
            return new Promise((resolve, reject) => {

                let reader = new FileReader();

                reader.onload = (event) => {
                    let bytes = new Uint8Array(event.target.result);
                    let byteCount = bytes.length;
                    // bytesReadSoFar += byteCount;
                    sha1({ data: bytes, blockSize: chunkSize, readChunkSize: readChunkSize }).then(function (result) {
                        // console.log(result);
                        pieces.set(result, index * blocksPerChunk * 20);
                        bytesProcessedSoFar += byteCount;
                        let percent = bytesProcessedSoFar / fileSize * 100;
                        DOMUtils.setStyle('.progress > div', 'width', percent + "%")  // 整体进度
                        DOMUtils.setText('[name="progress-name"]', file.name);
                        DOMUtils.setText('[name="progress-percent"]', bytesProcessedSoFar + ' / ' + fileSize);
                        DOMUtils.setText('[name="progress-total"]', percent.toFixed(2) + '%');
                        bytes = null;
                        resolve(index);
                    });
                };
                reader.onerror = (error) => {
                    reader.abort();
                    reject(error);
                };
                reader.readAsArrayBuffer(chunk);

            });

        };

        function run() {
            const tasks = [];  // Promise 数组
            for (let offset = 0, index = 0; offset < file.size; offset += readChunkSize, index++) {
                tasks.push(() => readAndProcessChunk(file.slice(offset, offset + readChunkSize), index));
            };
            return tasks;
        };

        limitPromisePool(run(), maxWorkerCount).then(async () => {
            infoObject["pieces"] = Array.from(pieces);
            await finished();
            DOMUtils.setText('[name="progress-name"]', 'Done.');
            resolve();
        }).catch(error => {
            let singleFile = AppState.get('singleFile');
            failed(singleFile && singleFile.name, error);
        });

    });
};

const createFromFolder = async (obj) => {
    return new Promise(async (resolve) => {
        let allFiles = AppState.get('allFiles');
        if (!allFiles || !obj.info) return;
        let infoObject = obj.info;
        let chunkSize = infoObject["piece length"];
        // let bytesReadSoFar = 0;
        let bytesProcessedSoFar = 0;
        let readChunkSize = 16 * 1024 * 1024;
        let currentChunk = new Uint8Array(readChunkSize);
        let currentChunkDataIndex = 0;
        let chunkIndex = 0;  // 写入pieces时的切片索引值
        let blockSize = AppState.get('blockSize');
        let blocksPerChunk = readChunkSize / blockSize;
        let totalSize = 0;  // 总体积
        let fileInfos = [];

        for (let i = 0; i < allFiles.length; ++i) {
            let currentFileInfo = allFiles[i];
            let currentFileSize = currentFileInfo.size;
            totalSize += currentFileSize;
            fileInfos.push({
                "length": currentFileSize,
                "path": currentFileInfo.webkitRelativePath.split("/").slice(1)
            });
        }

        let totalBlockCount = Math.ceil(totalSize / chunkSize);  // 总切割块数量
        let pieces = new Uint8Array(totalBlockCount * 20);
        let processedBlockCount = 0;  // 总切片计算结果数量
        infoObject["files"] = fileInfos;
        let fileIndex = 0;  // 处理文件的索引号
        let files = allFiles;
        let currentFile = files[0];  // 当前处理的文件
        let readStartIndex = 0;  // 切片起始位置
        let fileSize = currentFile.size;  // 当前处理的文件大小
        let currentWorkerCount = 0;
        let waitingForWorkers = false;

        function run() {
            let bytes, byteIndex, localChunk, currentChunkIndex_1;

            if (currentWorkerCount === maxWorkerCount) {
                waitingForWorkers = true;
                return;
            };

            let reader = new FileReader();
            reader.readAsArrayBuffer(currentFile.slice(readStartIndex, readStartIndex + readChunkSize));
            readStartIndex += readChunkSize;

            waitingForWorkers = false;

            reader.onloadend = function (ev) {
                return new Promise(async (resolve) => {
                    bytes = new Uint8Array(ev.target.result);
                    // byteCount = bytes.length;
                    if (currentChunkDataIndex + bytes.length >= readChunkSize) {  // readChunkSize 单次读取的块大小  || currentChunkDataIndex 初始是0
                        byteIndex = readChunkSize - currentChunkDataIndex;  //  16 * 1024 * 1024 - 0   byteIndex 字节索引
                        currentChunk.set(bytes.subarray(0, byteIndex), currentChunkDataIndex);  // Uint8Array对象 大小 16 * 1024 * 1024   创建一个新的chunk，防止位于文件结尾和开头
                        localChunk = currentChunk;
                        currentChunk = new Uint8Array(readChunkSize);
                        currentChunkIndex_1 = chunkIndex++;  // 写入pieces时的切片索引值
                        currentWorkerCount++;
                        sha1({ data: localChunk, blockSize: chunkSize, readChunkSize: readChunkSize }).then(async function (result) {
                            processedBlockCount += blocksPerChunk;
                            pieces.set(result, currentChunkIndex_1 * blocksPerChunk * 20);
                            currentWorkerCount--;
                            if (waitingForWorkers) { waitingForWorkers = false; run(); };
                            bytesProcessedSoFar += readChunkSize;
                            let percent = bytesProcessedSoFar / totalSize * 100;
                            DOMUtils.setStyle('.progress > div', 'width', percent + "%")  // 整体进度
                            DOMUtils.setText('[name="progress-total"]', percent.toFixed(2) + '%');
                            await maybeFinished();
                            resolve()
                        });
                        // set the remaining data
                        currentChunk.set(bytes.subarray(byteIndex), 0);
                        currentChunkDataIndex = bytes.length - byteIndex;
                    } else {
                        // just add to the buffer 拼接不足20块的数据
                        currentChunk.set(bytes, currentChunkDataIndex);
                        currentChunkDataIndex += bytes.length;
                    };

                    if (readStartIndex < fileSize) {
                        // current file is not finished yet
                        run();
                    } else {
                        // current file is finished, check if we have any more files left
                        if (++fileIndex === files.length) {
                            // all files are processed, calculate the hash of the current buffer data
                            if (currentChunkDataIndex !== 0) {
                                sha1({ data: currentChunk, blockSize: chunkSize, readChunkSize: currentChunkDataIndex }).then(async function (result) {
                                    processedBlockCount += blocksPerChunk;
                                    pieces.set(result, chunkIndex * blocksPerChunk * 20);
                                    await maybeFinished();
                                    resolve()
                                });
                            } else {
                                await maybeFinished();
                                resolve()
                            };
                        } else {
                            // some files are still left
                            currentFile = files[fileIndex];
                            fileSize = currentFile.size;
                            readStartIndex = 0;
                            DOMUtils.setText('[name="progress-name"]', currentFile.name);
                            DOMUtils.setText('[name="progress-percent"]', (fileIndex + 1) + ' / ' + allFiles.length);
                            run();
                        };
                    };
                });
            };

            reader.onerror = function () {
                failed(currentFile.name, fr.error);
            };

        };

        async function maybeFinished() {
            if (processedBlockCount >= totalBlockCount) {
                infoObject["pieces"] = Array.from(pieces);
                DOMUtils.setText('[name="progress-percent"]', allFiles.length + ' / ' + allFiles.length);
                await finished();
                resolve(1);
            };
        };

        DOMUtils.setText('[name="progress-name"]', currentFile.name);
        DOMUtils.setText('[name="progress-percent"]', '1 / ' + allFiles.length);
        DOMUtils.setText('[name="progress-total"]', '0%');

        run();

    });

};

function failed(fileName, err) {
    var errorText = fileName ? ("Failed to read file: " + fileName) : "Error reading file";
    if (err) {
        errorText += "\nReason: " + err.message + " (" + err.name + ")";
        console.error(errorText);
        window.alert(errorText);
    };
};


// bencode
function toUTF8Array(str) {
    let utf8 = [];
    for (let i = 0; i < str.length; ++i) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80)
            utf8.push(charcode);
        else if (charcode < 0x800)
            utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
        else if (charcode < 0xd800 || charcode >= 0xe000)
            utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        else {
            ++i;
            charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18), 0x80 | ((charcode >> 12) & 0x3f), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}
function stringByteCount(str) {
    let count = 0;
    for (let i = 0; i < str.length; ++i) {
        let charcode = str.charCodeAt(i);
        if (charcode < 0x80)
            ++count;
        else if (charcode < 0x800)
            count += 2;
        else if (charcode < 0xd800 || charcode >= 0xe000)
            count += 3;
        else {
            ++i;
            count += 4;
        }
    }
    return count;
}
function toByteArray(str) {
    let ret = [];
    for (let i = 0; i < str.length; ++i)
        ret.push(str.charCodeAt(i));
    return ret;
}
class BencodeObject {
    encode(_array) { }
    getBencodeObject(obj) {
        if (obj === null || obj === undefined)
            return null;
        switch (typeof obj) {
            case "number":
                return new BencodeInt(obj);
            case "string":
                return new BencodeString(obj);
            case "object":
                {
                    if (Array.isArray(obj))
                        return new BencodeList(obj);
                    else
                        return new BencodeDict(obj);
                }
        }
        return null;
    }
}
class BencodeDict extends BencodeObject {
    constructor(obj) {
        super();
        this.data = {};
        for (let key in obj) {
            let bencodeObj = this.getBencodeObject(obj[key]);
            if (bencodeObj)
                this.data[key] = bencodeObj;
        }
    }
    encodeBinaryString(array, str) {
        let bytesCount = str.length;
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        let strBytes = toByteArray(str);
        for (let i = 0; i < strBytes.length; ++i)
            array.push(strBytes[i]);
    }
    encode(array) {
        array.push("d".charCodeAt(0));
        let sortedKeys = Object.keys(this.data).sort();
        for (let i = 0; i < sortedKeys.length; ++i) {
            let currentKey = sortedKeys[i];
            let currentObject = this.data[currentKey];
            let bencodedKeyObject = this.getBencodeObject(currentKey);
            if (bencodedKeyObject) {
                bencodedKeyObject.encode(array);
                if (currentKey === "pieces" && currentObject instanceof BencodeString)
                    this.encodeBinaryString(array, currentObject.value);
                else
                    currentObject.encode(array);
            }
        }
        array.push("e".charCodeAt(0));
    }
}
class BencodeList extends BencodeObject {
    constructor(list) {
        super();
        this.data = [];
        for (let i = 0; i < list.length; ++i) {
            let bencodeObj = this.getBencodeObject(list[i]);
            if (bencodeObj)
                this.data.push(bencodeObj);
        }
    }
    encode(array) {
        array.push("l".charCodeAt(0));
        for (let i = 0; i < this.data.length; ++i)
            this.data[i].encode(array);
        array.push("e".charCodeAt(0));
    }
}
class BencodeString extends BencodeObject {
    constructor(value) {
        super();
        this.value = value;
    }
    encode(array) {
        let bytesCount = stringByteCount(this.value);
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value));
    }
}
class BencodeInt extends BencodeObject {
    constructor(value) {
        super();
        this.value = value;
    }
    encode(array) {
        array.push("i".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value.toString()));
        array.push("e".charCodeAt(0));
    }
}

var Bencode = {
    EncodeToBytes: function (obj) {
        let result = [];
        new BencodeDict(obj).encode(result);
        return result;
    }
};

var sha1;
// workers
var maxWorkerCount = Math.min(navigator.hardwareConcurrency || 1, 8); // use 8 workers at max, reading from disk will be the slowest anyways

// Worker 管理器
var WorkerManager = (function () {
    var workers = [];
    var busyWorkers = new Set();
    var waitingTasks = [];
    var sha1_js_url = null;
    var isActive = false;

    return {
        init: function (url) {
            sha1_js_url = url;
            isActive = true;
            if (location.protocol === "https:" || location.protocol === "http:") {
                try {
                    for (let i = 0; i < maxWorkerCount; ++i) {
                        workers.push(new Worker(sha1_js_url));
                    }
                } catch (e) {
                    console.log('添加线程发生错误: ' + e);
                    return false;
                }
            } else {
                return false;
            }
            return true;
        },
        enqueueTask: function (data, callback) {
            if (!isActive) {
                callback(new Error('Worker manager is not active'));
                return;
            }
            let selectedWorker = null;
            let selectedIndex;
            for (let i = 0; i < workers.length; ++i) {
                if (!busyWorkers.has(i)) {
                    selectedWorker = workers[i];
                    selectedIndex = i;
                    busyWorkers.add(i);
                    break;
                };
            };
            if (!selectedWorker) {
                waitingTasks.push({ data: data, callback: callback });
                return;
            };
            selectedWorker.postMessage(data, [data.data.buffer]);
            selectedWorker.onmessage = function (ev) {
                busyWorkers.delete(selectedIndex);
                if (waitingTasks.length !== 0) {
                    let task = waitingTasks.shift();
                    if (task)
                        this.enqueueTask(task.data, task.callback);
                };
                callback(ev.data);
            }.bind(this);
        },
        cleanup: function () {
            isActive = false;
            // 终止所有 Workers
            for (let i = 0; i < workers.length; ++i) {
                try {
                    workers[i].terminate();
                } catch (e) {
                    console.warn('终止 Worker 时出错:', e);
                }
            }
            // 清理引用
            workers = [];
            busyWorkers.clear();
            waitingTasks = [];
            // 清理 Blob URL
            if (sha1_js_url) {
                try {
                    URL.revokeObjectURL(sha1_js_url);
                } catch (e) {
                    console.warn('清理 Blob URL 时出错:', e);
                }
                sha1_js_url = null;
            }
        },
        isActive: function () {
            return isActive;
        }
    };
})();

function setupSha1WithoutWorkers() {
    let sha1ScriptLoaded = false;
    let waitingResolvers = [];
    async function ensureSha1ScriptLoaded() {
        if (!sha1ScriptLoaded) {
            await new Promise(function (resolve) { return waitingResolvers.push(resolve); });
        }
    }
    let script = document.createElement("script");
    script.src = "https://userscript.kysdm.com/js/sha1.js?v=1.1";
    script.onload = function () {
        sha1ScriptLoaded = true;
        waitingResolvers.forEach(function (resolve) { return resolve(); });
        waitingResolvers.length = 0;
    };
    document.body.appendChild(script);
    sha1 = async function (data) {
        await ensureSha1ScriptLoaded();
        return ProcessSha1Data(data);
    };
};

(async () => {
    const sha1_js = () => {
        return new Promise((resolve, reject) => {
            fetch('https://userscript.kysdm.com/js/sha1.js?v=1.1',
                {
                    headers: {
                        'Content-Type': 'application/javascript',
                    },
                    mode: 'cors'
                })
                .then(response => {
                    if (!response.ok) {
                        console.error('sha1.js 下载失败')
                        // console.error('Network response was not OK');
                        reject('Network response was not OK');
                    };
                    return response.text();
                }).then(t => {
                    window.URL = window.URL || window.webkitURL;
                    const blob = new Blob([t], { type: 'application/javascript' });
                    resolve(URL.createObjectURL(blob));
                })
                .catch(error => {
                    console.error('sha1.js 崩溃')
                    // console.error('There has been a problem with your fetch operation:', error);
                    reject(error);
                });
        });
    };
    const sha1_js_url = await sha1_js();
    // console.log(sha1_js_url);

    const workersAvailable = WorkerManager.init(sha1_js_url);
    if (!workersAvailable) {
        // fall back to single threaded version
        console.warn('fall back to single threaded version');
        setupSha1WithoutWorkers();
        return;
    }

    // console.log('sha1加载完成');
    // 当sha1函数完成加载，解除按钮禁用
    document.getElementById('upload_file').disabled = false;
    document.getElementById('upload_folder').disabled = false;
    document.getElementById('torrent_create').disabled = false;

    sha1 = function (data) {
        return new Promise(function (resolve) {
            WorkerManager.enqueueTask(data, resolve);
        });
    };

    // 页面卸载时清理 Workers
    window.addEventListener('beforeunload', function () {
        WorkerManager.cleanup();
    });

})();