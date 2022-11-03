"use strict";
var __extends = (this && this.__extends) || (function () {
    let extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (let p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
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
    let _ = { label: 0, sent: function () { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
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
    let folderName = (files[0].webkitRelativePath).split("/")[0];
    allFiles = [];
    totalSize = 0;
    for (let i = 0; i < files.length; ++i) {
        allFiles.push(files[i]);
        totalSize += files[i].size;
    };
    singleFile = null;
    return folderName;
};

function FileSelected(files) {
    singleFile = files[0];
    let fileName = singleFile.name;
    totalSize = singleFile.size;
    allFiles = null;
    return fileName;
};

var torrentChanged = false;
var trackersOverlayVisible = false;
var creationInProgress = false;
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
    torrentObject["announce-list"] = [];
    torrentObject["creation date"] = (Date.now() / 1000) | 0;  // 种子创建时间
    torrentObject["created by"] = "kimbatt.github.io/torrent-creator";  // 创建客户端
    infoObject["private"] = 1;  // 私有种子
    infoObject["name"] = torrentName;  // 种子名称
    infoObject["piece length"] = blockSize;  // 区块大小 默认16M
    infoObject["source"] = ''; // 来源
    return true;
};

function CreateTorrentFile(emfile) {
    let f_name = FileSelected(emfile);
    if (!SetTorrentData(f_name) || !torrentObject) return;
    torrentChanged = false;
    creationInProgress = true;
    creationFinished = false;
    CreateFromFile(torrentObject);
    return;
};

async function CreateTorrentFolder(emfile) {
    let f_name = FolderSelected(emfile);
    if (!SetTorrentData(f_name) || !torrentObject) return;
    torrentChanged = false;
    creationInProgress = true;
    creationFinished = false;
    await CreateFromFolder(torrentObject);
};

var blobUrl;
var blob; // 种子文件
function Finished() {
    creationFinished = true;
    if (!torrentObject || !torrentObject.info) return;
    let pieceBytes = torrentObject.info["pieces"];
    let pieceStr = "";
    for (let i = 0; i < pieceBytes.length; ++i) pieceStr += String.fromCharCode(pieceBytes[i]);
    torrentObject.info["pieces"] = pieceStr;
    new Blob();
    function UpdateBlob() {
        if (torrentObject)
            blob = new Blob([new Uint8Array(Bencode.EncodeToBytes(torrentObject))], { type: "application/octet-stream" });
    };
    UpdateBlob();
    let button = document.getElementById("torrent_download");
    let msSaveOrOpenBlob = window.navigator.msSaveOrOpenBlob;
    if (msSaveOrOpenBlob) {
        button.onclick = function () {
            if (torrentChanged) {
                if (!SetTorrentData()) return;
                UpdateBlob();
            };
            if (torrentObject && torrentObject.info) msSaveOrOpenBlob(blob, torrentObject.info.name + ".torrent");
        };
    } else {
        let a_1 = document.getElementById("download_link");
        a_1.download = torrentObject.info.name + ".torrent";
        window.URL.revokeObjectURL(blobUrl);
        blobUrl = window.URL.createObjectURL(blob);
        a_1.href = blobUrl;
        button.onclick = function () {
            if (torrentChanged) {
                if (!SetTorrentData() || !torrentObject || !torrentObject.info)
                    return;
                UpdateBlob();
                a_1.download = torrentObject.info.name + ".torrent";
                window.URL.revokeObjectURL(blobUrl);
                blobUrl = window.URL.createObjectURL(blob);
                a_1.href = blobUrl;
            };
            a_1.click();
        };
    };
    jq('.progress > div').css('width', "100%");  // 整体进度
    jq('[name="progress-total"]').text('100%');
    jq('[name="progress-name"]').text('Done.');
    jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止按钮
    jq('#torrent_download').attr('disabled', false);  // 解除按钮禁用
    jq('[name="progress"]').fadeOut(3000);  // 渐出进度一栏
    creationInProgress = false;
};


function CreateFromFile(obj) {
    let infoObject = obj.info;
    let chunkSize = infoObject["piece length"];
    let file = singleFile;
    let fileSize = file.size;
    let readChunkSize = 16777216;
    let maxChunkCount = Math.ceil(fileSize / readChunkSize);
    let blocksPerChunk = readChunkSize / blockSize;
    let maxBlockCount = Math.ceil(fileSize / blockSize);
    let pieces = new Uint8Array(20 * maxBlockCount);
    infoObject["length"] = fileSize;
    let bytesReadSoFar = 0;
    let readStartIndex = 0;
    let bytesProcessedSoFar = 0;
    let fr = new FileReader();
    let currentWorkerCount = 0;
    function reader() {
        if (!creationInProgress)
            return;
        if (currentWorkerCount === maxWorkerCount) {
            waitingForWorkers = true;
            return;
        };
        fr.readAsArrayBuffer(file.slice(readStartIndex, readStartIndex + readChunkSize));
        readStartIndex += readChunkSize;
    };
    let chunkIndex = 0;
    let waitingForWorkers = false;
    fr.onloadend = function (ev) {
        return __awaiter(this, void 0, void 0, function () {
            let currentChunkIndex, bytes, byteCount;
            return __generator(this, function (_a) {
                if (!ev.target || !(ev.target.result instanceof ArrayBuffer))
                    return [2 /*return*/];
                ++currentWorkerCount;
                currentChunkIndex = chunkIndex++;
                bytes = new Uint8Array(ev.target.result);
                byteCount = bytes.length;
                bytesReadSoFar += byteCount;
                // progressBarStyle.width = (bytesReadSoFar / fileSize * 100) + "%";
                // jq('.progress > div').css('width', (bytesReadSoFar / fileSize * 100) + "%")  // 单个进度
                sha1({ data: bytes, blockSize: chunkSize, readChunkSize: readChunkSize }).then(function (result) {
                    pieces.set(result, currentChunkIndex * blocksPerChunk * 20);
                    --currentWorkerCount;
                    bytesProcessedSoFar += byteCount;
                    let percent = bytesProcessedSoFar / fileSize * 100;
                    jq('.progress > div').css('width', percent + "%")  // 整体进度
                    jq('[name="progress-name"]').text(file.name);
                    jq('[name="progress-percent"]').text(bytesProcessedSoFar + ' / ' + fileSize);
                    jq('[name="progress-total"]').text(percent.toFixed(2) + '%');
                    if (chunkIndex === maxChunkCount && currentWorkerCount === 0) {
                        // everything finished
                        infoObject["pieces"] = Array.from(pieces);
                        Finished();
                    }
                    else if (waitingForWorkers) {
                        waitingForWorkers = false;
                        reader();
                    }
                });
                if (chunkIndex !== maxChunkCount)
                    reader();
                else {
                    console.log('Done.');
                    jq('[name="progress-name"]').text('Done.');
                }
                return [2 /*return*/];
            });
        });
    };
    fr.onerror = function () {
        Failed(singleFile && singleFile.name, fr.error);
    };
    reader();
}

function CreateFromFolder(obj) {
    return new Promise((resolve, reject) => {
        if (!allFiles || !obj.info) return;
        let infoObject = obj.info;
        let chunkSize = infoObject["piece length"];
        let bytesReadSoFar = 0;
        let bytesProcessedSoFar = 0;
        let readChunkSize = 16777216;
        let currentChunk = new Uint8Array(readChunkSize);
        let currentChunkDataIndex = 0;
        let chunkIndex = 0;
        let blocksPerChunk = readChunkSize / blockSize;
        let totalSize = 0;
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
        let totalBlockCount = Math.ceil(totalSize / chunkSize);
        let pieces = new Uint8Array(totalBlockCount * 20);
        let processedBlockCount = 0;
        infoObject["files"] = fileInfos;
        let fileIndex = 0;
        let files = allFiles;
        let currentFile = files[0];
        let readStartIndex = 0;
        let fileSize = currentFile.size;
        let fr = new FileReader();
        let currentWorkerCount = 0;
        function reader() {
            if (!creationInProgress)
                return;
            if (currentWorkerCount === maxWorkerCount) {
                waitingForWorkers = true;
                return;
            };
            fr.readAsArrayBuffer(currentFile.slice(readStartIndex, readStartIndex + readChunkSize));
            readStartIndex += readChunkSize;
        };
        function MaybeFinished() {
            if (processedBlockCount >= totalBlockCount) {
                infoObject["pieces"] = Array.from(pieces);
                jq('[name="progress-percent"]').text(totalSize + ' / ' + totalSize);
                Finished();
                resolve(1);
            };
        };
        let waitingForWorkers = false;
        fr.onloadend = function (ev) {
            return __awaiter(this, void 0, void 0, function () {
                let bytes, byteCount, byteIndex, localChunk, currentChunkIndex_1;
                return __generator(this, function (_a) {
                    if (!ev.target || !(ev.target.result instanceof ArrayBuffer))
                        return [2 /*return*/];
                    bytes = new Uint8Array(ev.target.result);
                    byteCount = bytes.length;
                    bytesReadSoFar += byteCount;
                    if (currentChunkDataIndex + bytes.length >= readChunkSize) {
                        byteIndex = readChunkSize - currentChunkDataIndex;
                        currentChunk.set(bytes.subarray(0, byteIndex), currentChunkDataIndex);
                        localChunk = currentChunk;
                        currentChunk = new Uint8Array(readChunkSize);
                        currentChunkIndex_1 = chunkIndex++;
                        ++currentWorkerCount;
                        sha1({ data: localChunk, blockSize: chunkSize, readChunkSize: readChunkSize }).then(function (result) {
                            processedBlockCount += blocksPerChunk;
                            pieces.set(result, currentChunkIndex_1 * blocksPerChunk * 20);
                            --currentWorkerCount;
                            if (waitingForWorkers) {
                                waitingForWorkers = false;
                                reader();
                            }
                            if (!creationFinished) {
                                bytesProcessedSoFar += readChunkSize;
                                let percent = bytesProcessedSoFar / totalSize * 100;
                                jq('.progress > div').css('width', percent + "%")  // 整体进度
                                jq('[name="progress-percent"]').text(bytesProcessedSoFar + ' / ' + totalSize);
                                jq('[name="progress-total"]').text(percent.toFixed(2) + '%');
                            }
                            MaybeFinished();
                        });
                        // set the remaining data
                        currentChunk.set(bytes.subarray(byteIndex), 0);
                        currentChunkDataIndex = bytes.length - byteIndex;
                    } else {
                        // just add to the buffer
                        currentChunk.set(bytes, currentChunkDataIndex);
                        currentChunkDataIndex += bytes.length;
                    };
                    if (readStartIndex < fileSize) {
                        // current file is not finished yet
                        reader();
                    } else {
                        // current file is finished, check if we have any more files left
                        ++fileIndex;
                        if (fileIndex === files.length) {
                            // all files are processed, calculate the hash of the current buffer data
                            if (currentChunkDataIndex !== 0) {
                                sha1({ data: currentChunk, blockSize: chunkSize, readChunkSize: currentChunkDataIndex }).then(function (result) {
                                    processedBlockCount += blocksPerChunk;
                                    pieces.set(result, chunkIndex * blocksPerChunk * 20);
                                    MaybeFinished();
                                });
                            }
                            else {
                                MaybeFinished();
                            };
                            // console.log("All files read");
                        } else {
                            // some files are still left
                            currentFile = files[fileIndex];
                            fileSize = currentFile.size;
                            readStartIndex = 0;
                            jq('[name="progress-name"]').text(currentFile.name);
                            // jq('[name="progress-total"]').text((fileIndex + 1) + ' / ' + allFiles.length);
                            reader();
                        };
                    };
                    return [2 /*return*/];
                });
            });
        };
        fr.onerror = function () {
            Failed(currentFile.name, fr.error);
        };
        jq('[name="progress-name"]').text(currentFile.name);
        jq('[name="progress-percent"]').text('132644 / ' + totalSize);
        jq('[name="progress-total"]').text('0%');
        reader();
    });
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
                        console.error('Network response was not OK');
                        reject('Network response was not OK');
                    };
                    return response.text();
                }).then(t => {
                    window.URL = window.URL || window.webkitURL;
                    const blob = new Blob([t], { type: 'application/javascript' });
                    resolve(URL.createObjectURL(blob));
                })
                .catch(error => {
                    console.error('There has been a problem with your fetch operation:', error);
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
        console.log('fall back to single threaded version');
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
