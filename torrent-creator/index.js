"use strict";
// uglifyjs index.js -c -m -o index.min.js
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};


var allFiles = [];
var singleFile = null;
var totalSize;

function FolderSelected(files) {
    const excludedFiles = ['Thumbs.db', '.DS_Store', 'desktop.ini'];
    const folderName = files[0]?.webkitRelativePath?.split("/")[0];
    allFiles = files.filter(file => !excludedFiles.includes(file.name));
    totalSize = allFiles.reduce((size, file) => size + file.size, 0);
    console.log(allFiles);
    return folderName;
}

console.log('本地模式');

function FileSelected(files) {
    singleFile = files[0];
    let fileName = singleFile.name;
    totalSize = singleFile.size;
    allFiles = null;
    return fileName;
};

var torrentChanged = false;
var trackersOverlayVisible = false;
// var creationInProgress = false;
var creationFinished = false;
var blockSize = 16 * 1024 * 1024; // 种子区块大小
var torrentObject = null;

function SetTorrentData(f_name) {
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
        // errorTextDiv.style.display = "";
        return false;
    };

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
    return true;
};

async function CreateTorrentFile(emfile) {
    let f_name = FileSelected(emfile);
    if (!SetTorrentData(f_name) || !torrentObject) return;
    torrentChanged = false;
    // creationInProgress = true;
    creationFinished = false;
    await CreateFromFile(torrentObject);
};

async function CreateTorrentFolder(emfile) {
    let f_name = FolderSelected(emfile);
    if (!SetTorrentData(f_name) || !torrentObject) return;
    torrentChanged = false;
    // creationInProgress = true;
    creationFinished = false;
    await CreateFromFolder(torrentObject);
};

// var blobUrl;
// var torrent_blob; // 种子文件
async function Finished() {
    const db = localforage.createInstance({ name: "bbcodejs" });
    creationFinished = true;
    if (!torrentObject || !torrentObject.info) return;
    let pieceBytes = torrentObject.info["pieces"];
    let pieceStr = "";
    for (let i = 0; i < pieceBytes.length; ++i) pieceStr += String.fromCharCode(pieceBytes[i]);
    torrentObject.info["pieces"] = pieceStr;
    let blob = new Blob([new Uint8Array(Bencode.EncodeToBytes(torrentObject))], { type: "application/octet-stream" });
    await db.setItem(`upload_autoSaveMessageTorrentBlob`, blob)
    await db.setItem(`upload_autoSaveMessageTorrentName`, torrentObject.info.name);
    $('.progress > div').css('width', "100%");  // 整体进度
    $('[name="progress-total"]').text('100%');
    $('[name="progress-name"]').text('Done.');
    $('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止按钮
    $('#torrent_download,#torrent_clean').attr('disabled', false);  // 解除按钮禁用
    $('[name="progress"]').fadeOut(3000);  // 渐出进度一栏
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

const CreateFromFile = (obj) => {
    return new Promise((resolve) => {
        let infoObject = obj.info;
        let chunkSize = infoObject["piece length"];
        let file = singleFile;
        let fileSize = file.size;
        let readChunkSize = 16 * 1024 * 1024;
        let blocksPerChunk = readChunkSize / blockSize;
        let maxBlockCount = Math.ceil(fileSize / blockSize);
        let pieces = new Uint8Array(20 * maxBlockCount);
        infoObject["length"] = fileSize;
        // let bytesReadSoFar = 0;
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
                        $('.progress > div').css('width', percent + "%")  // 整体进度
                        $('[name="progress-name"]').text(file.name);
                        $('[name="progress-percent"]').text(bytesProcessedSoFar + ' / ' + fileSize);
                        $('[name="progress-total"]').text(percent.toFixed(2) + '%');
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
            await Finished();
            $('[name="progress-name"]').text('Done.');
            resolve();
        }).catch(error => {
            Failed(singleFile && singleFile.name, error);
        });

    });
};

const CreateFromFolder = async (obj) => {
    return new Promise(async (resolve) => {
        if (!allFiles || !obj.info) return;
        let infoObject = obj.info;
        let chunkSize = infoObject["piece length"];
        // let bytesReadSoFar = 0;
        let bytesProcessedSoFar = 0;
        let readChunkSize = 16 * 1024 * 1024;
        let currentChunk = new Uint8Array(readChunkSize);
        let currentChunkDataIndex = 0;
        let chunkIndex = 0;  // 写入pieces时的切片索引值
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
                            $('.progress > div').css('width', percent + "%")  // 整体进度
                            $('[name="progress-total"]').text(percent.toFixed(2) + '%');
                            await MaybeFinished();
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
                                    await MaybeFinished();
                                    resolve()
                                });
                            } else {
                                await MaybeFinished();
                                resolve()
                            };
                            // console.log("All files read");
                        } else {
                            // some files are still left
                            currentFile = files[fileIndex];
                            fileSize = currentFile.size;
                            readStartIndex = 0;
                            $('[name="progress-name"]').text(currentFile.name);
                            $('[name="progress-percent"]').text((fileIndex + 1) + ' / ' + allFiles.length);
                            run();
                        };
                    };
                });
            };

            reader.onerror = function () {
                Failed(currentFile.name, fr.error);
            };

        };

        async function MaybeFinished() {
            if (processedBlockCount >= totalBlockCount) {
                infoObject["pieces"] = Array.from(pieces);
                $('[name="progress-percent"]').text(allFiles.length + ' / ' + allFiles.length);
                await Finished();
                resolve(1);
            };
        };

        $('[name="progress-name"]').text(currentFile.name);
        // $('[name="progress-percent"]').text('132644 / ' + totalSize);
        $('[name="progress-percent"]').text('1 / ' + allFiles.length);
        $('[name="progress-total"]').text('0%');

        run();

    });

};

function Failed(fileName, err) {
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
var BencodeObject = /** @class */ (function () {
    function BencodeObject() {
    }
    BencodeObject.prototype.encode = function (_array) { };
    BencodeObject.prototype.getBencodeObject = function (obj) {
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
    };
    return BencodeObject;
}());
var BencodeDict = /** @class */ (function (_super) {
    __extends(BencodeDict, _super);
    function BencodeDict(obj) {
        let _this = _super.call(this) || this;
        _this.data = {};
        for (let key in obj) {
            let bencodeObj = _this.getBencodeObject(obj[key]);
            if (bencodeObj)
                _this.data[key] = bencodeObj;
        }
        return _this;
    }
    BencodeDict.prototype.encodeBinaryString = function (array, str) {
        let bytesCount = str.length;
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        let strBytes = toByteArray(str);
        for (let i = 0; i < strBytes.length; ++i)
            array.push(strBytes[i]);
    };
    BencodeDict.prototype.encode = function (array) {
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
    };
    return BencodeDict;
}(BencodeObject));
var BencodeList = /** @class */ (function (_super) {
    __extends(BencodeList, _super);
    function BencodeList(list) {
        let _this = _super.call(this) || this;
        _this.data = [];
        for (let i = 0; i < list.length; ++i) {
            let bencodeObj = _this.getBencodeObject(list[i]);
            if (bencodeObj)
                _this.data.push(bencodeObj);
        }
        return _this;
    }
    BencodeList.prototype.encode = function (array) {
        array.push("l".charCodeAt(0));
        for (let i = 0; i < this.data.length; ++i)
            this.data[i].encode(array);
        array.push("e".charCodeAt(0));
    };
    return BencodeList;
}(BencodeObject));
var BencodeString = /** @class */ (function (_super) {
    __extends(BencodeString, _super);
    function BencodeString(value) {
        let _this = _super.call(this) || this;
        _this.value = value;
        return _this;
    }
    BencodeString.prototype.encode = function (array) {
        let bytesCount = stringByteCount(this.value);
        array.push.apply(array, toByteArray(bytesCount.toString()));
        array.push(":".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value));
    };
    return BencodeString;
}(BencodeObject));
var BencodeInt = /** @class */ (function (_super) {
    __extends(BencodeInt, _super);
    function BencodeInt(value) {
        let _this = _super.call(this) || this;
        _this.value = value;
        return _this;
    }
    BencodeInt.prototype.encode = function (array) {
        array.push("i".charCodeAt(0));
        array.push.apply(array, toUTF8Array(this.value.toString()));
        array.push("e".charCodeAt(0));
    };
    return BencodeInt;
}(BencodeObject));

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
function SetupSha1WithoutWorkers() {
    let sha1ScriptLoaded = false;
    let waitingResolvers = [];
    function EnsureSha1ScriptLoaded() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!sha1ScriptLoaded) return [3 /*break*/, 2];
                        return [4 /*yield*/, new Promise(function (resolve) { return waitingResolvers.push(resolve); })];
                    case 1:
                        _a.sent();
                        _a.label = 2;
                    case 2: return [2 /*return*/];
                }
            });
        });
    }
    let script = document.createElement("script");
    script.src = "https://userscript.kysdm.com/js/sha1.js";
    script.onload = function () {
        sha1ScriptLoaded = true;
        waitingResolvers.forEach(function (resolve) { return resolve(); });
        waitingResolvers.length = 0;
    };
    document.body.appendChild(script);
    sha1 = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, EnsureSha1ScriptLoaded()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, ProcessSha1Data(data)];
                }
            });
        });
    };
};

(async () => {
    const sha1_js = () => {
        return new Promise((resolve, reject) => {
            fetch('https://userscript.kysdm.com/js/sha1.js',
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
    let workers = [];
    let workersAvailable = true;
    if (location.protocol === "https:" || location.protocol === "http:") {
        try {
            for (let i = 0; i < maxWorkerCount; ++i) {
                workers.push(new Worker(sha1_js_url));
            }
        } catch (e) {
            console.log('添加线程发生错误: ' + e);
            workersAvailable = false;
        }
    }
    else {
        // workers are only available when using http/https
        workersAvailable = false;
    }
    if (!workersAvailable) {
        // fall back to single threaded version
        console.warn('fall back to single threaded version');
        SetupSha1WithoutWorkers();
        return;
    }
    let busyWorkers = new Set();
    let waitingTasks = [];
    function EnqueueWorkerTask(data, callback) {
        let selectedWorker = null;
        let selectedIndex;
        for (let i = 0; i < maxWorkerCount; ++i) {
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
            busyWorkers["delete"](selectedIndex);
            if (waitingTasks.length !== 0) {
                let task = waitingTasks.shift();
                if (task)
                    EnqueueWorkerTask(task.data, task.callback);
            };
            callback(ev.data);
        };
    };
    // console.log('sha1加载完成');
    // 当sha1函数完成加载，解除按钮禁用
    document.getElementById('upload_file').disabled = false;
    document.getElementById('upload_folder').disabled = false;
    document.getElementById('torrent_create').disabled = false;

    sha1 = function (data) {
        return new Promise(function (resolve) { return EnqueueWorkerTask(data, resolve); });
    };
})();
// Array.from polyfill
if (typeof Array.from === "undefined") {
    Array.from = function (arrayLike) {
        let len = arrayLike.length;
        let ret = new Array(len);
        for (let i = 0; i < len; ++i)
            ret[i] = arrayLike[i];
        return ret;
    };
};
