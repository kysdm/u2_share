// ==UserScript==
// @name         U2实时预览BBCODE
// @namespace    https://u2.dmhy.org/
// @version      1.2.19
// @description  实时预览BBCODE
// @author       kysdm
// @grant        GM_xmlhttpRequest
// @match        *://u2.dmhy.org/*
// @exclude      *://u2.dmhy.org/shoutbox.php*
// @icon         https://u2.dmhy.org/favicon.ico
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js
// @downloadURL  https://github.com/kysdm/u2_share/raw/main/u2share_bbcode.user.js
// @updateURL    https://github.com/kysdm/u2_share/raw/main/u2share_bbcode.user.js
// @license      Apache-2.0
// ==/UserScript==

/*
本脚本基于 Bamboo Green 界面风格进行修改
为什么会有近似功能的函数呢，问就是历史原因
等不能跑的时候再动祖传代码
/*

/*
GreasyFork 地址
    https://greasyfork.org/zh-CN/scripts/426268
*/

/*
更新日志
    https://github.com/kysdm/u2_share/commits/main/u2share_bbcode.user.js
*/


'use strict';

/* ============ TorrentCreatorLib（WASM 加速版，内联）============ */
/*
 * TorrentCreatorLib — 浏览器端创建 .torrent 的独立库（油猴脚本可用）
 *
 * 移植自 Kimbatt/torrent-creator（Svelte 项目）的 WASM 加速版。
 *   - 内联原项目编译好的 Sha1.wasm / Sha1Simd.wasm（base64），优先 SIMD，自动降级纯 JS
 *   - Worker 源码内联（含 wasm），Blob URL 创建，CSP 受限自动降级主线程
 *   - 输入从 DOM FileList 改为任意 File[] / {path, file}[]
 *
 * 实测（Node 22/V8，16MiB 分块）：纯 JS 110 MB/s | WASM 663 MB/s | WASM+SIMD 740 MB/s
 *
 * 用法：
 *   <script src="torrent-creator-lib.js"></script>  或油猴 @require
 *   const result = await TorrentCreatorLib.createTorrent({ files, name: "my-torrent" });
 *   TorrentCreatorLib.download(result.bytes, result.name + ".torrent");
 */
(function (global) {
    "use strict";

    const KB = 1024;
    const MB = 1024 * 1024;

    // ============================================================
    // SHA-1（纯 JS，标准实现，逐块处理任意大小输入）
    // 注意：此函数会被 toString() 提取为 worker 源码，不得引用外部变量
    // ============================================================
    function sha1Bytes(data) {
        const byteLength = data.byteLength;
        const paddedLength = (((byteLength + 8) >> 6) + 1) << 6; // 至少 64 字节
        const padded = new Uint8Array(paddedLength);
        padded.set(data);
        padded[byteLength] = 0x80; // 追加 0x80

        const view = new DataView(padded.buffer);
        // 64 位大端长度（bit 数）。JS number 精确到 2^53，文件 < 2^50 字节安全
        const bitLength = byteLength * 8;
        view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
        view.setUint32(paddedLength - 4, bitLength >>> 0);

        let h0 = 0x67452301;
        let h1 = 0xEFCDAB89;
        let h2 = 0x98BADCFE;
        let h3 = 0x10325476;
        let h4 = 0xC3D2E1F0;

        const w = new Int32Array(80);
        for (let offset = 0; offset < paddedLength; offset += 64) {
            for (let j = 0; j < 16; ++j) {
                w[j] = view.getUint32(offset + j * 4);
            }
            for (let j = 16; j < 80; ++j) {
                const n = w[j - 3] ^ w[j - 8] ^ w[j - 14] ^ w[j - 16];
                w[j] = (n << 1) | (n >>> 31);
            }

            let a = h0, b = h1, c = h2, d = h3, e = h4;
            for (let j = 0; j < 80; ++j) {
                let f, k;
                if (j < 20) { f = (b & c) | (~b & d); k = 0x5A827999; }
                else if (j < 40) { f = b ^ c ^ d; k = 0x6ED9EBA1; }
                else if (j < 60) { f = (b & c) | (b & d) | (c & d); k = 0x8F1BBCDC; }
                else { f = b ^ c ^ d; k = 0xCA62C1D6; }
                const temp = (((a << 5) | (a >>> 27)) + f + e + k + w[j]) | 0;
                e = d; d = c; c = (b << 30) | (b >>> 2); b = a; a = temp;
            }

            h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0; h4 = (h4 + e) | 0;
        }

        const out = new Uint8Array(20);
        const ov = new DataView(out.buffer);
        ov.setUint32(0, h0 >>> 0);
        ov.setUint32(4, h1 >>> 0);
        ov.setUint32(8, h2 >>> 0);
        ov.setUint32(12, h3 >>> 0);
        ov.setUint32(16, h4 >>> 0);
        return out;
    }


    // ============================================================
    // WASM SHA-1 后端（内联原项目编译产物，base64）
    // 优先级：SIMD wasm → 普通 wasm → 纯 JS
    // ============================================================
    const SHA1_WASM_B64 = "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BXdqQaSGkYcHayIEQQV3akGkhpGHB2siBiAEQR53IgIgB0EedyIDcnEgAiADcXJqIAUgOWogBCABIANycSABIANxcmogBkEFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIHQR53IgFqIDUgBkEedyIFaiADID9qIAQgAiAFcnEgAiAFcXJqIAdBBXdqQaSGkYcHayIGIAEgBEEedyIDcnEgASADcXJqIAIgOmogByADIAVycSADIAVxcmogBkEFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIHIARBHnciAiAGQR53IgVycSACIAVxcmogAyBAaiAEIAEgBXJxIAEgBXFyaiAHQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgZBHnciAWogPCAHQR53IgNqIAUgNmogBCACIANycSACIANxcmogBkEFd2pBpIaRhwdrIgcgASAEQR53IgVycSABIAVxcmogAiBBaiAGIAMgBXJxIAMgBXFyaiAHQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgYgBEEedyIDIAdBHnciAnJxIAIgA3FyaiAFIERqIAQgASACcnEgASACcXJqIAZBBXdqQaSGkYcHayIBQQV3akGkhpGHB2siBUEedyIEaiADIEVqIAFBHnciByAGQR53IgZzIAVzaiACID1qIAMgBnMgAXNqIAVBBXdqQar89KwDayIBQQV3akGq/PSsA2siAkEedyIDIAFBHnciBXMgBiBDaiAEIAdzIAFzaiACQQV3akGq/PSsA2siAXNqIAcgPmogBCAFcyACc2ogAUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIEQR53IgZqIAMgTmogAkEedyIHIAFBHnciAXMgBHNqIAUgR2ogASADcyACc2ogBEEFd2pBqvz0rANrIgJBBXdqQar89KwDayIDQR53IgUgAkEedyIEcyABIExqIAYgB3MgAnNqIANBBXdqQar89KwDayIBc2ogByBKaiAEIAZzIANzaiABQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciBmogBSBLaiACQR53IgcgAUEedyIBcyADc2ogBCBNaiABIAVzIAJzaiADQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciBSACQR53IgRzIEEgRHMgSHMgT3NBAXciCyABaiAGIAdzIAJzaiADQQV3akGq/PSsA2siAXNqIAcgUWogBCAGcyADc2ogAUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIDQR53IgZqIAUgUmogAkEedyIHIAFBHnciAXMgA3NqIAQgQiBFcyBMcyALc0EBdyIEaiABIAVzIAJzaiADQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciCyACQR53IgVzID4gRXMgT3MgU3NBAXcgAWogBiAHcyACc2ogA0EFd2pBqvz0rANrIgFzaiBDIEhzIE1zIARzQQF3IAdqIAUgBnMgA3NqIAFBBXdqQar89KwDayIDQQV3akGq/PSsA2shAiADIBJqIRIgAUEedyAMaiEMIAUgF2ohFyALIA9qIQ8gAEFAayIAIFBJDQALC0HTiIAIIBc6AABBz4iACCAPOgAAQcuIgAggDDoAAEHHiIAIIBI6AABBw4iACCACOgAAQdKIgAggF0EIdjoAAEHRiIAIIBdBEHY6AABB0IiACCAXQRh2OgAAQc6IgAggD0EIdjoAAEHNiIAIIA9BEHY6AABBzIiACCAPQRh2OgAAQcqIgAggDEEIdjoAAEHJiIAIIAxBEHY6AABByIiACCAMQRh2OgAAQcaIgAggEkEIdjoAAEHFiIAIIBJBEHY6AABBxIiACCASQRh2OgAAQcKIgAggAkEIdjoAAEHBiIAIIAJBEHY6AABBwIiACCACQRh2OgAAQcCIgAgLBQBBgAgLAgAL";
    const SHA1_SIMD_WASM_B64 = "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cSACIAVxcmogB0EFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIGQR53IgJqIC4gB0EedyIDaiAFIDhqIAQgASADcnEgASADcXJqIAZBBXdqQaSGkYcHayIHIAIgBEEedyIFcnEgAiAFcXJqIAEgM2ogBiADIAVycSADIAVxcmogB0EFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIGIARBHnciASAHQR53IgNycSABIANxcmogBSA5aiAEIAIgA3JxIAIgA3FyaiAGQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgdBHnciAmogNSAGQR53IgVqIAMgP2ogBCABIAVycSABIAVxcmogB0EFd2pBpIaRhwdrIgYgAiAEQR53IgNycSACIANxcmogASA6aiAHIAMgBXJxIAMgBXFyaiAGQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgcgBEEedyIBIAZBHnciBXJxIAEgBXFyaiADIEBqIAQgAiAFcnEgAiAFcXJqIAdBBXdqQaSGkYcHayIEQQV3akGkhpGHB2siBkEedyICaiA8IAdBHnciA2ogBSA2aiAEIAEgA3JxIAEgA3FyaiAGQQV3akGkhpGHB2siByACIARBHnciBXJxIAIgBXFyaiABIEFqIAYgAyAFcnEgAyAFcXJqIAdBBXdqQaSGkYcHayIEQQV3akGkhpGHB2siBiAEQR53IgMgB0EedyIBcnEgASADcXJqIAUgRGogBCABIAJycSABIAJxcmogBkEFd2pBpIaRhwdrIgJBBXdqQaSGkYcHayIFQR53IgRqIAMgRWogAkEedyIHIAZBHnciBnMgBXNqIAEgPWogAyAGcyACc2ogBUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIBQR53IgMgAkEedyIFcyAGIENqIAQgB3MgAnNqIAFBBXdqQar89KwDayICc2ogByA+aiAEIAVzIAFzaiACQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgRBHnciBmogAyBOaiABQR53IgcgAkEedyICcyAEc2ogBSBHaiACIANzIAFzaiAEQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgNBHnciBSABQR53IgRzIAIgTGogBiAHcyABc2ogA0EFd2pBqvz0rANrIgJzaiAHIEpqIAQgBnMgA3NqIAJBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyIGaiAFIEtqIAFBHnciByACQR53IgJzIANzaiAEIE1qIAIgBXMgAXNqIANBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyIFIAFBHnciBHMgQSBEcyBIcyBPc0EBdyINIAJqIAYgB3MgAXNqIANBBXdqQar89KwDayICc2ogByBRaiAEIAZzIANzaiACQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgNBHnciBmogBSBSaiABQR53IgcgAkEedyICcyADc2ogBCBCIEVzIExzIA1zQQF3IgRqIAIgBXMgAXNqIANBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyINIAFBHnciBXMgPiBFcyBPcyBTc0EBdyACaiAGIAdzIAFzaiADQQV3akGq/PSsA2siAnNqIEMgSHMgTXMgBHNBAXcgB2ogBSAGcyADc2ogAkEFd2pBqvz0rANrIgNBBXdqQar89KwDayEBIAMgDmohDiACQR53IABqIQAgBSAXaiEXIAwgDWohDCAIQUBrIgggUEkNAAsLQdOIgAggFzoAAEHPiIAIIAw6AABBy4iACCAAOgAAQceIgAggDjoAAEHDiIAIIAE6AABB0oiACCAXQQh2OgAAQdGIgAggF0EQdjoAAEHQiIAIIBdBGHY6AABBzoiACCAMQQh2OgAAQc2IgAggDEEQdjoAAEHMiIAIIAxBGHY6AABByoiACCAAQQh2OgAAQcmIgAggAEEQdjoAAEHIiIAIIABBGHY6AABBxoiACCAOQQh2OgAAQcWIgAggDkEQdjoAAEHEiIAIIA5BGHY6AABBwoiACCABQQh2OgAAQcGIgAggAUEQdjoAAEHAiIAIIAFBGHY6AABBwIiACAsFAEGACAsCAAs=";

    function base64ToBytes(b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; ++i) bytes[i] = bin.charCodeAt(i);
        return bytes;
    }

    // 实例化一个 wasm 模块；失败返回 null（调用方回退）
    async function createWasmSha1(b64) {
        try {
            const bytes = base64ToBytes(b64);
            const { instance } = await WebAssembly.instantiate(bytes);
            const ex = instance.exports;
            ex._initialize();
            const bufPtr = ex.getMemoryBuffer();
            const memory = ex.memory;
            const sha1Fn = ex.sha1;
            return (data) => {
                // 每次取最新 buffer（防御 memory.grow）
                const heap = new Uint8Array(memory.buffer);
                heap.set(data, bufPtr);
                const rp = sha1Fn(data.length);
                return heap.slice(rp, rp + 20);
            };
        }
        catch {
            return null;
        }
    }

    let wasmSha1Promise = null;
    function getWasmSha1() {
        if (wasmSha1Promise === null) {
            wasmSha1Promise = (async () => {
                const simd = await createWasmSha1(SHA1_SIMD_WASM_B64);
                if (simd !== null) return simd;
                return createWasmSha1(SHA1_WASM_B64); // 可能为 null → 调用方回退纯 JS
            })();
        }
        return wasmSha1Promise;
    }

    function sha1Hex(bytes) {
        let hex = "";
        const h = sha1Bytes(bytes);
        for (let i = 0; i < h.length; ++i) {
            hex += h[i].toString(16).padStart(2, "0");
        }
        return hex;
    }

    // ============================================================
    // Bencode 编码（字典键排序、UTF-8 字节长度前缀）
    // ============================================================
    function utf8Encode(str) {
        return new TextEncoder().encode(str);
    }

    function bencodeEncode(value) {
        const enc = new TextEncoder();
        const parts = [];

        function pushBytes(bytes) {
            parts.push(bytes);
        }

        function pushText(text) {
            parts.push(enc.encode(text));
        }

        function encodeString(str) {
            const bytes = utf8Encode(str);
            pushText(bytes.length + ":");
            pushBytes(bytes);
        }

        function encode(v) {
            if (typeof v === "number") {
                pushText("i" + Math.trunc(v) + "e");
            }
            else if (typeof v === "string") {
                encodeString(v);
            }
            else if (v instanceof Uint8Array) {
                pushText(v.length + ":");
                pushBytes(v);
            }
            else if (Array.isArray(v)) {
                pushText("l");
                for (const item of v) encode(item);
                pushText("e");
            }
            else if (v !== null && typeof v === "object") {
                pushText("d");
                const keys = Object.keys(v).sort();
                for (const key of keys) {
                    const val = v[key];
                    if (val === undefined) continue;
                    encodeString(key);
                    encode(val);
                }
                pushText("e");
            }
            else {
                throw new Error("Unsupported bencode value: " + typeof v);
            }
        }

        encode(value);

        let total = 0;
        for (const part of parts) total += part.length;
        const result = new Uint8Array(total);
        let offset = 0;
        for (const part of parts) {
            result.set(part, offset);
            offset += part.length;
        }
        return result;
    }

    // ============================================================
    // 工具
    // ============================================================
    function getLines(str) {
        return String(str).split(/\s+/g).filter((line) => line.length !== 0);
    }

    function formatSize(size) {
        if (size < KB) return size + " bytes";
        if (size < MB) return ((size / KB) | 0) + " kB";
        return ((size / MB) | 0) + " MB";
    }

    // 自动 piece size：目标 ~1200 片，clamp 到 16KiB .. 16MiB（2 的幂）
    function autoPieceSize(totalSize) {
        const targetBlockCount = 1200;
        let factor = Math.round(Math.log2(totalSize / targetBlockCount));
        factor = Math.max(factor, 14); // 2^14 = 16 KiB
        factor = Math.min(factor, 24); // 2^24 = 16 MiB
        return 1 << factor;
    }

    function abortError() {
        return new DOMException("Aborted", "AbortError");
    }

    function validateTorrentInput(params, blockSize, totalSize) {
        if (params.name.length === 0) return "Torrent name cannot be empty";
        if (params.name.length > 255) return "Torrent name cannot be longer than 255 characters";
        if (params.name.match(/[<>:"\\/|?*]/)) {
            return "Torrent name cannot contain any of the following characters: < > : \\ / | ? *";
        }
        if (totalSize <= 0) return "Total size of selected files is 0";
        if (blockSize <= 0 || (blockSize & (blockSize - 1)) !== 0) {
            return "Piece size must be a power of two";
        }
        for (const tracker of getLines(params.trackers)) {
            try { new URL(tracker); }
            catch { return "Invalid tracker: `" + tracker + "` (not a valid URL)"; }
        }
        for (const webSeed of getLines(params.webSeeds)) {
            try { new URL(webSeed); }
            catch { return "Invalid web seed: `" + webSeed + "` (not a valid URL)"; }
        }
        return null;
    }

    // ============================================================
    // 输入归一化：File[] / {path, file}[] → 统一文件清单
    // 复刻原项目 FileInput.ts 语义
    // ============================================================
    function normalizeInput(files) {
        if (!Array.isArray(files) || files.length === 0) {
            throw new Error("No files provided");
        }

        let fileList;   // [{path: string[], file: File}]
        let name;       // 默认 torrent 名
        let isSingle;   // 单文件 torrent（info.length）

        const first = files[0];
        const hasPathInfo = (first !== null) && (typeof first === "object") && (first.file instanceof File);

        if (hasPathInfo) {
            fileList = files.map((entry) => ({ path: entry.path.slice(), file: entry.file }));
            name = null; // 调用方显式传 name；否则取第一个文件名
            isSingle = fileList.length === 1;
            if (isSingle) name = fileList[0].path[fileList[0].path.length - 1];
        }
        else {
            const hasRelPath = files.some((f) => typeof f.webkitRelativePath === "string" && f.webkitRelativePath !== "");

            if (hasRelPath) {
                // 文件夹选择（webkitdirectory）：根段 = torrent 名
                const rootSeg = files[0].webkitRelativePath.split("/")[0];
                fileList = files.map((f) => {
                    const segments = f.webkitRelativePath.split("/").slice(1); // 去掉根段
                    return { path: [...segments, f.name], file: f };
                });
                name = rootSeg;
                isSingle = false;
            }
            else if (files.length === 1) {
                // 单选一个文件
                const f = files[0];
                fileList = [{ path: [f.name], file: f }];
                name = f.name;
                isSingle = true;
            }
            else {
                // 平铺多文件：路径 = 各自文件名
                fileList = files.map((f) => ({ path: [f.name], file: f }));
                name = null;
                isSingle = false;
            }
        }

        let totalSize = 0;
        for (const { file } of fileList) totalSize += file.size;

        return { name, fileList, totalSize, isSingle };
    }

    // ============================================================
    // Worker（可选）：SHA-1 源码提取 + Blob URL 内联创建，自动降级
    // ============================================================
    const WORKER_SOURCE = [
        "\"use strict\";",
        "const SHA1_WASM_B64 = \"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BXdqQaSGkYcHayIEQQV3akGkhpGHB2siBiAEQR53IgIgB0EedyIDcnEgAiADcXJqIAUgOWogBCABIANycSABIANxcmogBkEFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIHQR53IgFqIDUgBkEedyIFaiADID9qIAQgAiAFcnEgAiAFcXJqIAdBBXdqQaSGkYcHayIGIAEgBEEedyIDcnEgASADcXJqIAIgOmogByADIAVycSADIAVxcmogBkEFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIHIARBHnciAiAGQR53IgVycSACIAVxcmogAyBAaiAEIAEgBXJxIAEgBXFyaiAHQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgZBHnciAWogPCAHQR53IgNqIAUgNmogBCACIANycSACIANxcmogBkEFd2pBpIaRhwdrIgcgASAEQR53IgVycSABIAVxcmogAiBBaiAGIAMgBXJxIAMgBXFyaiAHQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgYgBEEedyIDIAdBHnciAnJxIAIgA3FyaiAFIERqIAQgASACcnEgASACcXJqIAZBBXdqQaSGkYcHayIBQQV3akGkhpGHB2siBUEedyIEaiADIEVqIAFBHnciByAGQR53IgZzIAVzaiACID1qIAMgBnMgAXNqIAVBBXdqQar89KwDayIBQQV3akGq/PSsA2siAkEedyIDIAFBHnciBXMgBiBDaiAEIAdzIAFzaiACQQV3akGq/PSsA2siAXNqIAcgPmogBCAFcyACc2ogAUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIEQR53IgZqIAMgTmogAkEedyIHIAFBHnciAXMgBHNqIAUgR2ogASADcyACc2ogBEEFd2pBqvz0rANrIgJBBXdqQar89KwDayIDQR53IgUgAkEedyIEcyABIExqIAYgB3MgAnNqIANBBXdqQar89KwDayIBc2ogByBKaiAEIAZzIANzaiABQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciBmogBSBLaiACQR53IgcgAUEedyIBcyADc2ogBCBNaiABIAVzIAJzaiADQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciBSACQR53IgRzIEEgRHMgSHMgT3NBAXciCyABaiAGIAdzIAJzaiADQQV3akGq/PSsA2siAXNqIAcgUWogBCAGcyADc2ogAUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIDQR53IgZqIAUgUmogAkEedyIHIAFBHnciAXMgA3NqIAQgQiBFcyBMcyALc0EBdyIEaiABIAVzIAJzaiADQQV3akGq/PSsA2siAkEFd2pBqvz0rANrIgNBHnciCyACQR53IgVzID4gRXMgT3MgU3NBAXcgAWogBiAHcyACc2ogA0EFd2pBqvz0rANrIgFzaiBDIEhzIE1zIARzQQF3IAdqIAUgBnMgA3NqIAFBBXdqQar89KwDayIDQQV3akGq/PSsA2shAiADIBJqIRIgAUEedyAMaiEMIAUgF2ohFyALIA9qIQ8gAEFAayIAIFBJDQALC0HTiIAIIBc6AABBz4iACCAPOgAAQcuIgAggDDoAAEHHiIAIIBI6AABBw4iACCACOgAAQdKIgAggF0EIdjoAAEHRiIAIIBdBEHY6AABB0IiACCAXQRh2OgAAQc6IgAggD0EIdjoAAEHNiIAIIA9BEHY6AABBzIiACCAPQRh2OgAAQcqIgAggDEEIdjoAAEHJiIAIIAxBEHY6AABByIiACCAMQRh2OgAAQcaIgAggEkEIdjoAAEHFiIAIIBJBEHY6AABBxIiACCASQRh2OgAAQcKIgAggAkEIdjoAAEHBiIAIIAJBEHY6AABBwIiACCACQRh2OgAAQcCIgAgLBQBBgAgLAgAL\";",
        "const SHA1_SIMD_WASM_B64 = \"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cSACIAVxcmogB0EFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIGQR53IgJqIC4gB0EedyIDaiAFIDhqIAQgASADcnEgASADcXJqIAZBBXdqQaSGkYcHayIHIAIgBEEedyIFcnEgAiAFcXJqIAEgM2ogBiADIAVycSADIAVxcmogB0EFd2pBpIaRhwdrIgRBBXdqQaSGkYcHayIGIARBHnciASAHQR53IgNycSABIANxcmogBSA5aiAEIAIgA3JxIAIgA3FyaiAGQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgdBHnciAmogNSAGQR53IgVqIAMgP2ogBCABIAVycSABIAVxcmogB0EFd2pBpIaRhwdrIgYgAiAEQR53IgNycSACIANxcmogASA6aiAHIAMgBXJxIAMgBXFyaiAGQQV3akGkhpGHB2siBEEFd2pBpIaRhwdrIgcgBEEedyIBIAZBHnciBXJxIAEgBXFyaiADIEBqIAQgAiAFcnEgAiAFcXJqIAdBBXdqQaSGkYcHayIEQQV3akGkhpGHB2siBkEedyICaiA8IAdBHnciA2ogBSA2aiAEIAEgA3JxIAEgA3FyaiAGQQV3akGkhpGHB2siByACIARBHnciBXJxIAIgBXFyaiABIEFqIAYgAyAFcnEgAyAFcXJqIAdBBXdqQaSGkYcHayIEQQV3akGkhpGHB2siBiAEQR53IgMgB0EedyIBcnEgASADcXJqIAUgRGogBCABIAJycSABIAJxcmogBkEFd2pBpIaRhwdrIgJBBXdqQaSGkYcHayIFQR53IgRqIAMgRWogAkEedyIHIAZBHnciBnMgBXNqIAEgPWogAyAGcyACc2ogBUEFd2pBqvz0rANrIgJBBXdqQar89KwDayIBQR53IgMgAkEedyIFcyAGIENqIAQgB3MgAnNqIAFBBXdqQar89KwDayICc2ogByA+aiAEIAVzIAFzaiACQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgRBHnciBmogAyBOaiABQR53IgcgAkEedyICcyAEc2ogBSBHaiACIANzIAFzaiAEQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgNBHnciBSABQR53IgRzIAIgTGogBiAHcyABc2ogA0EFd2pBqvz0rANrIgJzaiAHIEpqIAQgBnMgA3NqIAJBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyIGaiAFIEtqIAFBHnciByACQR53IgJzIANzaiAEIE1qIAIgBXMgAXNqIANBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyIFIAFBHnciBHMgQSBEcyBIcyBPc0EBdyINIAJqIAYgB3MgAXNqIANBBXdqQar89KwDayICc2ogByBRaiAEIAZzIANzaiACQQV3akGq/PSsA2siAUEFd2pBqvz0rANrIgNBHnciBmogBSBSaiABQR53IgcgAkEedyICcyADc2ogBCBCIEVzIExzIA1zQQF3IgRqIAIgBXMgAXNqIANBBXdqQar89KwDayIBQQV3akGq/PSsA2siA0EedyINIAFBHnciBXMgPiBFcyBPcyBTc0EBdyACaiAGIAdzIAFzaiADQQV3akGq/PSsA2siAnNqIEMgSHMgTXMgBHNBAXcgB2ogBSAGcyADc2ogAkEFd2pBqvz0rANrIgNBBXdqQar89KwDayEBIAMgDmohDiACQR53IABqIQAgBSAXaiEXIAwgDWohDCAIQUBrIgggUEkNAAsLQdOIgAggFzoAAEHPiIAIIAw6AABBy4iACCAAOgAAQceIgAggDjoAAEHDiIAIIAE6AABB0oiACCAXQQh2OgAAQdGIgAggF0EQdjoAAEHQiIAIIBdBGHY6AABBzoiACCAMQQh2OgAAQc2IgAggDEEQdjoAAEHMiIAIIAxBGHY6AABByoiACCAAQQh2OgAAQcmIgAggAEEQdjoAAEHIiIAIIABBGHY6AABBxoiACCAOQQh2OgAAQcWIgAggDkEQdjoAAEHEiIAIIA5BGHY6AABBwoiACCABQQh2OgAAQcGIgAggAUEQdjoAAEHAiIAIIAFBGHY6AABBwIiACAsFAEGACAsCAAs=\";",
        "function base64ToBytes(b64) { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; ++i) bytes[i] = bin.charCodeAt(i); return bytes; }",
        "async function createWasmSha1(b64) { try { const bytes = base64ToBytes(b64); const { instance } = await WebAssembly.instantiate(bytes); const ex = instance.exports; ex._initialize(); const bufPtr = ex.getMemoryBuffer(); const memory = ex.memory; const sha1Fn = ex.sha1; return (data) => { const heap = new Uint8Array(memory.buffer); heap.set(data, bufPtr); const rp = sha1Fn(data.length); return heap.slice(rp, rp + 20); }; } catch { return null; } }",
        "let wasmSha1Promise = null;",
        "function getWasmSha1() { if (wasmSha1Promise === null) { wasmSha1Promise = (async () => { const s = await createWasmSha1(SHA1_SIMD_WASM_B64); if (s !== null) return s; return createWasmSha1(SHA1_WASM_B64); })(); } return wasmSha1Promise; }",
        "self.onmessage = async function (e) {",
        "    var msg = e.data;",
        "    var impl = await getWasmSha1();",
        "    var results = new Uint8Array(msg.chunks.length * 20);",
        "    for (var i = 0; i < msg.chunks.length; ++i) {",
        "        var h = impl !== null ? impl(msg.chunks[i]) : sha1Bytes(msg.chunks[i]);",
        "        results.set(h, i * 20);",
        "    }",
        "    self.postMessage({ id: msg.id, results: results });",
        "};"
    ].join("\n");

    function createWorkerPool(maxCount) {
        const workers = [];
        const idle = [];
        let nextId = 1;

        let blobUrl = null;
        try {
            if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
                blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
                for (let i = 0; i < maxCount; ++i) {
                    const worker = new Worker(blobUrl, { name: "sha1-worker-" + i });
                    workers.push(worker);
                    idle.push(worker);
                }
            }
        }
        catch {
            // CSP 或环境限制 → 主线程模式
        }

        if (workers.length === 0) {
            return null; // 调用方走主线程 fallback
        }

        function pickWorker() {
            if (idle.length > 0) return idle.pop();
            return workers[Math.floor(Math.random() * workers.length)];
        }

        function hashChunks(chunks) {
            const worker = pickWorker();
            const id = nextId++;
            return new Promise((resolve, reject) => {
                const onMessage = (e) => {
                    if (e.data.id !== id) return;
                    worker.removeEventListener("message", onMessage);
                    idle.push(worker);
                    resolve(e.data.results);
                };
                const onError = () => {
                    worker.removeEventListener("message", onMessage);
                    worker.removeEventListener("error", onError);
                    idle.push(worker);
                    reject(new Error("Worker failed"));
                };
                worker.addEventListener("message", onMessage);
                worker.addEventListener("error", onError);
                try {
                    worker.postMessage({ id, chunks }, chunks.map((c) => c.buffer));
                }
                catch {
                    // 浏览器不支持 transfer → 普通 postMessage 重试一次
                    worker.removeEventListener("message", onMessage);
                    worker.removeEventListener("error", onError);
                    worker.postMessage({ id, chunks });
                    worker.addEventListener("message", onMessage);
                    worker.addEventListener("error", onError);
                }
            });
        }

        return {
            hashChunks,
            terminate() {
                for (const worker of workers) worker.terminate();
                if (blobUrl !== null) URL.revokeObjectURL(blobUrl);
            },
        };
    }

    // ============================================================
    // 哈希管线：16MiB 读缓冲 → 切 piece → worker/主线程并行计算
    // 复刻原项目 TorrentObject.calculateHashes 的流水线设计
    // ============================================================
    async function computePieces(fileList, blockSize, options) {
        const onProgress = options.onProgress || (() => {});
        const signal = options.signal || null;
        const workerPool = options.workerPool; // 可能为 null（主线程模式）
        const wasmImpl = options.wasmImpl !== undefined
            ? options.wasmImpl
            : ((await getWasmSha1()) || null); // wasm 不可用时为 null → 纯 JS

        let totalSize = 0;
        for (const { file } of fileList) totalSize += file.size;

        const totalBlockCount = Math.ceil(totalSize / blockSize);
        const pieces = new Uint8Array(totalBlockCount * 20); // 每片 20 字节 SHA-1
        let pieceIndex = 0;
        let bytesRead = 0;
        let bytesHashed = 0;

        const reportProgress = () => {
            const progress = (bytesRead + bytesHashed) / (2 * totalSize);
            onProgress({ bytesRead, bytesHashed, totalSize, progress });
        };

        const pending = []; // Promise<void>[]

        function dispatch(inputBytes) {
            const inputLength = inputBytes.length;
            const numPieces = Math.ceil(inputLength / blockSize);
            const startPieceIndex = pieceIndex;
            pieceIndex += numPieces;

            // 每个 piece 复制成独立 buffer（worker 模式需要 transfer，主线程模式需要独立哈希）
            const chunks = [];
            for (let i = 0; i < numPieces; ++i) {
                const startByteIndex = i * blockSize;
                const endByteIndex = Math.min((i + 1) * blockSize, inputLength);
                chunks.push(inputBytes.slice(startByteIndex, endByteIndex));
            }

            const finish = (results) => {
                pieces.set(results, startPieceIndex * 20);
                bytesHashed += inputLength;
                reportProgress();
            };

            if (workerPool !== null) {
                pending.push(
                    workerPool.hashChunks(chunks)
                        .then(finish)
                        .catch((err) => { throw err; })
                );
            }
            else {
                // 主线程模式：分块计算，块间让出事件循环，避免长时间冻结 UI
                pending.push((async () => {
                    const results = new Uint8Array(numPieces * 20);
                    for (let i = 0; i < numPieces; ++i) {
                        if (signal !== null && signal.aborted) throw abortError();
                        // WASM 静态缓冲区上限 16MiB+64（原项目编译产物），超出自动改用纯 JS 计算
                        const useWasm = (wasmImpl !== null) && (chunks[i].length <= (16 * MB + 64));
                        const hash = useWasm ? wasmImpl(chunks[i]) : sha1Bytes(chunks[i]);
                        results.set(hash, i * 20);
                        await new Promise((resolve) => setTimeout(resolve, 0));
                    }
                    finish(results);
                })());
            }
        }

        // ---- 读取：累积缓冲（至少 16MiB；区块更大时跟随区块，保证 piece 不被拆段），读满即派发 ----
        const readBufferSize = Math.max(16 * MB, blockSize);
        const readAccumulator = new Uint8Array(readBufferSize);
        let readIndex = 0;

        function onFileChunkRead(resultBytes) {
            if (signal !== null && signal.aborted) throw abortError();

            bytesRead += resultBytes.length;
            reportProgress();

            if (readIndex + resultBytes.length >= readBufferSize) {
                // 缓冲满了：填满 → 派发 → 残余留到下一轮
                const remainingSize = readBufferSize - readIndex;
                readAccumulator.set(resultBytes.subarray(0, remainingSize), readIndex);
                resultBytes = resultBytes.subarray(remainingSize);

                dispatch(readAccumulator);
                readIndex = 0;
            }

            readAccumulator.set(resultBytes, readIndex);
            readIndex += resultBytes.length;
        }

        const hasBYOB = (typeof ReadableStreamBYOBReader !== "undefined")
            && (typeof File !== "undefined") && (typeof fileList[0].file.stream === "function");

        for (const { path, file } of fileList) {
            if (file.size === 0) continue; // 0 字节文件不影响哈希

            const filePath = path.join("/");
            onProgress({ filePath, bytesRead, bytesHashed, totalSize, progress: (bytesRead + bytesHashed) / (2 * totalSize) });

            const getReadError = () => new Error(
                "Error reading file: `" + filePath + "`\nThe file might be inaccessible, or might have been modified, moved, or deleted"
            );

            if (hasBYOB) {
                // 快路径：BYOB 复用同一 ArrayBuffer，零分配
                let byobBuffer = new ArrayBuffer(readBufferSize);
                const stream = file.stream();
                const reader = stream.getReader({ mode: "byob" });

                while (true) {
                    let readResult;
                    try {
                        readResult = await reader.read(new Uint8Array(byobBuffer), { min: readBufferSize });
                    }
                    catch {
                        throw getReadError();
                    }

                    if (signal !== null && signal.aborted) throw abortError();

                    if (readResult.value !== undefined) {
                        byobBuffer = readResult.value.buffer;
                        onFileChunkRead(readResult.value);
                    }
                    if (readResult.done) break;
                }
            }
            else {
                // 慢路径：FileReader 逐块读
                const reader = new FileReader();
                const numReads = Math.ceil(file.size / readBufferSize);
                for (let i = 0; i < numReads; ++i) {
                    const startIndex = i * readBufferSize;
                    const endIndex = Math.min((i + 1) * readBufferSize, file.size);

                    let chunk;
                    try {
                        chunk = await new Promise((resolve, reject) => {
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = () => reject(new Error("FileReader error"));
                            reader.readAsArrayBuffer(file.slice(startIndex, endIndex));
                        });
                    }
                    catch {
                        throw getReadError();
                    }

                    if (signal !== null && signal.aborted) throw abortError();
                    onFileChunkRead(new Uint8Array(chunk));
                }
            }
        }

        // 文件末尾残余字节
        if (readIndex !== 0) {
            dispatch(readAccumulator.subarray(0, readIndex));
        }

        if (signal !== null && signal.aborted) throw abortError();

        await Promise.all(pending);

        if (signal !== null && signal.aborted) throw abortError();

        return pieces;
    }

    // ============================================================
    // 组装 torrent 对象 + 编码（复刻原项目 assembleTorrentObject）
    // ============================================================
    function assembleTorrent(params, input, blockSize, pieces) {
        const info = {
            name: params.name,
            pieces,
            "piece length": blockSize,
        };

        if (params.isPrivate) info.private = 1;
        if (params.source !== "") info.source = params.source;

        if (input.isSingle) {
            info.length = input.fileList[0].file.size;
        }
        else {
            info.files = input.fileList.map(({ path, file }) => ({ length: file.size, path }));
        }

        const torrent = { info };

        const trackers = getLines(params.trackers);
        if (trackers.length !== 0) {
            torrent.announce = trackers[0];
            torrent["announce-list"] = trackers.map((t) => [t]);
        }

        const webSeeds = getLines(params.webSeeds);
        if (webSeeds.length !== 0) {
            torrent["url-list"] = webSeeds;
        }

        if (params.comment !== "") torrent.comment = params.comment;
        if (params.setCreationDate) torrent["creation date"] = Math.floor(Date.now() / 1000);
        torrent["created by"] = params.createdBy || "TorrentCreatorLib (tampermonkey)";

        return torrent;
    }

    // ============================================================
    // 公开 API
    // ============================================================
    /**
     * 创建 .torrent。
     *
     * @param {Object} options
     * @param {File[]|{path: string[], file: File}[]} options.files
     *    File[]：单选文件 / webkitdirectory 选文件夹 / 平铺多文件
     *    {path, file}[]：显式指定路径（推荐，最可控）
     * @param {boolean} [options.singleFile] 强制单/多文件结构（默认自动：显式路径单条目视为单文件）
     * @param {string} [options.name] torrent 名（默认：单文件=文件名，文件夹=根目录名）
     * @param {number|"auto"} [options.pieceSize="auto"] 分片大小（2 的幂）
     * @param {boolean} [options.isPrivate=false] 私有种子（禁 DHT/PEX）
     * @param {boolean} [options.setCreationDate=true] 写入 creation date
     * @param {string[]} [options.trackers=[]]
     * @param {string[]} [options.webSeeds=[]]
     * @param {string} [options.comment=""]
     * @param {string} [options.source=""] 写入 info.source（影响 info hash）
     * @param {string} [options.createdBy=""] 写入顶层 created by（默认 "TorrentCreatorLib (tampermonkey)"）
     * @param {boolean} [options.useWorker=true] 用 Web Worker 并行；不可用自动降级主线程
     * @param {(info: {filePath?, bytesRead, bytesHashed, totalSize, progress}) => void} [options.onProgress]
     * @param {AbortSignal} [options.signal] 取消
     * @returns {Promise<{bytes: Uint8Array, blob: Blob, url: string|null,
     *                    infoHash: string, name: string, pieceLength: number}>}
     */
    async function createTorrent(options) {
        const input = normalizeInput(options.files);
        // 显式路径形式下条目数为 1 时，无法自动区分"单文件"与"文件夹内只有一个文件"，
        // 允许调用方显式指定（例如文件夹制种始终应保留多文件结构）
        if (typeof options.singleFile === "boolean") input.isSingle = options.singleFile;

        const name = options.name || input.name || "unknown";
        const pieceSize = options.pieceSize === undefined || options.pieceSize === "auto"
            ? autoPieceSize(input.totalSize)
            : options.pieceSize;

        const params = {
            name,
            isPrivate: !!options.isPrivate,
            setCreationDate: options.setCreationDate !== false,
            trackers: Array.isArray(options.trackers) ? options.trackers.join("\n") : String(options.trackers || ""),
            webSeeds: Array.isArray(options.webSeeds) ? options.webSeeds.join("\n") : String(options.webSeeds || ""),
            comment: String(options.comment || ""),
            source: String(options.source || ""),
            createdBy: String(options.createdBy || ""),
        };

        const error = validateTorrentInput(params, pieceSize, input.totalSize);
        if (error !== null) throw new Error(error);

        const wasmImpl = (await getWasmSha1()) || null; // wasm 不可用时为 null → 纯 JS

        let workerPool = null;
        if (options.useWorker !== false) {
            const maxCount = Math.min(
                (typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 1,
                8
            );
            workerPool = createWorkerPool(maxCount);
        }

        try {
            const pieces = await computePieces(input.fileList, pieceSize, {
                workerPool,
                wasmImpl,
                onProgress: options.onProgress,
                signal: options.signal || null,
            });

            const torrent = assembleTorrent(params, input, pieceSize, pieces);
            const bytes = bencodeEncode(torrent);
            const infoHash = sha1Hex(bencodeEncode(torrent.info));

            const result = {
                bytes,
                infoHash,
                name,
                pieceLength: pieceSize,
                backend: (wasmImpl !== null) ? "wasm" : "js",
            };

            if (typeof Blob !== "undefined") {
                result.blob = new Blob([bytes], { type: "application/x-bittorrent" });
            }
            if (typeof document !== "undefined" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
                result.url = URL.createObjectURL(result.blob);
            }
            else {
                result.url = null;
            }

            return result;
        }
        finally {
            if (workerPool !== null) workerPool.terminate();
        }
    }

    /**
     * 触发浏览器下载。
     * @param {Uint8Array|Blob} bytesOrBlob
     * @param {string} filename 例如 "my-torrent.torrent"
     */
    function download(bytesOrBlob, filename) {
        if (typeof document === "undefined") {
            throw new Error("download() requires a DOM environment");
        }
        const blob = (bytesOrBlob instanceof Blob)
            ? bytesOrBlob
            : new Blob([bytesOrBlob], { type: "application/x-bittorrent" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = "none";
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }

    /** 快速自检（SHA-1 标准向量 + bencode 向量），返回是否全部通过 */
    function selfTest() {
        const results = [
            sha1Hex(utf8Encode("")) === "da39a3ee5e6b4b0d3255bfef95601890afd80709",
            sha1Hex(utf8Encode("abc")) === "a9993e364706816aba3e25717850c26c9cd0d89d",
            new TextDecoder().decode(bencodeEncode("abc")) === "3:abc",
            new TextDecoder().decode(bencodeEncode({ a: "b" })) === "d1:a1:be",
            new TextDecoder().decode(bencodeEncode([1, 2])) === "li1ei2ee",
            new TextDecoder().decode(bencodeEncode({ "piece length": 16384, name: "x", pieces: new Uint8Array([1, 2]) }))
                === "d4:name1:x12:piece lengthi16384e6:pieces2:\u0001\u0002e",
        ];
        return results.every(Boolean);
    }

    const api = {
        createTorrent,
        download,
        autoPieceSize,
        bencodeEncode,
        sha1Hex,
        getInfoHash: sha1Hex,
        selfTest,
        formatSize,
        version: "1.0.0",
    };

    global.TorrentCreatorLib = api;
    // 多目标挂载：兼容油猴沙箱的各类全局实现
    try {
        if (typeof globalThis !== "undefined" && globalThis !== global) globalThis.TorrentCreatorLib = api;
        if (typeof unsafeWindow !== "undefined") unsafeWindow.TorrentCreatorLib = api;
    }
    catch { /* 忽略 */ }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = api; // Node 环境（仅用于测试）
    }
})(typeof window !== "undefined" ? window : globalThis);

/* ============================================================
 * U2 做种兼容层 —— 替代远程 https://userscript.kysdm.com/js/torrent-creator.js
 * 提供与原库相同的全局入口：createTorrentFile(fileList) / createTorrentFolder(folderList)
 * 底层使用内联的 TorrentCreatorLib（WASM 加速 + Worker 并行 + 自动降级）
 * ============================================================ */
(function () {
    "use strict";
    const TC = (typeof TorrentCreatorLib !== "undefined") ? TorrentCreatorLib
        : (typeof window !== "undefined" && window.TorrentCreatorLib) ? window.TorrentCreatorLib
        : (typeof globalThis !== "undefined" && globalThis.TorrentCreatorLib) ? globalThis.TorrentCreatorLib
        : (typeof unsafeWindow !== "undefined" ? unsafeWindow.TorrentCreatorLib : undefined);
    if (!TC) {
        console.error("[U2 torrent] TorrentCreatorLib 未加载（找不到全局 TorrentCreatorLib）");
        return;
    }

    const U2_TRACKER = "https://daydream.dmhy.best/announce";
    const U2_CREATED_BY = "https://u2.dmhy.org/forums.php?action=viewtopic&topicid=13384";
    const IGNORED_FILES = ["Thumbs.db", ".DS_Store", "desktop.ini"];
    // 区块大小默认自适应（目标 ~1200 片，16KiB~16MiB）；可在制种配置行中选择

    const q = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));
    const ui = {
        setText: (sel, text) => q(sel).forEach((e) => { e.textContent = text; }),
        setStyle: (sel, prop, val) => q(sel).forEach((e) => { e.style[prop] = val; }),
        setAttr: (sel, attr, val) => q(sel).forEach((e) => { if (attr in e) e[attr] = val; else e.setAttribute(attr, val); }),
        fadeOut: (sel, ms) => q(sel).forEach((e) => {
            e.style.transition = "opacity " + ms + "ms";
            e.style.opacity = "0";
            setTimeout(() => { e.style.display = "none"; }, ms);
        }),
    };

    const fmt = (n) => {
        if (n < 1024) return n + " B";
        if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KiB";
        if (n < 1024 * 1024 * 1024) return (n / (1024 * 1024)).toFixed(1) + " MiB";
        return (n / (1024 * 1024 * 1024)).toFixed(2) + " GiB";
    };

    function setProgress(pct) {
        ui.setStyle(".progress > div", "width", pct + "%");
        ui.setText('[name="progress-total"]', pct.toFixed(2) + "%");
    }

    // 与原库 setTorrentData 相同的名称校验
    function checkName(name) {
        if (!name || name.trim() === "") { window.alert("种子名称不能为空"); return false; }
        if (name.match(/[<>:"\\/|?*]/)) { window.alert("种子名称不能包含以下字符: < > : \\ / | ? *"); return false; }
        if (name.length > 255) { window.alert("种子名称长度不能超过 255 个字符"); return false; }
        return true;
    }

    // 与原库 finished() 相同：存 localforage（key 不含 .torrent 后缀，下载按钮会补）+ 更新 UI
    // 注意：必须 await 写入完成再返回，否则脚本紧接着调用的 pageTorrentInfo()
    // 会从 localforage 读到 null，导致种子信息/检测/文件列表不显示
    async function finish(result) {
        if (typeof localforage === "undefined") {
            window.alert("localforage 未加载，无法保存种子");
            return;
        }
        const store = localforage.createInstance({ name: "bbcodejs" });
        try {
            await Promise.all([
                store.setItem("upload_autoSaveMessageTorrentBlob", result.blob),
                store.setItem("upload_autoSaveMessageTorrentName", result.name),
            ]);
            setProgress(100);
            ui.setText('[name="progress-name"]', "完成");
            ui.setAttr("#upload_torrent,#upload_file,#upload_folder,#torrent_create", "disabled", true);
            ui.setAttr("#torrent_download,#torrent_clean", "disabled", false);
            ui.fadeOut('[name="progress"]', 3000);
        }
        catch (err) {
            console.error("[U2 torrent] 保存失败", err);
            window.alert("保存种子到本地存储失败: " + err.message);
        }
    }

    function fail(label, err) {
        let msg = "读取文件失败: " + label;
        if (err) msg += "\n原因: " + err.message + " (" + err.name + ")";
        console.error(msg);
        window.alert(msg);
        ui.setAttr("#upload_torrent,#upload_file,#upload_folder,#torrent_create", "disabled", false);
    }

    // ---- 制种任务状态：供"清除"按钮在制种期间切换为"停止制种" ----
    let activeAbort = null;
    window.__torrentCreating = false;
    window.__cancelTorrentCreation = function () {
        if (activeAbort !== null) activeAbort.abort();
    };

    function restoreCleanButton() {
        const btn = q("#torrent_clean")[0];
        if (btn) btn.value = "清除";
        ui.setAttr("#torrent_clean", "disabled", false);
    }

    // ---- 制种配置行（区块大小 / 私有 / Tracker / 评论 / 环境） ----
    // 新建一行 UI，插入在按钮表格之后；控件值在每次制种时读取
    // PT 站点：私有与 tracker 固定（不显示）；区块大小默认 16M，可选 4/8/16M
    // 注意：内联 WASM 静态缓冲区上限 16MiB（原项目编译产物）
    // flex 单行布局：标签与控件同格紧贴（间距 4px），字体随后跟随页面计算样式同步
    const CFG_ROW_HTML = '<table style="width:100%; margin-top:6px; border:none;">'
        + '<tbody>'
        + '<tr><td style="border:none; display:flex; align-items:center;">'
        + '<span style="white-space:nowrap; margin-right:4px;">区块大小：</span>'
        + '<select id="u2_piece_size" style="font-size:11px; padding:1px 2px;">'
        + '<option value="4194304">4 MiB</option>'
        + '<option value="8388608">8 MiB</option>'
        + '<option value="16777216" selected>16 MiB</option>'
        + '</select></td></tr>'
        + '<tr><td style="border:none; display:flex; align-items:center;">'
        + '<span style="white-space:nowrap; margin-right:4px;">评论：</span>'
        + '<input type="text" id="u2_comment" placeholder="种子评论（可选）" style="flex:1; min-width:0; font-size:11px; padding:1px 4px; box-sizing:border-box;">'
        + '</td></tr>'
        + '</tbody></table>';

    // 等待按钮表格注入后，把配置行插到它后面；已创建则直接返回 true
    function ensureConfigRow() {
        if (document.getElementById("u2_piece_size")) return true;
        const chooser = document.getElementById("upload_chooser");
        if (!chooser) return false; // UI 尚未注入
        const wrapper = document.createElement("div");
        wrapper.innerHTML = CFG_ROW_HTML;
        const rowEl = wrapper.firstElementChild;
        const table = (typeof chooser.closest === "function") ? chooser.closest("table") : null;
        if (table && table.parentNode) {
            table.parentNode.insertBefore(rowEl, table.nextSibling);
        }
        else if (chooser.parentNode) {
            chooser.parentNode.appendChild(rowEl);
        }
        else {
            document.body.appendChild(rowEl);
        }
        // 字体与页面 rowfollow 一致（标签继承，select/input 显式同步）
        try {
            let followTd = null;
            if (typeof chooser.closest === "function") {
                const inner = chooser.closest("td");
                const tbl = inner ? inner.closest("table") : null;
                followTd = tbl ? tbl.closest("td") : null;
            }
            const cs = followTd && (typeof window.getComputedStyle === "function") ? window.getComputedStyle(followTd) : null;
            if (cs && cs.font) {
                rowEl.style.font = cs.font;
                const sel = rowEl.querySelector("#u2_piece_size");
                const input = rowEl.querySelector("#u2_comment");
                if (sel) sel.style.font = cs.font;
                if (input) input.style.font = cs.font;
            }
        }
        catch { /* 忽略 */ }
        return true;
    }

    // 环境显示在"种子文件"标签（rowhead）中：种子文件<br>(wasm)
    // DOM 结构：rowhead td | rowfollow td { 按钮表格 { td { #upload_chooser } } ... }
    // 需要两级 closest("td") 才能从 chooser 导航到外层 rowfollow td
    function setEnvText(text) {
        const chooser = document.getElementById("upload_chooser");
        if (!chooser || typeof chooser.closest !== "function") return;
        const innerTd = chooser.closest("td");                 // 按钮表格内的 td
        const table = innerTd ? innerTd.closest("table") : null; // 按钮表格
        const outerTd = table ? table.closest("td") : null;    // 外层 rowfollow td
        const head = outerTd ? outerTd.previousElementSibling : null; // "种子文件" rowhead td
        if (!head) return;
        let env = (typeof head.querySelector === "function") ? head.querySelector("span.u2-env") : null;
        if (!env) {
            const br = document.createElement("br");
            env = document.createElement("span");
            env.className = "u2-env";
            head.appendChild(br);
            head.appendChild(env);
        }
        // 每次强制更新样式（兼容历史版本已创建但样式过期的标签）：block 居中 + 灰暗色
        env.style.cssText = "display:block; text-align:center; font-size:10px; color:#6b7280; font-style:italic; white-space:nowrap;";
        env.textContent = "(" + text + ")";
        // 清理历史版本可能残留在错误位置的同类标签
        try {
            const all = document.querySelectorAll("span.u2-env");
            for (const el of all) {
                if (el !== env && el.parentNode) el.parentNode.removeChild(el);
            }
        }
        catch { /* 忽略 */ }
    }

    // 读取配置行的当前值（控件未创建时回退默认值）
    function getSeedConfig() {
        const piece = document.getElementById("u2_piece_size");
        const comment = document.getElementById("u2_comment");
        const rawPiece = piece ? parseInt(piece.value, 10) : NaN;
        return {
            pieceSize: (Number.isFinite(rawPiece) && rawPiece > 0) ? rawPiece : (16 * 1024 * 1024), // 默认 16M
            comment: comment ? comment.value.trim() : "",
            isPrivate: true,          // PT 站点固定私种
            trackers: [U2_TRACKER],   // PT 站点固定 tracker
        };
    }

    async function runCreate(entries, name, singleFile) {
        if (!checkName(name)) return;
        const total = entries.reduce((s, e) => s + e.file.size, 0);
        const cfg = getSeedConfig(); // 读取配置行：区块大小 / 评论 / 私有 / tracker

        // 建立取消通道：制种期间"清除"按钮变为停止键
        const abortController = new AbortController();
        activeAbort = abortController;
        window.__torrentCreating = true;
        ui.setAttr("#torrent_clean", "disabled", false);
        const cleanBtn = q("#torrent_clean")[0];
        if (cleanBtn) cleanBtn.value = "停止制种";

        try {
            const result = await TC.createTorrent({
                files: entries,
                name: name.trim(),
                singleFile: singleFile, // 文件夹制种强制多文件结构（单文件文件夹也保留目录）
                pieceSize: cfg.pieceSize,
                isPrivate: cfg.isPrivate,
                setCreationDate: true,
                trackers: cfg.trackers,
                comment: cfg.comment,
                createdBy: U2_CREATED_BY,
                useWorker: true,
                signal: abortController.signal,
                onProgress: (p) => {
                    if (typeof p.filePath === "string") {
                        ui.setText('[name="progress-name"]', p.filePath.split("/").pop());
                    }
                    setProgress(Math.round(p.progress * 10000) / 100);
                    ui.setText('[name="progress-percent"]', fmt(p.bytesRead) + " / " + fmt(total));
                },
            });
            await finish(result); // 等待写入完成，保证 pageTorrentInfo() 能读到
        }
        catch (err) {
            if (err && err.name === "AbortError") {
                // 用户主动停止：静默恢复，隐藏进度条，不弹错误
                setProgress(0);
                ui.setText('[name="progress-name"]', "");
                ui.setText('[name="progress-total"]', "");
                ui.setText('[name="progress-percent"]', "");
                ui.setStyle('[name="progress"]', "display", "none"); // 与"清除"按钮行为一致：隐藏进度区
                ui.setAttr("#upload_torrent,#upload_file,#upload_folder,#torrent_create", "disabled", false);
            }
            else {
                fail(name, err);
            }
        }
        finally {
            activeAbort = null;
            window.__torrentCreating = false;
            restoreCleanButton();
        }
    }

    // ===== 与原远程库相同签名的两个入口 =====
    window.createTorrentFile = async function (fileList) {
        const f = fileList && fileList[0];
        if (!f) { window.alert("没有选择任何文件"); return; }
        await runCreate([{ path: [f.name], file: f }], f.name, true); // 单文件种子
    };

    window.createTorrentFolder = async function (folderList) {
        const list = Array.from(folderList || []).filter((f) => IGNORED_FILES.indexOf(f.name) === -1);
        if (list.length === 0) { window.alert("没有选择任何文件"); return; }
        const rootName = list[0].webkitRelativePath ? list[0].webkitRelativePath.split("/")[0] : list[0].name;
        const entries = list.map((f) => ({
            path: f.webkitRelativePath ? f.webkitRelativePath.split("/").slice(1) : [f.name],
            file: f,
        }));
        await runCreate(entries, rootName, false); // 文件夹：保留目录结构
    };

    // 页面加载完成后：创建制种配置行 + 常驻显示制种环境（WASM / 纯 JS）
    (function showSeedEnv() {
        const isWasm = (typeof WebAssembly !== "undefined") && (typeof WebAssembly.instantiate === "function");
        const show = () => {
            if (!ensureConfigRow()) return false; // 按钮表格尚未注入
            setEnvText(isWasm ? "wasm" : "js");
            return true;
        };
        if (show()) return;
        let tries = 0;
        const timer = setInterval(function () {
            if (show() || (++tries > 60)) clearInterval(timer); // 最多等 30 秒
        }, 500);
    })();

    // 等效原库首行：启用制种按钮
    // 注意：按钮 DOM 由脚本异步注入（在 loadScript 之后），此处执行时元素尚不存在，
    // 因此用 MutationObserver 监听 + 轮询兜底，元素出现后立即启用
    (function enableSeedButtons() {
        // 按钮 DOM 由脚本异步注入（先 await 加载 localforage/mediainfo/conversion 后才注入），
        // 慢网络下可能超过 10 秒，因此持续等待直到按钮出现并成功启用，成功即停止。
        const TARGETS = "#upload_file,#upload_folder,#torrent_create";
        const tryEnable = () => ui.setAttr(TARGETS, "disabled", false);
        const allEnabled = () => {
            const els = q(TARGETS);
            return (els.length >= 3) && els.every((e) => !e.disabled);
        };

        tryEnable(); // 立即尝试一次

        let done = false;
        const finish = () => { done = true; };

        if (typeof MutationObserver !== "undefined") {
            try {
                const observer = new MutationObserver(() => {
                    tryEnable();
                    if (allEnabled()) { observer.disconnect(); finish(); }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });
            }
            catch { /* 观察失败则依赖下方轮询兜底 */ }
        }

        // 轮询兜底：每 500ms 尝试，成功后停止；上限 5 分钟（覆盖极慢网络）
        const fallback = setInterval(() => {
            if (done) { clearInterval(fallback); return; }
            tryEnable();
            if (allEnabled()) { clearInterval(fallback); finish(); }
            else if (Date.now() - start > 300000) { clearInterval(fallback); }
        }, 500);
        const start = Date.now();

        // 兜底 2：脚本注入 UI 后页面的 load 事件（DOM 就绪的最后一刻）
        if (document.readyState !== "complete") {
            window.addEventListener("load", tryEnable, { once: true });
        }
    })();
})();

(async () => {
    // 声明全局变量
    // https://api.jquery.com/jQuery.noConflict/
    const jq = jQuery.noConflict();
    // 网站语言
    const lang = new lang_init(jq('#locale_selection').val());;
    // CSS
    jq('body').append(`<style type="text/css">td.smile-icon { padding: 3px !important; }</style>`);
    jq('body').append(`<style type="text/css">.dir_size { color: gray; white-space: nowrap; }</style>`);
    // JS
    jq('body').append(`<script type="text/javascript">function createTag(name,attribute,content){var components=[];components.push('[');components.push(name);if(attribute!==null){components.push('=');components.push(attribute)}components.push(']');if(content!==null){components.push(content);components.push('[/');components.push(name);components.push(']')}return components.join('')};function replaceText(str,start,end,replacement){return str.substring(0,start)+replacement+str.substring(end)};function addTag(textArea,name,attribute,content,surround){var selStart=textArea.selectionStart;var selEnd=textArea.selectionEnd;if(selStart===null||selEnd===null){selStart=selEnd=textArea.value.length}var selTarget=selStart+name.length+2+(attribute?attribute.length+1:0);if(selStart===selEnd){textArea.value=replaceText(textArea.value,selStart,selEnd,createTag(name,attribute,content))}else{var replacement=null;if(surround){replacement=createTag(name,attribute,textArea.value.substring(selStart,selEnd))}else{replacement=createTag(name,attribute,content)}textArea.value=replaceText(textArea.value,selStart,selEnd,replacement)}textArea.setSelectionRange(selTarget,selTarget)};</script>`);

    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js')
    await loadScript('https://userscript.kysdm.com/js/mediainfo.js?v=1.0')
    await loadScript('https://userscript.kysdm.com/js/conversion.js?v=1.0')

    // DB
    const db = localforage.createInstance({ name: "bbcodejs" });
    const attachmap_db = localforage.createInstance({ name: "attachmap" });
    const history_db = localforage.createInstance({ name: "history" });

    // 现存BBCODE元素
    (async () => {
        if (jq('.bbcode').length === 0) return;  // 判断页面是否存在 bbcode 输入框
        new init();
        const url = location.href.match(/u2\.dmhy\.org\/(upload|forums|comment|contactstaff|sendmessage|edit)\.php/i);
        const isStaffbox = /u2\.dmhy\.org\/staffbox\.php.*[?&]action=answermessage/i.test(location.href);
        if (!url && !isStaffbox) return;
        const page = url ? url[1] : 'staffbox';
        await syncScroll('#bbcodejs_tbody', page, '.bbcode', '#bbcode2');
        if (page === 'upload') { await autoSaveUpload(); } else { await autoSaveMessage('#bbcodejs_tbody', '.bbcode', '#qr', page, '#compose'); }

        jq('.bbcode').parents("tr:eq(1)").after('<tr><td id="preview_bbcode" class="rowhead nowrap" valign="top" style="padding: 3px" align="right">' + lang['preview']
            + '</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2">'
            + '<div id="bbcode2" style="min-height: 25px; max-height: ' + (jq('.bbcode').height() + 30) + 'px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;">'
            + '<div class="child">' + await bbcode2html(jq('.bbcode').val()) + '</div></div></td></tr></tbody></table></td>');

        syncWindowChange('.bbcode', '#bbcode2');

        jq('.bbcode').bind('input propertychange', async function updateValue() {
            let html = await bbcode2html(jq(this).val());
            jq('#bbcode2').children('.child').html(html);
        });

        jq('.codebuttons').click(async function updateValue() {
            let html = await bbcode2html(jq('.bbcode').val());
            jq('#bbcode2').children('.child').html(html);
        });

        jq('#compose').find("td.embedded.smile-icon a").each(function () {
            jq(this).attr('href', jq(this).attr('href').replace(/javascript: SmileIT\('\[(.+?)\]','[^']+?','[^']+?'\)/gis, function (s, x) { return `javascript:void('${x}');` }));
        })
            .click(async function () {
                onEditorActionBox(jq(this).attr('href'), '.bbcode');
                jq('#bbcode2').children('.child').html(await bbcode2html(jq('.bbcode').val()));
            });

        if (/u2\.dmhy\.org\/upload\.php/i.test(location.href)) {

            // 添加中括号
            function add_brackets(txt) { if (txt === '') { return ''; } else { return '[' + txt + ']'; } };

            // 检查重叠的中括号
            function check_title(txt) {
                if (/\[{2,}|\]{2,}/g.test(txt)) { return '<font color="red">' + txt + '</font>'; } else { return txt; }
            };

            var main_title = '<font color="red"><b>' + lang['select_type'] + '</b></font>';

            function addMainTitle() {
                const custom_title = jq('#custom_title').val();
                let type_id = jq('#browsecat').val();

                if (custom_title !== '') {
                    main_title = `<b>${custom_title}</b>`
                } else if (type_id === '0') {
                    main_title = '<font color="red"><b>' + lang['select_type'] + '</b></font>';
                } else if (['9', '411', '413', '12', '13', '14', '15', '16', '17', '410', '412'].indexOf(type_id) !== -1) {
                    main_title = '<b>'
                        + add_brackets(jq('#anime_chinese-input').val())
                        + add_brackets(jq('#anime_english-input').val())
                        + add_brackets(jq('#anime_original-input').val())
                        + add_brackets(jq('#anime_source-input').val())
                        + add_brackets(jq('#anime_resolution-input').val())
                        + add_brackets(jq('#anime_episode-input').val())
                        + add_brackets(jq('#anime_container-input').val())
                        + add_brackets(jq('#anime_extra-input').val())
                        + '</b>';
                } else if (['21', '22', '23'].indexOf(type_id) !== -1) {
                    main_title = '<b>'
                        + add_brackets(jq('#manga_title-input').val())
                        + add_brackets(jq('#manga_author-input').val())
                        + add_brackets(jq('#manga_volume-input').val())
                        + add_brackets(jq('#manga_ended').find("select").val())
                        + add_brackets(jq('#manga_publisher-input').val())
                        + add_brackets(jq('#manga_remark-input').val())
                        + '</b>';
                } else if (type_id === '30') {
                    var prefix_1 = jq('#music_prefix').find("select").val();
                    var prefix_2 = jq('#music_collection').find("select").val();
                    if (['EAC', 'XLD'].indexOf(prefix_1) !== -1) { var music_quality = false; }
                    else if (['Hi-Res', 'Web'].indexOf(prefix_1) !== -1) { var music_quality = true; };
                    switch (prefix_2) {
                        case "0": // 单张
                            main_title = '<b>'
                                + add_brackets(prefix_1)
                                + add_brackets(jq('#music_date-input').val())
                                + add_brackets(jq('#music_category-input').val())
                                + add_brackets(jq('#music_artist-input').val())
                                + add_brackets(jq('#music_title-input').val())
                                + add_brackets(jq('#music_serial_number-input').val())
                                + add_brackets((() => { if (music_quality) { return jq('#music_quality-input').val(); } else { return ''; } })())
                                + add_brackets(jq('#music_format-input').val())
                                + '</b>';
                            break;
                        case "1": // 合集
                            main_title = '<b>'
                                + add_brackets(prefix_1)
                                + add_brackets('合集')
                                + add_brackets(jq('#music_category-input').val())
                                + add_brackets(jq('#music_title-input').val())
                                + add_brackets(jq('#music_quantity-input').val())
                                + add_brackets((() => { if (music_quality) { return jq('#music_quality-input').val(); } else { return ''; } })())
                                + '</b>';
                            break;
                    }
                } else if (type_id === '40') {
                    main_title = '<b>' + jq('#other_title-input').val() + '</b>';
                }

                jq('#checktitle').html(check_title(main_title));
            }

            jq("#browsecat").change(() => { new addMainTitle; });
            jq(".torrent-info-input").bind('input propertychange', () => { new addMainTitle; });
            jq('#other_title').after('<tr><td class="rowhead nowrap" valign="top" align="right">' + lang['main_title'] + '</td>'
                + '<td id="checktitle" class="rowfollow" valign="top" align="left" valign="middle">' + main_title + '</td></tr>'
            );


            const token = await history_db.getItem('token');
            let token_waring = ''

            if (token === null || token.length !== 96) {
                token_waring = `<span style="color: red">API Token 不存在或无效</span>&nbsp;
<a href="https://greasyfork.org/zh-CN/scripts/428545" style="font-weight: bold; text-decoration: underline; font-style: italic;">鉴权脚本 (安装后打开任意种子页面触发鉴权)</a>`};

            jq('#anime_chinese').before(`
<tr>
    <td class="rowhead nowrap" valign="top" align="right">引用种子</td>
    <td class="rowfollow" valign="top" align="left">
        <input type="text" id="copytorrentinfo" size="10">
        <button id="copyButton" style="margin-left: 10px; margin-right:10px;">确定</button>
        ${token_waring}
        <br>
        输入种子ID，复制该种子的描述信息。
    </td>
</tr>
<tr>
    <td class="rowhead nowrap" valign="top" align="right">自定义标题</td>
    <td class="rowfollow" valign="top" align="left">
        <input type="text" id="custom_title" name="custom_title" style="width: 80%;"><br>
        除非你确切知道你在做什么，否则请不要在此处输入任何内容。
    </td>
</tr>`
            )

            const browsecat_options = {};
            const uid = jq("#info_block a:first").attr("href").match(/id=(\d+)/)[1];

            jq("#browsecat option").each(function () {
                const text = jq(this).text();
                const value = jq(this).val();
                browsecat_options[text] = value;
            });

            jq("#custom_title").bind('input propertychange', () => { new addMainTitle; });

            // console.log(browsecat_options);

            jq('#copyButton').click(async function (ev) {
                ev.preventDefault(); // 阻止表单的提交行为

                let tid = jq('#copytorrentinfo').val().trim();;
                if (isNaN(tid)) { window.alert('无效种子ID'); return; }

                let api = await getApi(token, uid, tid);
                if (api.message !== 'success') { window.alert(`API获取发生错误\n\n${api.msg}`); console.log(api); return; }

                let torrents = api.data.items;

                if (Object.keys(torrents).length === 0) { window.alert('API没有此种子数据'); return; }

                jq("#compose input[id]").map(function () {
                    // 预先清空所有字段
                    if (this.id.endsWith("-input") || this.id === 'poster') jq(`#${this.id}`).val('');
                    jq('#custom_title').val(torrents[0].title)
                    jq('[name="small_descr"]').val(torrents[0].subtitle);
                    jq('[name="anidburl"]').val(torrents[0].anidb === null ? '' : `https://anidb.net/anime/${torrents[0].anidb}`);
                    jq('#browsecat').val(browsecat_options[torrents[0]['category']]);
                    document.getElementById('browsecat').dispatchEvent(new Event('change')); // 手动触发列表更改事件
                    jq('.bbcode').val(torrents[0].description_info);
                    jq('[class^="torrent-info-input"]').trigger("input"); // 手动触发标题更改
                    jq('.bbcode').trigger("input"); // 手动触发bbcode更改
                });

            })


            // 种子文件
            jq('#torrent').parent().html(`
<table style="width: 100%; table-layout:fixed; border: none; cellspacing: none; cellpadding: none;">
    <tbody>
        <tr>
            <td style="width: 430px; border: none;">
                <input type="file" accept=".torrent" class="file" style="display: none" id="torrent" name="file">
                <input type="file" class="file" style="display: none" id="filechooser">
                <input type="file" class="file" style="display: none" id="folderchooser" webkitdirectory>
                <input class="codebuttons" id="upload_torrent" style="font-size:11px; margin-right:3px" type="button" value="上传种子" onclick="document.getElementById('torrent').click()">
                <input class="codebuttons" id="upload_file" style="font-size:11px; margin-right:3px" type="button" value="单文件制种" onclick="document.getElementById('filechooser').click()" disabled>
                <input class="codebuttons" id="upload_folder" style="font-size:11px; margin-right:3px" type="button" value="多文件制种" onclick="document.getElementById('folderchooser').click()" disabled>
                <input class="codebuttons" id="torrent_create" style="font-size:11px; margin-right:3px" type="button" value="开始制种" disabled>
                <input class="codebuttons" id="torrent_download" style="font-size:11px; margin-right:3px" type="button" value="下载种子" disabled>
                <input class="codebuttons" id="torrent_clean" style="font-size:11px; margin-right:3px" type="button" value="清除">
            </<td>
            <td style="border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <a id="download_link" style="display: none"></a>
                <span id="upload_chooser" style="text-align: left; font-style: italic;"></span>
            </<td>
        </tr>
    </tbody>
</table>
<table style="width: 100%; table-layout:fixed; border: none; cellspacing: none; cellpadding: none;">
    <tbody>
        <tr>
            <td name="progress" style="width: 25%; border: none;">
                <div class="progress"><div>
            </td>
            <td name="progress" style="width: 23%; border: none; text-align: center; font-style: italic;">
                <span name="progress-percent"></span>
            </td>
            <td name="progress" style="width: 8%; border: none; text-align: center; font-style: italic;">
                <span name="progress-total"></span>
            </td>
            <td name="progress" style="border: none; font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                <span name="progress-name"></span>
            </td>
        </tr>
    </tbody>
</table>`);

            jq('#compose').find("tr:eq(1)").after(`
<tr>
    <td class="rowhead nowrap" valign="top" align="right">种子信息</td>
    <td class="rowfollow" valign="top" align="left">
        <table style="width: 100%; table-layout:fixed; border: none; cellspacing: none; cellpadding: none;">
            <tbody>
                <tr>
                    <td style="width: auto; border: none;">
                        <span id="torrentinfo1" style="text-align: left;">-</span>
                        <span id="torrentinfo2" style="text-align: left;"></span>
                    </td>
                    <td style="width: auto; border: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        <font id="torrentinfo3" style="color: red; font-weight: bold;"></font>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>
<tr>
    <td class="rowhead nowrap" valign="top" align="right">种子检测</td>
    <td class="rowfollow" valign="top" align="left">
        <table style="width: 100%; table-layout:fixed; border: none; cellspacing: none; cellpadding: none;">
            <tbody>
                <tr>
                    <td style="width: auto; border: none;">
                        <span id="torrentcheck" style="text-align: left;">-</span>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>
<tr>
    <td class="rowhead nowrap" valign="top" align="right">种子列表<br>
        <span id="expandall" style="font-weight: normal; display: inline;"><a href="javascript: expandall(true)">[全部展开]</a></span>
        <span id="closeall"  style="font-weight: normal; display: none;"><a href="javascript: expandall(false)">[全部关闭]</a></span>
    </td>
    <td id="file_tree" class="rowfollow" align="left">
        <span id="filelist" style="display: block;">-</span>
    </td>
</tr>
`);

            // 已内联 TorrentCreatorLib + U2 兼容层（不再加载远程 torrent-creator.js）

            jq('.progress').css({
                'width': '99%',
                'height': '8px',
                'border': '1px solid #ccc',
                'border-radius': '5px',  // 圆角
                'margin': '8px 2px',
                'overflow': 'hidden',
            });
            jq('.progress > div').css({
                'width': '0px',
                'height': '100%',
                'background-color': '#8db8ff',
                'transition': 'all 300ms ease'
            }); // 设置进度条颜色
            jq('[name="progress"]').hide();  // 隐藏进度条
            // 显示上传的文件名 & 去除其余上传框内的值
            jq('#torrent').change(async function () {
                const response = await fetch(URL.createObjectURL(this.files[0]));
                const torrent_blob = await response.blob();
                console.log(torrent_blob);
                await db.setItem(`upload_autoSaveMessageTorrentBlob`, torrent_blob);
                await db.setItem(`upload_autoSaveMessageTorrentName`, this.files[0].name);
                jq('#upload_chooser').text(this.files[0].name);
                jq('#upload_chooser').prop('title', this.files[0].name);
                jq('#filechooser').val('');
                jq('#folderchooser').val('');
                jq('#qr').attr('disabled', false);  // 解除上传按钮限制
                jq('#torrent_download').attr('disabled', false);  // 解除按钮禁用
                jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止其余种子处理按钮
                await pageTorrentInfo();
            });
            jq('#filechooser').change(function () {
                const encoder = new TextEncoder();
                const maxPathName = this.files[0].name;
                const maxPathUtf8Bytes = encoder.encode(maxPathName).length;
                if (maxPathUtf8Bytes > 230 && !confirm(`文件路径超长，是否继续？\n\n${maxPathUtf8Bytes}\n\n${maxPathName}`)) return;
                jq('#upload_chooser').text(this.files[0].name);
                jq('#upload_chooser').prop('title', this.files[0].name);
                jq('#torrent').val('');
                jq('#folderchooser').val('');
            });
            jq('#folderchooser').change(function () {
                const encoder = new TextEncoder();
                let maxPathUtf8Bytes = 0;
                let maxPathName = new Array();

                for (const file of this.files) {
                    const currentPath = file.webkitRelativePath;
                    const currentPathUtf8Bytes = encoder.encode(currentPath).length;
                    if (maxPathUtf8Bytes < currentPathUtf8Bytes) {
                        maxPathUtf8Bytes = currentPathUtf8Bytes;
                        maxPathName = [currentPath];
                    } else if (maxPathUtf8Bytes === currentPathUtf8Bytes) {
                        maxPathName.push(currentPath);
                    };
                };

                if (maxPathUtf8Bytes > 230 && !confirm(`文件路径超长，是否继续？\n\n${maxPathUtf8Bytes}\n\n${maxPathName.join('\n')}`)) return;

                jq('#upload_chooser').text((this.files[0].webkitRelativePath).split("/")[0]);
                jq('#upload_chooser').prop('title', (this.files[0].webkitRelativePath).split("/")[0]);
                jq('#torrent').val('');
                jq('#filechooser').val('');
            });
            jq('#qr').attr('disabled', true);  // 未上传种子前，禁止上传按钮
            // 种子创建按钮
            jq('#torrent_create').click(async function () {
                let file = jq('#filechooser')[0].files;
                let folder = jq('#folderchooser')[0].files;
                if (file.length !== 0) {
                    torrent_start();
                    await createTorrentFile(file);
                    await pageTorrentInfo();
                    // jq('#torrent_download,#torrent_clean').attr('disabled', false);  // 解除按钮禁用
                } else if (folder.length !== 0) {
                    torrent_start();
                    await createTorrentFolder(folder);
                    await pageTorrentInfo();
                } else {
                    window.alert('没有选择任何文件');
                    return;
                };
            });
            // 清空
            jq('#torrent_clean').click(async function () {
                // 制种进行中：清除按钮 = 停止制种
                if (window.__torrentCreating) {
                    if (typeof window.__cancelTorrentCreation === 'function') window.__cancelTorrentCreation();
                    return;
                }
                jq('#torrent').val('');
                jq('#filechooser').val('');
                jq('#folderchooser').val('');
                jq('#upload_chooser').text('');
                jq('#upload_chooser').prop('title', '');
                jq('[name="progress"]').hide();  // 隐藏进度条
                jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', false);
                jq('#torrent_download,#qr').attr('disabled', true);  // 禁用按钮
                jq('.progress > div').css('width', "0%");
                jq('[name="progress-total"],[name="progress-name"],[name="progress-percent"]').text('');
                jq('#download_link').attr('href', 'javascript:void(0)').attr('download', '');  // 删除下载按钮的URL
                await db.removeItem(`upload_autoSaveMessageTorrentBlob`);
                await db.removeItem(`upload_autoSaveMessageTorrentName`);
                jq('#torrentinfo1').html('-');
                jq('#torrentinfo2').html('');
                jq('#torrentinfo3').html('');
                jq('#file_tree').html('-');
                jq('#torrentcheck').html('-');
            });
            var downloadUrl;
            jq('#torrent_download').click(async function () {
                let a_1 = document.getElementById("download_link");
                const blob = await db.getItem(`upload_autoSaveMessageTorrentBlob`);
                const filename = await db.getItem(`upload_autoSaveMessageTorrentName`) + '.torrent';
                window.URL.revokeObjectURL(downloadUrl);
                downloadUrl = window.URL.createObjectURL(blob);
                a_1.href = downloadUrl;
                a_1.download = filename;
                a_1.click();
            });
            const torrent_start = () => {
                jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create,#torrent_download,#torrent_clean').attr('disabled', true);
                jq('[name="progress"]').css('opacity', 1);
                jq('[name="progress"]').show();
            };

            // 拖拽
            jq('#compose > table > tbody > tr:lt(5)').on({
                dragenter: function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                },
                dragover: function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                },
                drop: async function (e) {
                    e.preventDefault();
                    e.stopPropagation();

                    // 递归扫描文件夹
                    const filesList = new Array();
                    const encoder = new TextEncoder();
                    const scanFiles = (entry) => {
                        return new Promise(async (resolve, reject) => {
                            if (entry.isDirectory) {
                                const directoryReader = entry.createReader()
                                const read = () => {
                                    return new Promise((resolve, reject) => {
                                        directoryReader.readEntries(
                                            async (entries) => {
                                                for (let i = 0; i <= entries.length - 1; i++)  await scanFiles(entries[i]);
                                                resolve(entries);
                                            },
                                            (e) => {
                                                reject(e)
                                            }
                                        );
                                    });
                                };
                                const entries = await read();
                                if (entries.length > 0) await read();
                                // console.log('完成读取当前文件夹');
                                resolve();
                            } else {
                                entry.file(
                                    async (file) => {
                                        const path = entry.fullPath.substring(1);
                                        const newFile = Object.defineProperty(file, 'webkitRelativePath', { value: path, });
                                        filesList.push(newFile)
                                        resolve();
                                    },
                                    (e) => {
                                        reject(e)
                                    }
                                );
                            };
                        });
                    };

                    let f = e.originalEvent.dataTransfer.files;   // 获取文件对象
                    if (f.length === 0) return false;
                    if (f.length !== 1) { window.alert('只允许单个文件/文件夹'); return false; };

                    let items = e.originalEvent.dataTransfer.items;
                    for (let i = 0; i <= items.length - 1; i++) {
                        // 实际这个循环只会运行一次 <不允许多文件夹上传>
                        let item = items[i];
                        if (item.kind === "file") {
                            let entry = item.webkitGetAsEntry();
                            await scanFiles(entry);
                        };
                    };

                    if (filesList.length === 1) {
                        // 可能是单文件也可能是文件夹内只有一个文件
                        if (filesList[0].webkitRelativePath === filesList[0].name) {
                            if (filesList[0].name.toLowerCase().match(/.+\.torrent$/)) {
                                // console.log('是种子文件');
                                const response = await fetch(URL.createObjectURL(filesList[0]));
                                const torrent_blob = await response.blob();
                                await db.setItem(`upload_autoSaveMessageTorrentBlob`, torrent_blob);
                                await db.setItem(`upload_autoSaveMessageTorrentName`, filesList[0].name);
                                jq('#upload_chooser').text(filesList[0].name);
                                jq('#upload_chooser').prop('title', filesList[0].name);
                                jq('#qr').attr('disabled', false);  // 解除上传按钮锁定
                                // jq('#torrent_download,#torrent_clean').attr('disabled', false);  // 解除按钮禁用
                                jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止其余种子处理按钮
                                await pageTorrentInfo();
                            } else {
                                // console.log('是普通单文件');
                                const maxPathName = filesList[0].name;
                                const maxPathUtf8Bytes = encoder.encode(maxPathName).length;
                                if (maxPathUtf8Bytes > 230 && !confirm(`文件路径超长，是否继续？\n\n${maxPathUtf8Bytes}\n\n${maxPathName}`)) return;
                                jq('#upload_chooser').text(filesList[0].name);
                                jq('#upload_chooser').prop('title', filesList[0].name);
                                torrent_start();
                                await createTorrentFile(filesList);
                                jq('#qr').attr('disabled', false);
                                // jq('#torrent_download,#torrent_clean').attr('disabled', false);
                                await pageTorrentInfo();
                            };
                        } else {
                            // console.log('文件夹内有一个文件');
                            const maxPathName = filesList[0].webkitRelativePath
                            const maxPathUtf8Bytes = encoder.encode(maxPathName).length;
                            if (maxPathUtf8Bytes > 230 && !confirm(`文件路径超长，是否继续？\n\n${maxPathUtf8Bytes}\n\n${maxPathName}`)) return;
                            jq('#upload_chooser').text((filesList[0].webkitRelativePath).split("/")[0]);
                            jq('#upload_chooser').prop('title', (filesList[0].webkitRelativePath).split("/")[0]);
                            torrent_start();
                            await createTorrentFolder(filesList);
                            jq('#qr').attr('disabled', false);
                            // jq('#torrent_download,#torrent_clean').attr('disabled', false);
                            await pageTorrentInfo();
                        };
                    } else {
                        // console.log('文件夹内有多个文件');
                        let maxPathUtf8Bytes = 0;
                        let maxPathName = new Array();

                        for (const file of filesList) {
                            const currentPath = file.webkitRelativePath;
                            const currentPathUtf8Bytes = encoder.encode(currentPath).length;
                            if (maxPathUtf8Bytes < currentPathUtf8Bytes) {
                                maxPathUtf8Bytes = currentPathUtf8Bytes;
                                maxPathName = [currentPath];
                            } else if (maxPathUtf8Bytes === currentPathUtf8Bytes) {
                                maxPathName.push(currentPath);
                            };
                        };

                        if (maxPathUtf8Bytes > 230 && !confirm(`文件路径超长，是否继续？\n\n${maxPathUtf8Bytes}\n\n${maxPathName.join('\n')}`)) return;

                        jq('#upload_chooser').text((filesList[0].webkitRelativePath).split("/")[0]);
                        jq('#upload_chooser').prop('title', (filesList[0].webkitRelativePath).split("/")[0]);
                        torrent_start();
                        await createTorrentFolder(filesList);
                        jq('#qr').attr('disabled', false);
                        // jq('#torrent_download,#torrent_clean').attr('disabled', false);
                        await pageTorrentInfo();
                    };

                }
            });

            jq('#qr').click(async function (e) {
                e.preventDefault();
                this.disabled = true; // 禁止按钮重复点击
                const torrentBlob = await db.getItem(`upload_autoSaveMessageTorrentBlob`);

                if (torrentBlob === null || typeof torrentBlob === 'undefined') {
                    window.alert('种子文件不存在，在其他页面点击清除按钮了？');
                    return;
                }

                console.log(new File([torrentBlob], "a.torrent", { type: "application/octet-stream" }));

                const p = () => {
                    return new Promise(function (resolve, reject) {
                        // https://developer.mozilla.org/zh-CN/docs/Web/API/FormData
                        let formdata = new FormData(document.getElementById('compose'));

                        // 处理自定义标题的结构
                        let customTitle = formdata.get("custom_title");
                        if (!isWhitespace(customTitle)) {
                            // 自定义标题中有数据时
                            const category = formdata.get("type");
                            customTitle = customTitle.replace(/^\[|\]$/g, '');  // 去除自定义标题两边的括号，提交后系统会自动补全

                            if (['9', '411', '413', '12', '13', '14', '15', '16', '17', '410', '412'].includes(category)) {
                                for (let pair of formdata.entries()) if (pair[0].startsWith('anime_')) formdata.set(pair[0], '');
                                formdata.set("anime_chinese", customTitle);
                            } else if (['21', '22', '23'].includes(category)) {
                                for (let pair of formdata.entries()) if (pair[0].startsWith('manga_')) formdata.set(pair[0], '');
                                formdata.set("manga_title", customTitle);
                            } else if (category === '30') {
                                for (let pair of formdata.entries()) if (pair[0].startsWith('music_')) formdata.set(pair[0], '');
                                formdata.set("music_title", customTitle);
                            } else if (category === '40') {
                                formdata.set("other_title", customTitle);
                            }

                        }

                        if (torrentBlob) formdata.set("file", new File([torrentBlob], "a.torrent", { type: "application/octet-stream" }));

                        const request = new XMLHttpRequest();
                        request.open("POST", "takeupload.php");
                        request.timeout = 5000; // 超时时间 单位毫秒
                        request.onload = function () {
                            if (request.status >= 200 && request.status < 300) {
                                resolve({
                                    status: request.status,
                                    response: request.response,
                                    responseURL: request.responseURL
                                });
                            } else {
                                reject({
                                    status: request.status,
                                    statusText: request.statusText
                                });
                            };
                        };
                        request.onerror = function () {
                            reject({
                                status: request.status,
                                statusText: request.statusText
                            });
                        };
                        request.ontimeout = function () {
                            reject({
                                status: 408,
                                statusText: "Request timed out"
                            });
                        };
                        request.send(formdata);
                    });
                };

                p().then(async r => {
                    if (!r.responseURL.includes("takeupload.php")) {
                        // 成功上传
                        // console.log('成功上传');
                        clearInterval(jq(`#upload_auto_save_text`).attr('title')); // 停止自动保存
                        await db.removeItem(`upload_autoSaveMessageTime`);
                        await db.removeItem(`upload_autoSaveMessageBbcode`);
                        await db.removeItem(`upload_autoSaveMessageSmallDescr`);
                        await db.removeItem(`upload_autoSaveMessagePoster`);
                        await db.removeItem(`upload_autoSaveMessageAnidbUrl`);
                        await db.removeItem(`upload_autoSaveMessageInfo`);
                        await db.removeItem(`upload_autoSaveMessageTorrentBlob`);
                        await db.removeItem(`upload_autoSaveMessageTorrentName`);
                        // console.log(`upload-已清空保存的记录`);
                        window.open(r.responseURL, '_self');
                        return;
                    };
                    const h = document.createElement('div');
                    h.innerHTML = r.response;
                    let warn = jq(h).find('#outer').text();
                    warn = warn ? warn.trim() : warn;
                    window.alert(warn)
                    console.log(warn);
                    this.disabled = false;  // 解除按钮禁止点击
                }).catch(e => {
                    console.error(e);
                    window.alert('上传发生错误\n' + e)
                    this.disabled = false;  // 解除按钮禁止点击
                });

            });

        };


        function init() {
            const type = 'original';
            let h1 = jq('.codebuttons').eq(6).parent().html();
            let h2 = jq('.codebuttons').eq(7).parent().html();
            let h3 = jq('.codebuttons').eq(8).parent().html();
            jq('.codebuttons').eq(8).parent().remove();
            jq('.codebuttons').eq(7).parent().remove();
            jq('.codebuttons').eq(6).parent().remove();
            jq('input[value="URL"]').parent().remove();
            jq('input[value="IMG"]').parent()
                .before(`<td class="embedded"><input class="codebuttons" style="text-decoration: line-through; margin-right:3px" type="button" value="S" name="${type}_bbcode_button"></td>`)
                .before(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="URL*" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="CODE" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="PRE" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="LIST" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="RT*" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="IMGINK" name="${type}_bbcode_button"></td>`);
            jq('input[value="QUOTE"]').parent()
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER*" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="SPOILER" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="MEDIAINFO" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="INFO" name="${type}_bbcode_button"></td>`)
                .after(`<td class="embedded"><input class="codebuttons" style="font-size:11px;margin-right:3px" type="button" value="QUOTE*" name="${type}_bbcode_button"></td>`);
            jq('.codebuttons').parents('table').eq(0).after('<div id="bbcodejs_tbody" style="position:relative; margin-top: 4px"></div>');
            jq('#bbcodejs_tbody').append('<div id="bbcodejs_select" style="position: absolute; margin-top:2px; margin-bottom:2px; float: left;">' + h1 + h2 + h3 + '</div>');
            const margin = jq('.codebuttons').parents('tbody').eq(0).width() - jq("#bbcodejs_select").width() - 2.6;
            jq("#bbcodejs_select").css("margin-left", margin + "px");
            jq(`[name="${type}_bbcode_button"]`).click(function () { onEditorActionBox(this.value, `.bbcode`); });
        }
    })();

    async function bbcode2html(bbcodestr) {
        var tempCode = new Array();
        var tempCodeCount = 0;
        let lost_tags = new Array();

        function addTempCode(value) {
            tempCode[tempCodeCount] = value;
            let returnstr = "<tempCode_" + tempCodeCount + ">";
            tempCodeCount++;
            return returnstr;
        };

        const escape_reg = new RegExp("[&\"\'<>]", "g");
        bbcodestr = bbcodestr.replace(escape_reg, function (s, x) {
            switch (s) {
                case '&':
                    return '&amp;';
                case '"':
                    return '&quot;';
                case "'":
                    return '&#039;';
                case '<':
                    return '&lt;';
                case '>':
                    return '&gt;';
                default:
                    return s;
            };
        });

        bbcodestr = bbcodestr.replace(/\r\n/g, () => { return '<br>' });
        bbcodestr = bbcodestr.replace(/\n/g, () => { return '<br>' });
        bbcodestr = bbcodestr.replace(/\r/g, () => { return '<br>' });
        bbcodestr = bbcodestr.replace(/  /g, ' &nbsp;');

        let br_end = '';  // 对结尾的换行符进行计数
        let br;
        if (br = bbcodestr.match(/(?:<br>)+$/)) {
            br_end = br[0];
            const regex = new RegExp(`${br_end}$`, "");
            bbcodestr = bbcodestr.replace(regex, '');
        };

        const checkLostTags = (value, r_tag_start, r_tag_end) => {
            let state = false;

            let r_tag_start_exec = r_tag_start.exec(value);
            let index_start = r_tag_start_exec ? (r_tag_start_exec.index + r_tag_start_exec[0].length) : 0;
            let r_tag_end_exec = r_tag_end.exec(value.slice(index_start));

            if (r_tag_start_exec && !r_tag_end_exec) {
                let tag_start_val = r_tag_start_exec.groups.tag;;
                console.log('检测到丢失的标签 => ' + `[/${tag_start_val}]`);
                lost_tags.push(`[/${tag_start_val}]`);
                state = true;
            };

            return { "state": state };
        };

        const url = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[url=.(?:&quot;){0,2}\]/i, function (s) { return '[url]'; }); }
            if (val) {
                const lost = checkLostTags(textarea, /\[(?<tag>url)=[^\[]*?/i, /\[\/(?<tag>url)\]/i);
                if (lost.state) { return textarea.replace(/\[url=[^\[]*?/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[url=(.+?)\](.*?)\[\/url\]/i, function (all, url, text) {
                    if (url.match(/\s|\[/)) return addTempCode(all);
                    let tmp = url.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!tmp.match(/&quot;/)) url = tmp;
                    else { if (url.match(/&quot;/g).length === 1) url = url.replace('&quot;', ''); }
                    return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + url.replace(/&quot;/g, '"') + '">' + text + '</a>');
                });
            } else {
                const lost = checkLostTags(textarea, /\[(?<tag>url)\]/i, /\[\/(?<tag>url)\]/i);
                if (lost.state) { return textarea.replace(/\[url\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[url\](.+?)\[\/url\]/i, function (s, x) {
                    if (x.match(/\s|\[/i)) return addTempCode(s);
                    return addTempCode('<a class="faqlink" rel="nofollow noopener noreferer" href="' + x + '">' + x + '</a>');
                });
            };
        };

        // 注释
        const rt = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[rt=.*?\]/i, function (s) { return addTempCode(s); }); }
            else if (!val) { return textarea.replace('[rt]', function (s) { return addTempCode(s); }) }
            else {
                const lost = checkLostTags(textarea, /\[(?<tag>rt)=[^\[]*?/i, /\[\/(?<tag>rt)\]/i);
                if (lost.state) { return textarea.replace(/\[rt=[^\[]*?/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[rt=(.+?)\](.*?)\[\/rt\]/i, function (all, tval, text) {
                    if (tval.match(/\[/i)) return addTempCode(all);
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!tmp.match(/&quot;/)) tval = tmp;
                    return addTempCode('<ruby>' + text + '<rp>(</rp><rt>' + tval + '</rt><rp>)</rp></ruby>');
                });
            };
        };

        // 字体
        const font = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[font=.*?]/i, function (s) { return addTempCode(s); }); }
            else if (!val) { return textarea.replace('[font]', function (s) { return addTempCode(s); }) }
            else {
                const lost = checkLostTags(textarea, /\[(?<tag>font)=[^\[]*?\]/i, /\[\/(?<tag>font)\]/i);
                if (lost.state) { return textarea.replace(/\[font=[^\[]*?/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[font=(.+?)\](.*?)\[\/font\]/i, function (all, tval, text) {
                    if (tval.match(/\[/i)) return '[' + addTempCode(`font=`) + `${tval}]${text}`;
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!/&quot;/.test(tmp)) { tval = tmp; }
                    else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                    return '<span style="font-family: ' + tval + '">' + text + '</span>';
                });
            };
        };

        // 颜色
        const color = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[color=.*?\]/i, function (s) { return addTempCode(s); }); }
            else if (!val) { return textarea.replace('[color]', function (s) { return addTempCode(s); }) }
            else {
                const lost = checkLostTags(textarea, /\[(?<tag>color)=[^\[]*?\]/i, /\[\/(?<tag>color)\]/i);
                if (lost.state) { return textarea.replace(/\[color=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[color=(.+?)\](.*?)\[\/color\]/i, function (all, tval, text) {
                    if (tval.match(/\[/i)) return addTempCode(all);;
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!/&quot;/.test(tmp)) { tval = tmp; }
                    else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                    return '<span style="color: ' + tval + '">' + text + '</span>';
                });
            };
        };

        // 文字大小
        const size = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[size=.*?\]/i, function (s) { return addTempCode(s); }); }
            else if (!val) { return textarea.replace('[size]', function (s) { return addTempCode(s); }) }
            else {
                const lost = checkLostTags(textarea, /\[(?<tag>size)=[^\[]*?\]/i, /\[\/(?<tag>size)\]/i);
                if (lost.state) { return textarea.replace(/\[size=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[size=(.+?)\](.*?)\[\/size\]/i, function (all, tval, text) {
                    // size只允许1-9的数字
                    if (!tval.match(/^(?:&quot;)?[0-9](?:&quot;)?$/)) return addTempCode(all);
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!/&quot;/.test(tmp)) { tval = tmp; }
                    else { if (tval.match(/&quot;/g).length === 1) tval = tval.replace('&quot;', ''); };
                    return '<font size="' + tval + '">' + text + '</font>';
                });
            };
        };

        const pre = (val, textarea) => {
            if (val) { return textarea.replace(/\[pre=(.*?)\]/i, function (s, v) { return addTempCode('[pre=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>pre)\]/i, /\[\/(?<tag>pre)\]/i);
            if (lost.state) { return textarea.replace(/\[pre\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[pre\](.*?)\[\/pre\]/i, function (all, text) { return '<pre>' + text + '</pre>'; });
        };

        const b = (val, textarea) => {
            if (val) { return textarea.replace(/\[b=(.*?)\]/i, function (s, v) { return addTempCode('[b=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>b)\]/i, /\[\/(?<tag>b)\]/i);
            if (lost.state) { return textarea.replace(/\[b\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[b\](.*?)\[\/b\]/i, function (all, text) { return '<b>' + text + '</b>'; });
        };

        const i = (val, textarea) => {
            if (val) { return textarea.replace(/\[i=(.*?)\]/i, function (s, v) { return addTempCode('[i=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>i)\]/i, /\[\/(?<tag>i)\]/i);
            if (lost.state) { return textarea.replace(/\[i\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[i\](.*?)\[\/i\]/i, function (all, text) { return '<em>' + text + '</em>'; });
        };

        const u = (val, textarea) => {
            if (val) { return textarea.replace(/\[u=(.*?)\]/i, function (s, v) { return addTempCode('[u=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>u)\]/i, /\[\/(?<tag>u)\]/i);
            if (lost.state) { return textarea.replace(/\[u\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[u\](.*?)\[\/u\]/i, function (all, text) { return '<u>' + text + '</u>'; });
        };

        const s = (val, textarea) => {
            if (val) { return textarea.replace(/\[s=(.*?)\]/i, function (s, v) { return addTempCode('[s=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>s)\]/i, /\[\/(?<tag>s)\]/i);
            if (lost.state) { return textarea.replace(/\[s\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[s\](.*?)\[\/s\]/i, function (all, text) { return '<s>' + text + '</s>'; });
        };

        const img = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[img=.*?\]/i, function (s) { return addTempCode(s); }); }
            else if (val) {
                return textarea.replace(/\[img=(.*?)\]/i, function (all, url) {
                    // [img=http://u2.dmhy.org/pic/logo.png]
                    url = url.replace('&amp;', '&');
                    if (/^((?!"|'|>|<|;|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                        // url 以 .png 之类结尾
                        return addTempCode('<img alt="image" src="' + url + '" style="height: auto; width: auto; max-width: 100%;">');
                    } else {
                        return addTempCode(all);
                    };
                });
            } else {
                // [img]http://u2.dmhy.org/pic/logo.png[/img]
                const lost = checkLostTags(textarea, /\[(?<tag>img)\]/i, /\[\/(?<tag>img)\]/i);
                if (lost.state) { return textarea.replace(/\[img\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[img\](.*?)\[\/img\]/i, function (all, url) {
                    url = url.replace('&amp;', '&');
                    if (/^((?!"|'|>|<|;|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                        // url 以 .png 之类结尾
                        return addTempCode('<img alt="image" src="' + url + '" style="height: auto; width: auto; max-width: 100%;">');
                    } else {
                        return addTempCode(all);
                    };
                });
            };
        };

        const imglnk = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { return textarea.replace(/\[imglnk=.*?\]/i, function (s) { return addTempCode(s); }); }
            else if (val) {
                return textarea.replace(/\[imglnk=(.*?)\]/i, function (all, url) { return addTempCode('[imglnk=') + url + ']'; });
            } else {
                // [img]http://u2.dmhy.org/pic/logo.png[/img]
                const lost = checkLostTags(textarea, /\[(?<tag>imglnk)\]/i, /\[\/(?<tag>imglnk)\]/i);
                if (lost.state) { return textarea.replace(/\[imglnk\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[imglnk\](.*?)\[\/imglnk\]/i, function (all, url) {
                    url = url.replace('&amp;', '&');
                    if (/^((?!"|'|>|<|;|\[|\]|#).)+\.(?:png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(url)) {
                        // url 以 .png 之类结尾
                        return addTempCode(`<a class="faqlink" rel="nofollow noopener noreferer" href="' + y + '"><img alt="image" src="${url}" style="height: auto; width: auto; max-width: 100%;"></a>`);
                    } else {
                        return addTempCode(all);
                    };
                });
            };
        };

        const code = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[code=(?:&quot;){0,2}/, '[code]'); };
            if (val) { textarea = textarea.replace(/\[code=(.*?)\]/i, function (s, v) { return addTempCode('[code=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>code)\]/i, /\[\/(?<tag>code)\]/i);
            if (lost.state) { return textarea.replace(/\[code\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[code\](.*?)\[\/code\]/i, function (all, text) {
                return addTempCode(`<br><div class="codetop">${lang['code']}</div><div class="codemain">${text.replace(/ &nbsp;/g, '  ')}</div><br />`);
            });
        };

        const info = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[info=(?:&quot;){0,2}/, '[info]'); };
            if (val) { textarea = textarea.replace(/\[info=(.*?)\]/i, function (s, v) { return addTempCode('[info=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>info)\]/i, /\[\/(?<tag>info)\]/i);
            if (lost.state) { return textarea.replace(/\[info\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[info\](.*?)\[\/info\]/i, function (all, text) {
                return addTempCode(`<fieldset class="pre"><legend><b><span style="color: blue">${lang['info']}</span></b></legend>${text.replace(/ &nbsp;/g, '  ')}</fieldset>`);
            });
        };

        const mediainfo = (val, textarea) => {
            if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') { textarea = textarea.replace(/\[mediainfo=(?:&quot;){0,2}/, '[mediainfo]'); };
            if (val) { textarea = textarea.replace(/\[mediainfo=(.*?)\]/i, function (s, v) { return addTempCode('[mediainfo=') + v + ']'; }); };
            const lost = checkLostTags(textarea, /\[(?<tag>mediainfo)\]/i, /\[\/(?<tag>mediainfo)\]/i);
            if (lost.state) { return textarea.replace(/\[mediainfo\]/i, function (s) { return addTempCode(s); }); };
            return textarea.replace(/\[mediainfo\](.*?)\[\/mediainfo\]/i, function (all, text) {
                return addTempCode(`<fieldset class="pre"><legend><b><span style="color: red">${lang['mediainfo']}</span></b></legend>${text.replace(/ &nbsp;/g, '  ')}</fieldset>`);
            });
        };

        const quote = (val, textarea) => {
            if (!val) {
                // [quote]我爱U2分享園@動漫花園。[/quote]
                const lost = checkLostTags(textarea, /\[(?<tag>quote)]/i, /\[\/(?<tag>quote)\]/i);
                if (lost.state) { return textarea.replace(/\[quote\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[quote\](.*?)\[\/quote\]/i, function (s, x) {
                    return '<fieldset><legend>' + lang['quote'] + '</legend>' + x.replace(/(<br>)*$/, '') + '</fieldset>';
                });
            } else if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') {
                // [quote=""]我爱U2分享園@動漫花園。[/quote]
                const lost = checkLostTags(textarea, /\[(?<tag>quote)=[^\[]*?\]/i, /\[\/(?<tag>quote)\]/i);
                if (lost.state) { return textarea.replace(/\[quote=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[quote=[^\[]*?\](.*?)\[\/quote\]/i, function (s, x) {
                    return '<fieldset><legend>' + lang['quote'] + '</legend>' + x.replace(/(<br>)*$/, '') + '</fieldset>';
                });
            } else {
                // [quote="ABC"]我爱U2分享園@動漫花園。[/quote]
                const lost = checkLostTags(textarea, /\[(?<tag>quote)=[^\[]*?\]/i, /\[\/(?<tag>quote)\]/i);
                if (lost.state) { return textarea.replace(/\[quote=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[quote=([^\[]*?)\](.*?)\[\/quote\]/i, function (all, tval, text) {
                    if (tval.match(/\[/i)) return addTempCode(all);;
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!/&quot;/.test(tmp)) { tval = tmp; };
                    return '<fieldset><legend>' + lang['quote'] + ': ' + tval + '</legend>' + text.replace(/(<br>)*$/, '') + '</fieldset>';
                });
            };
        };

        const spoiler = (val, textarea) => {
            if (!val) {
                // [spoiler]我要剧透了！[/spoiler]
                const lost = checkLostTags(textarea, /\[(?<tag>spoiler)]/i, /\[\/(?<tag>spoiler)\]/i);
                if (lost.state) { return textarea.replace(/\[spoiler\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[spoiler\](.*?)\[\/spoiler\]/i, function (s, x) {
                    return `<table class="spoiler" width="100%"><tbody><tr>`
                        + `<td class="colhead">${lang['spoiler']}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                        + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                        + `<tr><td><span class="spoiler-content" style="display: inline;">${x.replace(/(<br>)*$/, '')}</span></td></tr>`
                        + `</tbody></table>`;
                });
            }
            else if (val === '=' || val === '=&quot;' || val === '=&quot;&quot;') {
                // [spoiler=""]真的！[/spoiler]
                const lost = checkLostTags(textarea, /\[(?<tag>spoiler)=.+?\]/i, /\[\/(?<tag>spoiler)\]/i);
                if (lost.state) { return textarea.replace(/\[spoiler=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[spoiler=.*?\](.*?)\[\/spoiler\]/i, function (s, x) {
                    return `<table class="spoiler" width="100%"><tbody><tr>`
                        + `<td class="colhead">${lang['spoiler']}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                        + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                        + `<tr><td><span class="spoiler-content" style="display: inline;">${x.replace(/(<br>)*$/, '')}</span></td></tr>`
                        + `</tbody></table>`;
                });
            } else {
                // [spoiler="剧透是不可能的！"]真的！[/spoiler]
                const lost = checkLostTags(textarea, /\[(?<tag>spoiler)=.+?\]/i, /\[\/(?<tag>spoiler)\]/i);
                if (lost.state) { return textarea.replace(/\[spoiler=[^\[]*?\]/i, function (s) { return addTempCode(s); }); };
                return textarea.replace(/\[spoiler=(.*?)\](.*?)\[\/spoiler\]/i, function (all, tval, text) {
                    if (tval.match(/\[/i)) return addTempCode(all);;
                    let tmp = tval.replace(/^(?:&quot;)?(.*?)(?:&quot;)?$/, "$1");
                    if (!/&quot;/.test(tmp)) tval = tmp;
                    return `<table class="spoiler" width="100%"><tbody><tr>`
                        + `<td class="colhead">${tval}&nbsp;&nbsp;<button class="spoiler-button-show" style="display: none;">${lang['spoiler_button_1']}</button>`
                        + `<button class="spoiler-button-hide">${lang['spoiler_button_2']}</button></td></tr>`
                        + `<tr><td><span class="spoiler-content" style="display: inline;">${text.replace(/(<br>)*$/, '')}</span></td></tr>`
                        + `</tbody></table>`;
                });
            };
        };

        // 附件
        const attach = async (val, textarea) => {
            const lost = checkLostTags(textarea, /\[(?<tag>attach)\]/i, /\[\/(?<tag>attach)\]/i);
            if (lost.state) { return textarea.replace(/\[attach\]/i, function (s) { return addTempCode(s); }); };
            return await replaceAsync(textarea, /\[attach(?<tag>=[^\]]*?)?\](?<hash>.*?)\[\/attach\]/i, async (...args) => {
                const { tag, hash } = args.slice(-1)[0];
                if (tag) { return '[' + addTempCode(`attach`) + tag + `]${hash}[/attach]`; };
                if (/<br>/.test(hash)) { return addTempCode(`[attach]`) + hash + addTempCode('[/attach]'); };
                if (!hash) { console.log('内部为空'); return addTempCode(args[0]); }; // attach 标签内为空时
                if (!/^\w{32}$/.test(hash)) { return `<div style="text-decoration: line-through; font-size: 7pt">附件 ${hash} 无效。</div>`; }; // attach 标签内hash不符合要求

                return await attachmap_db.getItem(hash).then(async (value) => {
                    if (value !== null && value.attach_id) {
                        // console.log('数据已存在');
                        if (value.attach_type === 'img') {
                            if (Number.isFinite(value.attach_thumb)) {
                                if (value.attach_thumb === 0) {
                                    // console.log('没有触发缩图');
                                    return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}" onclick="Previewurl('${value.attach_url}')">`
                                } else if (value.attach_thumb === 1) {
                                    // console.log('触发缩图');
                                    return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}.thumb.jpg" onclick="Previewurl('${value.attach_url}')">`
                                };
                            };
                            // 正常情况是不会到这一步的，就不判断缩图状态了
                            return `<img id="attach${value.attach_id}" alt="${value.attach_name}" src="${value.attach_url}" onclick="Previewurl('${value.attach_url}')">`
                        } else if (value.attach_type === 'other') {
                            return '<div class="attach">'
                                + `<img alt="other" src="pic/attachicons/common.gif">&nbsp;&nbsp;`
                                + `<a href="${value.attach_url}" target="_blank" id="attach${value.attach_id}">${value.attach_name}</a>`
                                + '&nbsp;&nbsp;'
                                + `<span class="size">(${value.attach_size})</span>`
                                + '</div>'
                        } else if (value.attach_type === 'invalid') {
                            // 会不会发生碰撞呢 xd
                            return `<div style="text-decoration: line-through; font-size: 7pt">附件 ${args[1]} 无效。</div>`;
                        };
                    } else {
                        // console.log('数据不存在');
                        return await new Promise((resolve, reject) => {
                            jq.ajax({
                                type: 'post',
                                url: 'https://u2.dmhy.org/preview.php',
                                contentType: "application/x-www-form-urlencoded",
                                data: ({ "body": `[attach]${hash}[/attach]` }),
                                success: async function (d) {
                                    // console.log('成功');
                                    let htmlobj = document.createElement('div');
                                    htmlobj.innerHTML = d;
                                    let span = jq(htmlobj).find('span');
                                    let attach_normal = jq(span).children('bdo').children('div.attach'); // 普通附件
                                    let attach_image = jq(span).children('bdo').children('img'); // 图片附件
                                    if (attach_normal.length !== 0 && attach_image.length === 0) {
                                        // console.log('普通附件');
                                        let attach_info_obj = /(?<time>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i.exec(jq(attach_normal).children('a').attr('onmouseover'));
                                        const attach = {
                                            "attach_id": jq(attach_normal).children('a').attr('id').replace('attach', ''),
                                            "attach_type": 'other',
                                            "attach_url": jq(attach_normal).children('a').attr('href'),
                                            "attach_name": jq(attach_normal).children('a').text(),
                                            "attach_size": jq(attach_normal).children('span.size').text().slice(1, -1),
                                            "attach_time": attach_info_obj ? attach_info_obj.groups.time : ''
                                        };
                                        // 写入数据库
                                        await attachmap_db.setItem(hash, attach);
                                        resolve('<div class="attach">'
                                            + `<img alt="other" src="pic/attachicons/common.gif">&nbsp;&nbsp;`
                                            + `<a href="${attach.attach_url}" target="_blank" id="attach${attach.attach_id}">${attach.attach_name}</a>`
                                            + '&nbsp;&nbsp;'
                                            + `<span class="size">(${attach.attach_size})</span>`
                                            + '</div>');
                                    }
                                    else if (attach_normal.length === 0 && attach_image.length !== 0) {
                                        // console.log('图片附件');
                                        // 附件唯一标识符
                                        let attach_url_obj = /^Previewurl\(['"](?<url>[^'"]+)['"]\)/i.exec(jq(attach_image).attr('onclick'));
                                        let attach_info_obj = /(?<size>\d{1,4}\.\d{1,3}\s?[TGMK]iB).*(?<time>\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})/i.exec(jq(attach_image).attr('onmouseover'));
                                        let attach = {
                                            "attach_id": jq(attach_image).attr('id').replace('attach', ''),
                                            "attach_type": 'img',
                                            "attach_url": attach_url_obj ? attach_url_obj.groups.url : '',
                                            "attach_name": jq(attach_image).attr('alt'),
                                            "attach_size": attach_info_obj ? attach_info_obj.groups.size : '',
                                            "attach_time": attach_info_obj ? attach_info_obj.groups.time : '',
                                            "attach_thumb": ''
                                        };
                                        if (value && Number.isFinite(value.attach_thumb)) {
                                            if (value.attach_thumb === 0) {
                                                // console.log('没有触发缩图');
                                                attach.attach_thumb = 0;
                                                resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}" onclick="Previewurl('${attach.attach_url}')">`);
                                                await attachmap_db.setItem(hash, attach);
                                                return;
                                            } else if (value.attach_thumb === 1) {
                                                // console.log('触发缩图');
                                                attach.attach_thumb = 1;
                                                resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                                await attachmap_db.setItem(hash, attach);
                                                return;
                                            };
                                        };
                                        // 没有通过标准方法上传的图片，没有记录attach_thumb值
                                        let thumb = await urlCheck(`${attach.attach_url}.thumb.jpg`).catch(e => { });  // 检查缩图是否存在
                                        if (typeof (thumb) === "undefined") {
                                            // 发生了错误 不写数据库
                                            resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                            return;
                                        } else if (thumb === false) {
                                            // 不存在缩图
                                            // console.log('url检测 不存在缩图');
                                            attach.attach_thumb = 0;
                                            resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}" onclick="Previewurl('${attach.attach_url}')">`);
                                            await attachmap_db.setItem(hash, attach);
                                            return;
                                        } else if (thumb === true) {
                                            // 存在缩图
                                            // console.log('url检测 存在缩图');
                                            attach.attach_thumb = 1;
                                            resolve(`<img id="attach${attach.attach_id}" alt="${attach.attach_name}" src="${attach.attach_url}.thumb.jpg" onclick="Previewurl('${attach.attach_url}')">`);
                                            await attachmap_db.setItem(hash, attach);
                                            return;
                                        };
                                    }
                                    else {
                                        // Attachment for key 82505eca8a43a36bc9c60a7d9609a5df not found.
                                        // 附件 82505eca8a43a36bc9c60a7d9609a5df 无效。
                                        if (d.includes(hash)) {
                                            // console.log('附件无效')
                                            const attach = {
                                                "attach_id": '',
                                                "attach_type": 'invalid',
                                                "attach_url": '',
                                                "attach_name": '',
                                                "attach_size": '',
                                                "attach_time": getDateString()
                                            };
                                            await attachmap_db.setItem(hash, attach);
                                        } else { console.log('附件未知错误: ' + d); };
                                        resolve(`<div style="text-decoration: line-through; font-size: 7pt">附件 ${args[1]} 无效。</div>`);
                                    };
                                },
                                error: function (d) {
                                    // console.log('附件获取失败');
                                    reject(d.status);
                                },
                            });
                        }).catch(() => { return args[0]; });
                    };
                });
            });
        }

        const localConvert = async (textarea) => {
            let convert_count = 0;
            let index = 0;
            let _textarea = textarea;
            let bbcode_tag;
            while (bbcode_tag = /\[(?<tag>b|i|u|s|color|size|font|rt|mediainfo|info|code|url|img|imglnk|quote|pre|spoiler|attach)(?<val>=[^\[]*?)?\]/gi.exec(_textarea)) {
                let t;
                let tag = bbcode_tag.groups.tag;
                let val = bbcode_tag.groups.val;
                index = bbcode_tag.index;
                _textarea = _textarea.slice(index);

                switch (tag.toLowerCase()) {
                    case 'b':
                        t = b(val, _textarea); break;
                    case 'i':
                        t = i(val, _textarea); break;
                    case 'u':
                        t = u(val, _textarea); break;
                    case 's':
                        t = s(val, _textarea); break;
                    case 'color':
                        t = color(val, _textarea); break;
                    case 'size':
                        t = size(val, _textarea); break;
                    case 'font':
                        t = font(val, _textarea); break;
                    case 'rt':
                        t = rt(val, _textarea); break;
                    case 'mediainfo':
                        t = mediainfo(val, _textarea); break;
                    case 'info':
                        t = info(val, _textarea); break;
                    case 'code':
                        t = code(val, _textarea); break;
                    case 'url':
                        t = url(val, _textarea); break;
                    case 'img':
                        t = img(val, _textarea); break;
                    case 'imglnk':
                        t = imglnk(val, _textarea); break;
                    case 'quote':
                        t = quote(val, _textarea); break;
                    case 'pre':
                        t = pre(val, _textarea); break;
                    case 'spoiler':
                        t = spoiler(val, _textarea); break;
                    case 'attach':
                        t = await attach(val, _textarea); break;
                    default:
                        break;;
                };
                textarea = textarea.replace(_textarea, t);
                _textarea = t;
                if (++convert_count > 5000) break;

            };
            return textarea;
        };

        bbcodestr = await localConvert(bbcodestr);

        // 没有bbcode包裹的超链接
        bbcodestr = bbcodestr.replace(/((?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+)/gi, function (s, x) {
            return '<a class="faqlink" rel="nofollow noopener noreferer" href="' + s + '">' + s + '</a>';
        });

        // 单个标签 不带参
        const o_reg = new RegExp("\\[(\\*|siteurl|site)\\]", "gi");
        bbcodestr = bbcodestr.replace(o_reg, function (s, x, y) {
            switch (x) {
                case '*':
                    return '<img class="listicon listitem" src="pic/trans.gif" alt="list">';
                case 'site':
                    return 'U2分享園@動漫花園';
                case 'siteurl':
                    return 'https://u2.dmhy.org';
                default:
                    return s;
            };
        });

        // 表情
        const em_reg = new RegExp("\\[(em[1-9][0-9]*)\\]", "gi");
        bbcodestr = bbcodestr.replace(em_reg, function (s, x) {
            switch (x) {
                case (x.match(/^em[1-9][0-9]*/i) || {}).input:
                    return '<img src="pic/smilies/' + x.replace("em", "") + '.gif" alt="[' + x + ']">';
                default:
                    return s;
            };
        });


        for (let i = 0, len = tempCode.length; i < len; i++) {
            bbcodestr = bbcodestr.replace("<tempCode_" + i + ">", tempCode[i]);
        };

        bbcodestr = bbcodestr + br_end;
        if (/(<br>)$/.test(bbcodestr)) { bbcodestr = bbcodestr + '<br>' };

        // lost_tags
        if (lost_tags.length !== 0) {
            jq('#preview_bbcode').html(`⚠ ${lang['preview']}`);
            jq('#preview_bbcode').attr('title', [...new Set(lost_tags)].join('\n'))
        } else {
            jq('#preview_bbcode').html(lang['preview']);
            jq('#preview_bbcode').attr('title', '')
        };

        let htmlobj = document.createElement('div');
        htmlobj.innerHTML = bbcodestr;

        jq(htmlobj).children('fieldset').children('fieldset').children('fieldset').children('fieldset').each(function () {
            jq(this).html(jq(this).html().replace(/(^<legend>[^<]*?<\/legend>)(.*)/i, function (s, x, y) {
                return x + '<table class="spoiler" width="100%"><tbody>'
                    + '<tr><td class="colhead">' + lang['auto_fold'] + '&nbsp;&nbsp;'
                    + '<button class="spoiler-button-show" style="display: none;">' + lang['spoiler_button_1'] + '</button>'
                    + '<button class="spoiler-button-hide" style="">' + lang['spoiler_button_2'] + '</button>'
                    + '</td></tr><tr><td><span class="spoiler-content" style="display: inline;">'
                    + y + '</span></td></tr></tbody></table>';
            }));
        });

        return jq(htmlobj).html();
    };

    async function autoSaveUpload() {
        // 设置自动保存时间间隔
        let num_global = 8;
        let num = 5;

        jq('#bbcodejs_tbody').append(`<span id="upload_auto_save_on" style="margin-top:4px; display: none;">`
            + `<input id="upload_switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">`
            + `<input id="upload_clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">`
            + `<span id="upload_auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>`
            + `<span id="upload_auto_save_off" style="margin-top:4px; display: none;">`
            + `<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>`
        );

        // 为自动保存按钮绑定事件
        jq(`#upload_auto_save_on`).click(async function (ev) {
            let button_id = jq(ev.target).attr('id');
            switch (button_id) {
                case `upload_switch`:
                    jq(this).hide(); // 隐藏按钮
                    jq(`#upload_auto_save_off`).fadeIn(200); // 渐入按钮
                    clearInterval(jq(`#upload_auto_save_text`).attr('title')); // 清除setInterval函数
                    await db.setItem(`upload_autoSaveMessageSwitch`, false)
                    console.log(`upload-自动保存已关闭`);
                    break;
                case `upload_clean`:
                    if (window.confirm("确定清空所有数据?")) {
                        await clean();
                        window.location.reload();
                    };
                    break;
            };
        });

        jq(`#upload_auto_save_off`).click(async function () {
            jq(this).hide();
            jq(`#upload_auto_save_on`).fadeIn(200);
            jq(`#upload_auto_save_text`).attr("title", setInterval(autoSave, 1000));  // 设置setInterval函数
            await db.setItem(`upload_autoSaveMessageSwitch`, true)
            // console.log(`upload-自动保存已开启`);
        });

        /*         // 提交候选
                jq('#qr').click(async function () {
                    // clearInterval(jq(`#upload_auto_save_text`).attr('title')); // 关闭自动保存
                    // await clean();
                    console.log(`upload-提交上传请求`);
                });
         */
        async function clean() {
            clearInterval(jq(`#upload_auto_save_text`).attr('title')); // 清除setInterval函数
            await db.removeItem(`upload_autoSaveMessageTime`);
            await db.removeItem(`upload_autoSaveMessageBbcode`);
            await db.removeItem(`upload_autoSaveMessageSmallDescr`);
            await db.removeItem(`upload_autoSaveMessagePoster`);
            await db.removeItem(`upload_autoSaveMessageAnidbUrl`);
            await db.removeItem(`upload_autoSaveMessageInfo`);
            await db.removeItem(`upload_autoSaveMessageTorrentBlob`);
            await db.removeItem(`upload_autoSaveMessageTorrentName`);
            // console.log(`upload-已清空保存的记录`);
        }

        // 检测上次自动保存开关设定
        db.getItem(`upload_autoSaveMessageSwitch`).then(async (value) => {
            if (value) {
                // 启用自动保存
                jq(`#upload_auto_save_on`).show();
                jq(`#upload_auto_save_off`).hide();
                jq(`#upload_auto_save_text`).attr("title", setInterval(autoSave, 1000)); // 设置setInterval函数
                // console.log(`upload-自动保存已开启`);
                // 检查输入框内是否已经存在字符串
                let _input_bool = true
                jq("#compose input[id$='-input']").add('#browsecat').add('.bbcode').each(function () {
                    let _input = jq(this).val()
                    if (_input !== "" && _input !== "0") { _input_bool = false; return; } // 把input和select一起做判断了 总没人在标题里单独打个0吧
                });
                // 当输入框是空白时 还原上次备份内容
                if (_input_bool) {
                    await db.getItem(`upload_autoSaveMessageSmallDescr`).then((value) => { jq('[name="small_descr"]').val(value); })
                    await db.getItem(`upload_autoSaveMessagePoster`).then((value) => { jq('[name="poster"]').val(value); });
                    await db.getItem(`upload_autoSaveMessageAnidbUrl`).then((value) => { jq('[name="anidburl"]').val(value); });
                    await db.getItem(`upload_autoSaveMessageInfo`).then((value) => {
                        if (value === null) return;
                        jq('#browsecat').val(value['category']);
                        jq('#custom_title').val(value['custom_title']);
                        // jq('#browsecat').change(); // 手动触发列表更改事件 <使用两个jq后失效了 $('#browsecat').change(); 是有效的>
                        document.getElementById('browsecat').dispatchEvent(new Event('change')); // 手动触发列表更改事件
                        jq('#autocheck_placeholder').children().eq(0).prop("checked", value['auto_pass']);
                        jq('#autocheck_placeholder').children().eq(1).prop("checked", !value['auto_pass']);
                        for (const key in value) { if (/^(anime|manga|music|other)/.test(key)) { jq('#' + key + '-input').val(value[key]); }; };
                    });
                    await db.getItem(`upload_autoSaveMessageBbcode`).then((value) => { jq('.bbcode').val(value); }) // 还原bbcode输入框内容
                    await db.getItem(`upload_autoSaveMessageTorrentBlob`).then(async (blob) => {
                        if (!blob || blob.size <= 0) return;

                        const button = document.getElementById('torrent_create');
                        const torrentName = await db.getItem(`upload_autoSaveMessageTorrentName`);

                        if (!button.disabled) {
                            jq('#upload_chooser').text(`${torrentName}`);
                            jq('#upload_chooser').prop('title', '自动保存的种子文件');
                            jq('#qr').attr('disabled', false);  // 解除上传按钮锁定
                            jq('#torrent_download').attr('disabled', false);
                            jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止其余种子处理按钮
                            await pageTorrentInfo();
                            return;
                        };

                        // 执行上述代码时，sha1.js未加载完成
                        let observer = new MutationObserver(function (mutations) {
                            mutations.forEach(async function (mutation) {
                                if (mutation.attributeName === 'disabled') {
                                    let disabled = mutation.target.disabled;
                                    if (!disabled) {
                                        jq('#upload_chooser').text(`${torrentName}`);
                                        jq('#upload_chooser').prop('title', '自动保存的种子文件');
                                        jq('#qr').attr('disabled', false);  // 解除上传按钮锁定
                                        jq('#torrent_download').attr('disabled', false);
                                        jq('#upload_torrent,#upload_file,#upload_folder,#torrent_create').attr('disabled', true);  // 禁止其余种子处理按钮
                                        await pageTorrentInfo();
                                        observer.disconnect();
                                    }
                                }
                            });
                        });
                        const config = { attributes: true };
                        observer.observe(button, config);
                    });
                    jq('[class^="torrent-info-input"]').trigger("input"); // 手动触发标题更改
                    jq('.bbcode').trigger("input"); // 手动触发bbcode更改
                    // console.log(`upload-已还原备份`);
                };
            } else {
                // 关闭自动保存
                jq(`#upload_auto_save_on`).hide();
                jq(`#upload_auto_save_off`).show();
                await db.setItem(`upload_autoSaveMessageSwitch`, false)
                // console.log(`upload-自动保存已关闭`);
            }
        }).catch(async function (err) {
            // 第一次运行时 <第一次运行时 数据库里什么都没有>
            // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
            jq(`#upload_auto_save_on`).hide();
            jq(`#upload_auto_save_off`).show();
            await db.setItem(`upload_autoSaveMessageSwitch`, false)
            // console.log(`upload-第一次运行`);
            console.log(`upload-${err}`);
        });

        async function autoSave() {
            if (--num <= 0) {
                jq(`#upload_auto_save_text`).fadeIn(2000);
                await db.setItem(`upload_autoSaveMessageTime`, getDateString()); // 记录保存数据的时间 string
                await db.setItem(`upload_autoSaveMessageBbcode`, jq('.bbcode').val()); // 保存 bbcode 输入框内容
                // 倒是可以跑循环 直接拿到数据 就不用写这么大一堆了 (
                let upload_info = {
                    "category": jq('#browsecat').val(),
                    "auto_pass": jq('#autocheck_placeholder').children().eq(0).is(':checked'),
                    "anime_chinese": jq('#anime_chinese-input').val(),
                    "anime_english": jq('#anime_english-input').val(),
                    "anime_original": jq('#anime_original-input').val(),
                    "anime_source": jq('#anime_source-input').val(),
                    "anime_resolution": jq('#anime_resolution-input').val(),
                    "anime_episode": jq('#anime_episode-input').val(),
                    "anime_container": jq('#anime_container-input').val(),
                    "anime_extra": jq('#anime_extra-input').val(),
                    "manga_title": jq('#manga_title-input').val(),
                    "manga_author": jq('#manga_author-input').val(),
                    "manga_volume": jq('#manga_volume-input').val(),
                    "manga_ended": jq('#manga_ended-input').val(),
                    "manga_publisher": jq('#manga_publisher-input').val(),
                    "manga_remark": jq('#manga_remark-input').val(),
                    "music_prefix": jq('#music_prefix-input').val(),
                    "music_collection": jq('#music_collection-input').val(),
                    "music_date": jq('#music_date-input').val(),
                    "music_category": jq('#music_category-input').val(),
                    "music_artist": jq('#music_artist-input').val(),
                    "music_title": jq('#music_title-input').val(),
                    "music_serial_number": jq('#music_serial_number-input').val(),
                    "music_quantity": jq('#music_quantity-input').val(),
                    "music_quality": jq('#music_quality-input').val(),
                    "music_format": jq('#music_format-input').val(),
                    "other_title": jq('#other_title-input').val(),
                    "custom_title": jq('#custom_title').val()
                };
                await db.setItem(`upload_autoSaveMessageInfo`, upload_info);
                await db.setItem(`upload_autoSaveMessageSmallDescr`, jq('[name="small_descr"]').val());
                await db.setItem(`upload_autoSaveMessagePoster`, jq('[name="poster"]').val());
                await db.setItem(`upload_autoSaveMessageAnidbUrl`, jq('[name="anidburl"]').val());
                num = num_global; // 重置倒计时
                jq(`#upload_auto_save_text`).fadeOut(2000);
            };
        }
    };


    // elementButton 插入按钮的位置
    // elementBbcode BBCODE输入框
    // elementPost 提交按钮
    // type 识别符
    // parent 父级元素
    async function autoSaveMessage(elementButton, elementBbcode, elementPost, type, parent) {
        let num_global = 8; // 设置自动保存时间间隔
        let num = 5; // 设置自动保存时间间隔

        jq(elementButton).append(`<span id="${type}_auto_save_on" style="margin-top:4px; display: none;">`
            + `<input id="${type}_switch" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已开启">`
            + `<input id="${type}_clean" class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="清空数据">`
            + `<span id="${type}_auto_save_text" style="display: none;">&nbsp;&nbsp;正在保存...</span></span>`
            + `<span id="${type}_auto_save_off" style="margin-top:4px; display: none;">`
            + `<input class="codebuttons" style="font-size:11px;margin-right:3px;" type="button" value="自动保存已关闭"></span>`
        );

        // 为自动保存按钮绑定事件
        jq(`#${type}_auto_save_on`).click(async function (ev) {  // 关闭自动保存
            let button_id = jq(ev.target).attr('id');
            switch (button_id) {
                case `${type}_switch`:
                    jq(this).hide(); // 隐藏按钮
                    jq(`#${type}_auto_save_off`).fadeIn(200); // 渐入按钮
                    clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
                    await db.setItem(`${type}_autoSaveMessageSwitch`, false)
                    // console.log(`${type}-自动保存已关闭`);
                    break;
                case `${type}_clean`:
                    if (window.confirm("确定清空所有数据?")) {
                        await clean();
                        window.location.reload();
                    };
                    break;
            };
        });

        jq(`#${type}_auto_save_off`).click(async function () {  // 开启自动保存
            jq(this).hide(); // 隐藏按钮
            jq(`#${type}_auto_save_on`).fadeIn(200);
            jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000));  // 设置setInterval函数
            await db.setItem(`${type}_autoSaveMessageSwitch`, true)
            // console.log(`${type}-自动保存已开启`);
        });

        // 提交候选后 删除所有保存的记录 (如果要还原记录，直接返回上一页即可。)
        jq(elementPost).click(async function () {
            await clean();
            // console.log(`${type}-提交上传请求`);
        });

        async function clean() {
            clearInterval(jq(`#${type}_auto_save_text`).attr('title')); // 清除setInterval函数
            await db.removeItem(`${type}_autoSaveMessageTime`);
            await db.removeItem(`${type}_autoSaveMessageBbcode`);
            await db.removeItem(`${type}_autoSaveMessageSubject`);
            // console.log(`${type}-已清空保存的记录`);
        };

        // 检测上次自动保存开关设定
        await db.getItem(`${type}_autoSaveMessageSwitch`).then(async (value) => {
            if (value) {
                // 启用自动保存
                jq(`#${type}_auto_save_on`).show();
                jq(`#${type}_auto_save_off`).hide();
                jq(`#${type}_auto_save_text`).attr("title", setInterval(autoSave, 1000)); // 设置setInterval函数
                // console.log(`${type}-自动保存已开启`);
                // 检查输入框内是否已经存在字符串
                let _input_bool = true
                jq(`${parent} input[name='subject']`).add(elementBbcode).each(function () {
                    let _input = jq(this).val()
                    if (_input !== "") { _input_bool = false; return; }
                });
                // 当输入框是空白时 还原上次备份内容
                if (_input_bool) {
                    await db.getItem(`${type}_autoSaveMessageSubject`).then((value) => { jq(`${parent} input[name='subject']`).val(value); });
                    await await db.getItem(`${type}_autoSaveMessageBbcode`).then((value) => { jq(elementBbcode).val(value); }) // 还原bbcode输入框内容
                    jq(elementBbcode).trigger("input"); // 手动触发bbcode更改
                    // console.log(`${type}-已还原备份`);
                };
            } else {
                // 关闭自动保存
                jq(`#${type}_auto_save_on`).hide();
                jq(`#${type}_auto_save_off`).show();
                await db.setItem(`${type}_autoSaveMessageSwitch`, false);
            };
        }).catch(async function (err) {
            // 第一次运行时 <第一次运行时 数据库里什么都没有>
            // 这段其实也没什么用 数据库中如果没有这个键值 会返回 undefined
            jq(`#${type}_auto_save_on`).hide();
            jq(`#${type}_auto_save_off`).show();
            await db.setItem(`${type}_autoSaveMessageSwitch`, false);
            // console.log(`${type}-第一次运行`);
            console.log(`${type}-${err}`);
        });

        async function autoSave() {
            if (--num <= 0) {
                jq(`#${type}_auto_save_text`).fadeIn(2000);
                await db.setItem(`${type}_autoSaveMessageTime`, getDateString()) // 记录保存数据的时间 string
                await db.setItem(`${type}_autoSaveMessageBbcode`, jq(elementBbcode).val()) // 保存 bbcode 输入框内容
                await db.setItem(`${type}_autoSaveMessageSubject`, jq(`${parent} input[name='subject']`).val());
                num = num_global; // 重置倒计时
                jq(`#${type}_auto_save_text`).fadeOut(2000);
            };
        };
    };

    // 输入框与预览框同步滚动
    // element 按钮插入位置
    // type 标识符
    // bbcode 输入框位置
    // preview 预览位置
    async function syncScroll(element, type, bbcode, preview) {
        // console.log('启用bbcodejs数据库');
        jq(element).append(`<input id="${type}_sync_scroll_on" class="codebuttons" style="font-size:11px; margin-right:3px;; display: none;" type="button" value="同步滚动已开启"></input>`
            + `<input id="${type}_sync_scroll_off" class="codebuttons" style="font-size: 11px; margin-right:3px; display: none;" type="button" value="同步滚动已关闭"></input>`
        );

        await db.getItem(`${type}_syncScrollSwitch`).then(async (value) => {
            if (value) {
                jq(`#${type}_sync_scroll_on`).show();
                new onScroll();
                // console.log(`${type}-同步滚动已打开`);
            } else {
                jq(`#${type}_sync_scroll_off`).show();
                // console.log(`${type}-同步滚动已关闭`);
            };
        });

        // 为按钮绑定事件
        jq(`#${type}_sync_scroll_off`).click(async function () {
            jq(this).hide();
            jq(`#${type}_sync_scroll_on`).fadeIn(200); // 渐入按钮
            await db.setItem(`${type}_syncScrollSwitch`, true);
            new onScroll();
            // console.log(`${type}-同步滚动已打开`);
        });

        jq(`#${type}_sync_scroll_on`).click(async function () {
            jq(this).hide();
            jq(`#${type}_sync_scroll_off`).fadeIn(200); // 渐入按钮
            await db.setItem(`${type}_syncScrollSwitch`, false);
            new offScroll();
            // console.log(`${type}-同步滚动已关闭`);
        });

        // 绑定鼠标事件
        function onScroll() {
            let currentTab = 0;
            jq(bbcode).mouseover(() => { currentTab = 1; });
            jq(preview).mouseover(() => { currentTab = 2; });

            jq(bbcode).scroll(() => {
                if (currentTab !== 1) return;
                let scale = (jq(preview).children('.child').get(0).offsetHeight - jq(preview).get(0).offsetHeight) / (jq(bbcode).get(0).scrollHeight - jq(bbcode).get(0).offsetHeight);
                jq(preview).scrollTop(jq(bbcode).scrollTop() * scale);
            });

            jq(preview).scroll(() => {
                if (currentTab !== 2) return;
                let scale = (jq(preview).children('.child').get(0).offsetHeight - jq(preview).get(0).offsetHeight) / (jq(bbcode).get(0).scrollHeight - jq(bbcode).get(0).offsetHeight);
                jq(bbcode).scrollTop(jq(preview).scrollTop() / scale);
            });
        };

        // 解除鼠标事件
        function offScroll() {
            jq(bbcode).off("scroll").off("mouseover");
            jq(preview).off("scroll").off("mouseover");
        };
    };

    // 为bbcode加上[]
    function createTagBox(name, attribute, content) {
        let components = [];
        components.push('[');
        components.push(name);
        if (attribute !== null) {
            components.push('=');
            components.push(attribute);
        }
        components.push(']');
        if (content !== null) {
            components.push(content);
            components.push('[/');
            components.push(name);
            components.push(']');
        }
        return components.join('');
    };

    function replaceTextBox(str, start, end, replacement) {
        return str.substring(0, start) + replacement + str.substring(end);
    };


    /**
     * 将标签添加到 textArea 元素。
     * @param {HTMLTextAreaElement} textArea - 要修改的 textArea 元素
     * @param {String} name - 标签的名称
     * @param {String} attribute - 标签的属性。 可以为空
     * @param {String} content - 标签的内容。 如果此参数为空，标签将是一个自闭合标签（如 [hr]）
     * @param {Boolean} surround - 指定是否用标签包围选择，或者只是替换选择。 如果有选择且此参数为真，内容被忽略
     * @returns {String} - 构造的 BBCode 标签
     */
    function addTagBox(textArea, name, attribute, content, surround) {
        let selStart = textArea.selectionStart;
        let selEnd = textArea.selectionEnd;
        if (selStart === null || selEnd === null) {
            selStart = selEnd = textArea.value.length;
        }
        let selTarget = selStart + name.length + 2 + (attribute ? attribute.length + 1 : 0);
        if (selStart === selEnd) {
            textArea.value = replaceTextBox(textArea.value, selStart, selEnd, createTagBox(name, attribute, content));
        } else {
            let replacement = null;
            if (surround) {
                replacement = createTagBox(name, attribute, textArea.value.substring(selStart, selEnd));
            } else {
                replacement = createTagBox(name, attribute, content);
            }
            textArea.value = replaceTextBox(textArea.value, selStart, selEnd, replacement);
        }
        textArea.setSelectionRange(selTarget, selTarget);
    };

    /**
     * 将文本添加到 textArea 元素。
     * @param {HTMLTextAreaElement} textArea - 要修改的 textArea 元素
     * @param {String} content - 文本内容
     * @returns {String} - 构造的 BBCode 标签
     */
    function addTextBox(textArea, content) {
        let selStart = textArea.selectionStart;
        let selEnd = textArea.selectionEnd;
        if (selStart === null || selEnd === null) { selStart = selEnd = textArea.value.length; };
        let selTarget = selStart + (content ? content.length : 0);  // 计算插入文本后光标的位置
        textArea.value = replaceTextBox(textArea.value, selStart, selEnd, content);
        textArea.setSelectionRange(selTarget, selTarget);  // 设置光标位置
    };

    function onEditorActionBox(action, element, param) {
        let textArea = document.querySelector(element);
        let selStart = textArea.selectionStart;
        let selEnd = textArea.selectionEnd;
        let selectionText, url;
        if (selStart === null || selEnd === null) {
            selStart = selEnd = textArea.value.length;
        };
        switch (action) {
            case 'B': {
                addTagBox(textArea, 'b', null, '', true);
                break;
            }
            case 'I': {
                addTagBox(textArea, 'i', null, '', true);
                break;
            }
            case 'U': {
                addTagBox(textArea, 'u', null, '', true);
                break;
            }
            case 'URL': {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, 'url', selectionText, selectionText, false);
                } else {
                    url = window.prompt("请输入链接URL：");
                    if (url === null || url.length === 0) {
                        break;
                    }
                    var title = window.prompt("请输入链接标题（可选）：");
                    if (title === null || title.length === 0) {
                        title = url;
                    }
                    addTagBox(textArea, 'url', url, title, false);
                }
                break;
            }
            case 'IMG': {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, 'img', null, selectionText, false);
                } else {
                    url = window.prompt("请输入图片的完整路径：");
                    // url = window.prompt(EDITOR_LANG.image);
                    if (url === null) {
                        break;
                    }
                    var urlLower = url.toLowerCase();
                    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
                        // window.alert(EDITOR_LANG['invalid_image']);
                        window.alert("图片URL必须以http://或https://开头。");
                        break;
                    }
                    addTagBox(textArea, 'img', null, url, false);
                }
                break;
            }
            case 'IMGINK': {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, 'imgink', null, selectionText, false);
                } else {
                    url = window.prompt("请输入图片的完整路径：");
                    // url = window.prompt(EDITOR_LANG.image);
                    if (url === null) {
                        break;
                    }
                    var urlLower = url.toLowerCase();
                    if (!urlLower.startsWith('http://') && !urlLower.startsWith('https://')) {
                        // window.alert(EDITOR_LANG['invalid_image']);
                        window.alert("图片URL必须以http://或https://开头。");
                        break;
                    }
                    addTagBox(textArea, 'imgink', null, url, false);
                }
                break;
            }
            case 'QUOTE': {
                addTagBox(textArea, 'quote', null, '', true);
                break;
            }
            case 'COLOR': {
                if (param !== "") {
                    addTagBox(textArea, 'color', param, '', true);
                }
                break;
            }
            case 'FONT': {
                if (param !== "") {
                    addTagBox(textArea, 'font', param, '', true);
                }
                break;
            }
            case 'SIZE': {
                if (param !== "") {
                    addTagBox(textArea, 'size', param, '', true);
                }
                break;
            }
            // 自定义
            case "S": {
                addTagBox(textArea, "s", null, "", true);
                break;
            }
            case "INFO": {
                addTagBox(textArea, "info", null, "", true);
                break;
            }
            case "MEDIAINFO": {
                addTagBox(textArea, "mediainfo", null, "", true);
                break;
            }
            case "PRE": {
                addTagBox(textArea, "pre", null, "", true);
                break;
            }
            case "CODE": {
                addTagBox(textArea, "code", null, "", true);
                break;
            }
            case "RT*": {
                if (selStart !== selEnd) {
                    let title = window.prompt(lang['rt_text']);
                    if (title === null || title.length === 0) {
                        break;
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    addTagBox(textArea, "rt", title, selectionText, false);
                    // break;
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    let title = window.prompt(lang['rt_text']);
                    if (title === null || title.length === 0) {
                        break;
                    }
                    addTagBox(textArea, "rt", title, text, false);
                }
                break;
            }
            case "QUOTE*": {
                if (selStart !== selEnd) {
                    let title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    // addTag(textArea, "quote", null, "", true);
                    addTagBox(textArea, "quote", title, selectionText, false);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    let title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                    }
                    addTagBox(textArea, "quote", title, text, false);
                }
                break;
            }
            case "URL*": {
                if (selStart !== selEnd) {
                    selectionText = textArea.value.substring(selStart, selEnd); // 选中的文字
                    if (/^(?:https?|ftp|gopher|news|telnet|mms|rtsp):\/\/((?!&lt;|&gt;|\s|"|>|'|<|\(|\)|\[|\]).)+/gi.test(selectionText)) {
                        // 选中的是URL时
                        let title = window.prompt(lang['url_name']);
                        if (title === null || title.length === 0) {
                            // selectionText = textArea.value.substring(selStart, selEnd);
                            addTag(textArea, "url", null, "", true);
                            break;
                        } else {
                            addTagBox(textArea, "url", selectionText, title, false);
                        };
                    } else {
                        // 选中的是文字时
                        let url_link = window.prompt(lang['url_link']);
                        if (url_link === null || url_link.length === 0) {
                            // selectionText = textArea.value.substring(selStart, selEnd);
                            // addTag(textArea, "url", null, "", true);
                            break;
                        } else {
                            addTagBox(textArea, "url", url_link, selectionText, false);
                        };
                    };
                } else {
                    let text = window.prompt(lang['url_link']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    let title = window.prompt(lang['url_name']);
                    if (title === null || title.length === 0) {
                        title = "";
                        addTagBox(textArea, "url", null, text, false);
                        break;
                    }
                    addTagBox(textArea, "url", text, title, false);
                }
                break;
            }
            case "SPOILER*": {
                if (selStart !== selEnd) {
                    let title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        addTagBox(textArea, "spoiler", null, "", true);
                        break;
                    }
                    selectionText = textArea.value.substring(selStart, selEnd);
                    // addTag(textArea, "spoiler", null, "", true);
                    addTagBox(textArea, "spoiler", title, selectionText, false);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    }
                    let title = window.prompt(lang['main_body_prefix']);
                    if (title === null || title.length === 0) {
                        title = "";
                        addTagBox(textArea, "spoiler", null, text, false);
                        break;
                    }
                    addTagBox(textArea, "spoiler", title, text, false);
                }
                break;
            }
            case "SPOILER": {
                addTagBox(textArea, "spoiler", null, "", true);
                break;
            }
            case "QUOTE": {
                if (selStart !== selEnd) {
                    addTagBox(textArea, "quote", null, "", true);
                } else {
                    let text = window.prompt(lang['main_body']);
                    if (text === null || text.length === 0) {
                        break;
                    };
                    addTagBox(textArea, "quote", null, text, false);
                }
                break;
            };
            case "URL": {
                if (selStart !== selEnd) {
                    addTagBox(textArea, "url", null, "", true);
                } else {
                    let text = window.prompt(lang['url_link']);
                    if (text === null || text.length === 0) {
                        break;
                    };
                    addTagBox(textArea, "url", null, text, false);
                }
                break;
            };
            case "LIST": {
                if (selStart !== selEnd) {
                    break;
                };
                addTagBox(textArea, "*", null, null, true);
                break;
            };
            case (action.match(/^javascript:void\('em\d+'\);$/i) || {}).input: {
                addTagBox(textArea, action.slice(17, -3), null, null, true);
                break;
            };

        }
        textArea.focus();
    };


    async function basicFrame(title, type) {
        let basic_html = `
<tr>
    <td id="${type}_outer" align="center" class="outer" style="padding-top: 20px; padding-bottom: 20px; display: none;">
        <table class="main" width="940" border="0" cellspacing="0" cellpadding="0">
            <tbody>
                <tr>
                    <td class="embedded">
                        <form id="${type}_compose_custom" method="post" name="${type}_compose_custom">
                            <h2 class="${type}_h2_move" id="${type}_move_part" align="left">${title}</h2>
                            <table width="100%" border="1" cellspacing="0" cellpadding="10">
                                <tbody>
                                    <tr>
                                    <td class="text" align="center">
                                        <table class="main" width="100%" border="1" cellspacing="0" cellpadding="5">
                                        <tbody>
                                            <tr>
                                            <td class="rowhead" valign="top">正文</td>
                                            <td class="rowfollow" align="left">
                                                <div id="${type}_editorouterbox" style="display: block;">
                                                <table width="100%" cellspacing="0" cellpadding="5" border="0">
                                                    <tbody>
                                                    <tr>
                                                        <td align="left" colspan="2">
                                                        <table id="${type}_bbcode_button" cellspacing="1" cellpadding="2" border="0">
                                                            <tbody>
                                                            <tr>
                                                            </tr>
                                                            </tbody>
                                                        </table>
                                                        <div id="${type}_bbcodejs_tbody_box" style="position:relative; margin-top: 4px">
                                                            <div id="${type}_bbcodejs_select_box" style="position: absolute; margin-top: 2px; margin-bottom: 2px; float: left;">
                                                            <select class="med codebuttons" name="${type}_bbcode_color" style="margin-right: 3px; visibility: visible;">
                                                                <option value="">--- 颜色 ---</option>
                                                            </select>
                                                            <select class="med codebuttons" name="${type}_bbcode_font" style="visibility: visible;">
                                                                <option value="">--- 字体 ---</option>
                                                            </select>
                                                            <select class="med codebuttons" name="${type}_bbcode_size" style="visibility: visible;">
                                                                <option value="">--- 字号 ---</option>
                                                            </select>
                                                            </div>
                                                        </div>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td colspan="2" valign="middle">
                                                        <iframe src="attachment.php?text_area_id=${type}_box_bbcode" width="100%" height="24" frameborder="0" scrolling="no" marginheight="0" marginwidth="0">
                                                        </iframe>
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td align="left">
                                                        <textarea class="${type}_box_bbcode" cols="100" style="width: 99%" id="${type}_box_bbcode" rows="20"></textarea>
                                                        </td>
                                                        <td align="center" width="150">
                                                        <table id="${type}_smile-icon" cellspacing="1" cellpadding="3">
                                                            <tbody>
                                                            </tbody>
                                                        </table>
                                                        <br>
                                                        <a onclick="ShowSmileWindow(&quot;${type}_compose_custom&quot;, &quot;${type}_box_bbcode&quot;)">更多表情</a>
                                                        </td>
                                                    </tr>
                                                    </tbody>
                                                </table>
                                                </div>
                                            </td>
                                            </tr>
                                            <tr>
                                            <td colspan="2" align="center">
                                                <table>
                                                <tbody>
                                                    <tr>
                                                    <td class="embedded">
                                                        <input id="${type}_post_box" type="button" class="btn" value="发送">
                                                    </td>
                                                    <td class="embedded">
                                                        <input id="${type}_close_box" type="button" class="btn" value="关闭">
                                                    </td>
                                                    </tr>
                                                </tbody>
                                                </table>
                                            </td>
                                            </tr>
                                        </tbody>
                                        </table>
                                    </td>
                                    </tr>
                                </tbody>
                            </table>
                        </form>
                    </td>
                </tr>
            </tbody>
        </table>
    </td>
</tr>`

        const parse_html = document.createElement('table');
        parse_html.innerHTML = basic_html;

        const bbcode_button = [
            { "style": "font-weight: bold;font-size:11px; margin-right:3px", "value": "B" },
            { "style": "font-style: italic;font-size:11px;margin-right:3px", "value": "I" },
            { "style": "text-decoration: underline;font-size:11px;margin-right:3px", "value": "U" },
            { "style": "text-decoration: line-through;font-size:11px;margin-right:3px", "value": "S" },
            // { "style": "font-size:11px;margin-right:3px", "value": "URL" },
            { "style": "font-size:11px;margin-right:3px", "value": "URL*" },
            { "style": "font-size:11px;margin-right:3px", "value": "IMG" },
            { "style": "font-size:11px;margin-right:3px", "value": "IMGINK" },
            { "style": "font-size:11px;margin-right:3px", "value": "RT*" },
            { "style": "font-size:11px;margin-right:3px", "value": "LIST" },
            { "style": "font-size:11px;margin-right:3px", "value": "PRE" },
            { "style": "font-size:11px;margin-right:3px", "value": "CODE" },
            { "style": "font-size:11px;margin-right:3px", "value": "QUOTE" },
            { "style": "font-size:11px;margin-right:3px", "value": "QUOTE*" },
            { "style": "font-size:11px;margin-right:3px", "value": "INFO" },
            { "style": "font-size:11px;margin-right:3px", "value": "MEDIAINFO" },
            { "style": "font-size:11px;margin-right:3px", "value": "SPOILER" },
            { "style": "font-size:11px;margin-right:3px", "value": "SPOILER*" }
        ];
        const smile_list = [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 13, 16, 17, 19, 20, 21, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 192, 198];
        const font_list = ['Arial', 'Arial Black', 'Arial Narrow', 'Book Antiqua', 'Century Gothic', 'Comic Sans MS', 'Courier New',
            'Fixedsys', 'Garamond', 'Georgia', 'Impact', 'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
            'Palatino Linotype', 'System', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
        const color_list = ["Black", "Sienna", "Dark Olive Green", "Dark Green", "Dark Slate Blue", "Navy", "Indigo",
            "Dark Slate Gray", "Dark Red", "Dark Orange", "Olive", "Green", "Teal", "Blue", "Slate Gray", "Dim Gray",
            "Red", "Sandy Brown", "Yellow Green", "Sea Green", "Medium Turquoise", "Royal Blue", "Purple", "Gray",
            "Magenta", "Orange", "Yellow", "Lime", "Cyan", "Deep Sky Blue", "Dark Orchid", "Silver", "Pink",
            "Wheat", "Lemon Chiffon", "Pale Green", "Pale Turquoise", "Light Blue", "Plum", "White"];
        // 插入表情
        smile_list.forEach(function (item, index) {
            if (Number.isInteger((index + 4) / 4)) jq(parse_html).find(`#${type}_smile-icon`).children('tbody').append(`<tr></tr>`);
            jq(parse_html).find(`#${type}_smile-icon`).find('tr:last').append(`<td class="embedded smile-icon"><a href="javascript:void('em${item}');" name="${type}_bbcode_smile"><img style="max-width: 25px;" src="pic/smilies/${item}.gif" alt=""></a></td>`);
        });
        // 插入字体大小菜单
        [1, 2, 3, 4, 5, 6, 7].forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_size"]`).append(`<option value="${item}">${item}</option>`); })
        // 插入字体菜单
        font_list.forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_font"]`).append(`<option value="${item}">${item}</option>`); });
        // 插入颜色菜单
        color_list.forEach(function (item) { jq(parse_html).find(`[name="${type}_bbcode_color"]`).append(`<option style="background-color: ${item.replace(/\s/g, '').toLowerCase()}" value="${item.replace(/\s/g, '')}">${item}</option>`); });
        // 插入按钮
        bbcode_button.forEach(function (item) {
            jq(parse_html).find(`#${type}_bbcode_button`).find('tr:last').append(`<td class="embedded"><input class="codebuttons" style="${item.style}" type="button" value="${item.value}" name="${type}_bbcode_button"></td>`);
        });
        // 插入预览框
        jq(parse_html).find(`#${type}_box_bbcode`).parents("tr:eq(1)").after(`<tr><td class="rowhead nowrap" valign="top" style="padding: 3px" align="right">${lang['preview']}</td><td class="rowfollow"><table width="100%" cellspacing="0" cellpadding="5" border="0" ><tbody><tr><td  align="left" colspan="2"><div id="${type}_bbcode2_box" style="min-height: 25px; max-height: 1px; overflow-x: auto ; overflow-y: auto; white-space: pre-wrap;"><div class="child"></div></div></td></tr></tbody></table></td>`);
        return jq(parse_html).html().replace(/^<tbody>([\s\S]*)<\/tbody>$/gm, '$1');
    };


    /**
    * 同步窗口大小变化
    */
    // https://developer.mozilla.org/zh-CN/docs/Web/API/MutationObserver
    function syncWindowChange(input, preview) {
        let MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
        let element = document.querySelector(input);
        var height_now, height_last;
        var observer = new MutationObserver((mutations) => {
            mutations.forEach(function (mutation) {
                if (mutation.type == "attributes") {
                    height_now = Number(mutation.target.style.height.replace('px', '')) + 30;
                    if (height_last === height_now) { return } else { height_last = height_now; };
                    jq(preview).css("max-height", height_now + "px");
                };
            })
        });
        observer.observe(element, {
            attributes: true,
            attributeFilter: ['style']
        });
    };


    /**
    * 监听用户动作
    * @param {string} type - BBCODE窗口类型
    */
    async function btnListener(type) {
        // 下拉菜单监听
        jq(`[name="${type}_bbcode_color"]`).change(function () { onEditorActionBox('COLOR', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
        jq(`[name="${type}_bbcode_font"]`).change(function () { onEditorActionBox('FONT', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
        jq(`[name="${type}_bbcode_size"]`).change(function () { onEditorActionBox('SIZE', `#${type}_box_bbcode`, this.options[this.selectedIndex].value); this.selectedIndex = 0; });
        // 按钮监听
        jq(`[name="${type}_bbcode_button"]`).click(function () { onEditorActionBox(this.value, `#${type}_box_bbcode`); });
        // 输入框右边表情，鼠标悬浮图标变大
        jq(`[name="${type}_bbcode_smile"]`).mouseenter(function () { jq(this).children('img').css({ "transform": "scale(1.35)", "transition": "all 0.3s" }); });
        // 输入框右边表情，鼠标离开图标恢复原状
        jq(`[name="${type}_bbcode_smile"]`).mouseleave(function () { jq(this).children('img').css({ "transform": "" }); });
        // 输入框右边表情，点击图标输入表情
        jq(`[name="${type}_bbcode_smile"]`).click(function () { onEditorActionBox(jq(this).attr('href'), `#${type}_box_bbcode`); });
        // 监听各种按钮的点击事件
        jq(`[name="${type}_bbcode_color"],[name="${type}_bbcode_font"],[name="${type}_bbcode_size"],[name="${type}_bbcode_button"],[name="${type}_bbcode_smile"],td.embedded.${type}_smile-icon a`).click(async function () { jq(`#${type}_bbcode2_box`).children('.child').html(await bbcode2html(jq(`#${type}_box_bbcode`).val())); });
        // 监听bbcode写入事件
        jq(`#${type}_box_bbcode`).bind('input propertychange', async function () { jq(`#${type}_bbcode2_box`).children('.child').html(await bbcode2html(jq(this).val())); });

    };

    // attach 标签转 img 标签
    const attach2Img = async (emid, dom) => {
        let cbbcode = jq(`#${emid}`, dom).val();
        cbbcode = await replaceAsync(cbbcode, /\[attach\](?<hash>\w{32})\[\/attach\]/gi, async (...args) => {
            const { hash } = args.slice(-1)[0];
            return await attachmap_db.getItem(hash).then(async (value) => {
                if (value !== null) if (value.attach_type === 'img') return `[img]${value.attach_url.startsWith('https://u2.dmhy.org/') ? value.attach_url : 'https://u2.dmhy.org/' + value.attach_url}[/img]`;
                // 没有匹配到数据时，直接返回原标签
                return args[0];
            });
        });
        // console.log(cbbcode);
        jq(`#${emid}`, dom).val(cbbcode);
        // 手动触发bbcode内容更改
        // jq(`#${emid}`, window.parent.document).trigger("input");
        dom.getElementById(emid).dispatchEvent(new Event('input'));
    };

    // 判断链接是否有效
    const urlCheck = (url) => {
        return new Promise((resolve) => {
            jq.ajax({
                type: 'get',
                cache: false,
                url: url,
                success: function (d) {
                    // console.log('url有效');
                    resolve(true)
                },
                error: function (d) {
                    // console.log('url无效');
                    resolve(false);
                }
            });
        });
    };

    // 从弹窗添加表情实时预览结果 [https://u2.dmhy.org/moresmilies.php?form=upload&text=descr]
    // 考虑更换成内部悬浮窗
    // 外部窗口填入，不记录光标位置
    (async () => {
        if (location.pathname !== '/moresmilies.php') return;

        jq('td[align="center"] a').each(function () {
            let scriptAction = jq(this).attr('href');
            jq(this).attr('href', scriptAction.replace('SmileIT', 'SmileIT2'));
        });

        jq('body').append(`<script type="text/javascript">
function SmileIT2(smile, form, text) {
    window.opener.document.forms[form].elements[text].value = window.opener.document.forms[form].elements[text].value + " " + smile + " ";
    window.opener.document.forms[form].elements[text].focus();
    window.opener.document.forms[form].elements[text].dispatchEvent(new Event('input'));
    window.close();
};
</script>`)

    })();


    // 举报
    (async () => {
        let type = 'report';
        // 查找举报提交页面
        const $report_form = jq('form[action="report.php"]');
        if ($report_form.length === 0) return;
        $report_form.find('[type="submit"]').after(`<input id="${type}_bbcode" type="button" value="高级">`);
        // 插入框架
        jq('#outer').parent().after(await basicFrame('举报', type));
        // 插入同步窗口滚动按钮
        await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
        // 插入自动保存按钮
        await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
        const $outer = jq(`#${type}_outer`);
        // 监听按钮
        await btnListener(type);
        // 同步窗口大小变化
        syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

        // 关闭窗口
        jq(`#${type}_close_box`).click(function () {
            jq('#outer').show();
            $outer.hide();
        });
        // 发送
        jq(`#${type}_post_box`).click(function () {
            jq('[name="reason"]').val(jq(`#${type}_box_bbcode`).val());
            $outer.hide();
            jq('#outer').show();
            $report_form.find('[type="submit"]').trigger("submit");
        });
        //显示窗口
        jq(`#${type}_bbcode`).click(async function () {
            // 获取输入框的值，如引用之类的数据
            let text = $report_form.find('textarea').val();
            // 如果外部输入框不为空，则引入外部输入框的值
            if (text !== '') jq(`#${type}_box_bbcode`).val(text);
            // 显示窗口
            $outer.show();
            // 隐藏窗口
            jq('#outer').hide();
            // 设置悬浮窗口中预览窗口的最大高度
            jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
            const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
            jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
            // 手动触发bbcode内容更改
            jq(`#${type}_box_bbcode`).trigger("input");
        });
    })();


    // 聊天
    (async () => {
        let type = 'shbox';
        const $shbox_button = jq('#hbsubmit');  // 查找聊天版清除按钮
        if ($shbox_button.length === 0) return;  // 聊天版自动刷新时，会再次触发当前函数 || 未开启聊天版
        $shbox_button.after(`<input id="${type}_bbcode" type="button" class="${$shbox_button.attr('class')}" value="高级">`);
        // 插入框架
        $shbox_button.parents('tr:last()').after(await basicFrame('群聊区', type));
        // 插入同步窗口滚动按钮
        await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
        // 插入自动保存按钮
        await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
        const $outer = jq(`#${type}_outer`);
        // 监听按钮
        await btnListener(type);
        // 同步窗口大小变化
        syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

        // 点击关闭窗口按钮
        jq(`#${type}_close_box`).click(function () { $outer.hide(); });
        // 发送
        jq(`#${type}_post_box`).click(async function () {
            // 强制将attach中的img附件转为img tag <u2已经在聊天区拒绝显示attach，见日志 67eba9ca892af4931ced86921fd017b9ee457730>
            await attach2Img(`${type}_box_bbcode`, window.document);
            // 更改输入框类型 方法有点蠢，懒的改，又不是不能用
            jq('#shbox_text').each(function () {
                const textarea = jq(document.createElement('textarea')).attr({
                    'name': jq(this).attr('name'),
                    'id': jq(this).attr('id'),
                    'size': jq(this).attr('size'),
                    'style': jq(this).attr('style')
                });
                jq(this).replaceWith(textarea);
            });
            jq('#shbox_text').val(jq(`#${type}_box_bbcode`).val());
            jq('[name="shbox"]').trigger("submit");
            jq('#shbox_text').each(function () {
                const textarea = jq(document.createElement('input')).attr({
                    'name': jq(this).attr('name'),
                    'id': jq(this).attr('id'),
                    'size': jq(this).attr('size'),
                    'style': jq(this).attr('style')
                });
                jq(this).replaceWith(textarea);
            });
            $outer.hide();
        });
        //点击按钮
        jq(`#${type}_bbcode`).click(async function () {
            // 获取输入框的值，如引用之类的数据
            let text = jq('#shbox_text').val();
            // 如果外部输入框不为空，则引入外部输入框的值
            if (text !== '') jq(`#${type}_box_bbcode`).val(text);
            // 显示窗口
            $outer.is(':hidden') ? $outer.show() : $outer.hide();
            // 设置窗口中预览窗口的最大高度
            jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
            const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
            jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
            // 手动触发bbcode内容更改
            jq(`#${type}_box_bbcode`).trigger("input");
        });
    })();


    // 请求续种
    (async () => {
        if (location.pathname !== '/request.php') return;
        let type = 'request';
        // 查找按钮
        const $request_button = jq('#qr');
        if ($request_button.length === 0) return;
        $request_button.after(`<input id="${type}_bbcode" type="button" class="codebuttons" value="高级">`)
        // 插入框架
        jq('#outer').find('tbody:first').append(await basicFrame('回应/评论', type));
        // 插入同步窗口滚动按钮
        await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
        // 插入自动保存按钮
        await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
        const $outer = jq(`#${type}_outer`);

        // 监听按钮
        await btnListener(type);
        // 同步窗口大小变化
        syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);

        // 关闭窗口
        jq(`#${type}_close_box`).click(function () {
            jq('#compose').parentsUntil('.embedded').eq(-1).show();
            $outer.hide();
        });
        // 发送
        jq(`#${type}_post_box`).click(function () {
            jq('#compose textarea').val(jq(`#${type}_box_bbcode`).val());
            $outer.hide();
            jq('#compose').parentsUntil('.embedded').eq(-1).show();
            jq('#compose').trigger("submit");
        });
        //点击弹出窗口
        jq(`#${type}_bbcode`).click(async function () {
            // 获取输入框的值，如引用之类的数据
            let text = jq('#compose textarea').val();
            // 如果外部输入框不为空，则引入外部输入框的值
            if (text !== '') jq(`#${type}_box_bbcode`).val(text);
            // 显示窗口
            $outer.show();
            // 隐藏窗口
            jq('#compose').parentsUntil('.embedded').eq(-1).hide();
            // 设置悬浮窗口中预览窗口的最大高度
            jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
            const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
            jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
            // 手动触发bbcode内容更改
            jq(`#${type}_box_bbcode`).trigger("input");
        });
    })();


    // 控制面板
    (async () => {
        if (location.pathname !== '/usercp.php') return;
        let action;
        let type = 'usercp';
        const $signature_window = jq('[name="signature"]');  // 查找BBCODE窗口
        const $info_window = jq('[name="info"]');  // 查找BBCODE窗口
        if ($signature_window.length !== 0) { type = `${type}_signature`; action = 'signature'; }
        else if ($info_window.length !== 0) { type = `${type}_info`; action = 'info'; }
        else return;

        jq(`[name="${action}"]`).parent().find('a').attr({ 'href': 'javascript:void(0);false;', 'target': '', 'id': `${action}_bbcode_a` });
        // await basicFrame(action === 'signature' ? '论坛签名档' : '个人说明', type);  
        // 插入框架
        jq('#outer').find('tbody:first').append(await basicFrame(action === 'signature' ? '论坛签名档' : '个人说明', type));
        // 插入同步窗口滚动按钮
        await syncScroll(`#${type}_bbcodejs_tbody_box`, type, `#${type}_box_bbcode`, `#${type}_bbcode2_box`);
        // 插入自动保存按钮
        await autoSaveMessage(`#${type}_bbcodejs_tbody_box`, `#${type}_box_bbcode`, `#${type}_post_box`, type, `${type}_compose_custom`);
        const $outer = jq(`#${type}_outer`);

        await btnListener(type);  // 监听按钮
        syncWindowChange(`#${type}_box_bbcode`, `#${type}_bbcode2_box`);  // 同步窗口大小变化

        // 关闭窗口
        jq(`#${type}_close_box`).click(function () {
            jq('#outer').find('table:last').show();
            $outer.hide();
        });
        // 发送
        jq(`#${type}_post_box`).click(function () {
            jq(`[name="${action}"]`).val(jq(`#${type}_box_bbcode`).val());
            jq('#outer').find('table:last').show();
            $outer.hide();
        });
        // 点击弹出窗口
        jq(`#${action}_bbcode_a`).click(async function () {
            // 获取输入框的值，如引用之类的数据
            let text = jq(`[name="${action}"]`).val();
            // 如果外部输入框不为空，则引入外部输入框的值
            if (text !== '') jq(`#${type}_box_bbcode`).val(text);
            // 显示悬浮窗口
            $outer.show();
            // 隐藏窗口
            jq('#outer').find('table:last').hide();
            // 设置悬浮窗口中预览窗口的最大高度
            jq(`#${type}_bbcode2_box`).css("max-height", (jq(`#${type}_box_bbcode`).height() + 30) + "px");
            const margin = jq(`#${type}_compose_custom .codebuttons`).parents('tbody').eq(0).width() - jq(`#${type}_bbcodejs_select_box`).width() - 2.6;
            jq(`#${type}_bbcodejs_select_box`).css("margin-left", margin + "px");
            // 手动触发bbcode内容更改
            jq(`#${type}_box_bbcode`).trigger("input");
            jq(`#${type}_post_box`).attr("value", '填写');
        });
    })();


    // 附件
    (async () => {
        if (location.pathname !== '/attachment.php') return;

        const url = window.URL || window.webkitURL;
        let upload_size_limit = jq('td').text().match(/(?<val>(\d+?))\sMi[BБ]/);
        upload_size_limit = upload_size_limit ? upload_size_limit.groups.val : 1;
        let upload_qty_limit = jq('td').text().match(/(?<val>\d+(?:\/| из | of )\d+)/);
        upload_qty_limit = upload_qty_limit ? upload_qty_limit.groups.val.replace(' из ', '/').replace(' of ', '/') : null;
        let upload_extensions_limit = jq('span').attr('title').slice(0, -1).replace(/\//g, ',');

        jq('input[type="file"]').attr('multiple', 'multiple'); // 允许多文件上传
        jq('input[type="file"]').attr("id", "files");
        jq('input[type="file"]').hide();
        jq('input[name="submit"]').attr('type', 'button'); // 更改按钮类型
        jq('input[type="file"]').css('width', '20%'); // 调整文件输入框的宽度
        jq('.embedded').after(`<td name="progress" width="25%"><div class="progress"><div></div></div></td>
                           <td name="progress" style="width: 23%; text-align: center; font-style: italic;";><span name="progress-percent"></span></td>
                           <td name="progress" style="width: 8%; text-align: center; font-style: italic;"><span name="progress-total"></span></td>
                           <td name="progress" style="font-style: italic; white-space: nowrap; text-overflow: ellipsis; overflow: hidden;">
                            <span name="progress-name"></span>
                           </td>`);
        jq('.progress').css({
            'width': '99%',
            'height': '8px',
            'border': '1px solid #ccc',
            'border-radius': '5px',  // 圆角
            'margin': '8px 2px',
            'overflow': 'hidden',  // 控制内容溢出元素框时在对应的元素区间内添加滚动条
        });
        jq('.inframe').css('background', 'none'); // 去除背景色
        jq('table').css('table-layout', 'fixed'); // 设置表格宽度固定
        jq('table tr td').css("border", "0px solid"); // 去除边框
        jq('.progress > div').css({
            'width': '0px',
            'height': '100%',
            'background-color': '#8db8ff',
            'transition': 'all 300ms ease'
        }); // 设置进度条颜色
        jq('[name="progress"]').hide();  // 隐藏进度条
        jq('[name="altsize"]').hide();  // 隐藏小缩略图选项
        jq('input[name="submit"]').prop("disabled", true);  // 未选择文件时，禁止点击上传按钮

        const image_host = {
            "u2.dmhy.org": {
                "size": upload_size_limit,
                "extensions": upload_extensions_limit
            }, "p.sda1.dev": {
                "size": 5,
                "extensions": "jpeg,jpg,png,gif,bmp,webp"
            }, "s.ee": {
                "size": 5,
                "extensions": "jpeg,jpg,png,gif,bmp,webp",
                "auth": true
            },
        };

        jq('[name="submit"]').val('开始上传')
        jq('td:first').html(jq('td:first').html().replace(/>(.+?)</g, '><'));
        jq('td:first b').remove();
        jq('td:first span').remove();
        jq('td:first').css({ 'display': 'inline-block', 'padding': 0, 'border': 'none' })
        jq('input[type="file"]').after(`<input class="codebuttons" id="upload_files" style="font-size:11px; margin-right:3px" type="button" value="选择文件" onclick="document.getElementById('files').click()">`);
        jq('.embedded').append(`<input class="codebuttons" id="upload_auth" style="font-size:11px; margin-right:3px" type="button" value="图床鉴权">`);
        jq('.embedded').append(`<select class="med codebuttons" style="width: auto; min-width: 160px; margin-left: 10px; margin-right: 10px;"></select>`);
        jq('select').append(`<option title="${upload_extensions_limit}" value="u2.dmhy.org">U2 [${upload_size_limit}MB] (配额 ${upload_qty_limit})</option>`);
        jq('select').append(`<option title="jpeg,jpg,png,gif,bmp,webp" value="p.sda1.dev">流浪图床 [5MB]</option>`)
        // 找不到不通过代理显示进度条的办法
        // jq('select').append(`<option title="jpeg,jpg,png,gif,bmp,webp" value="p.sda1.dev.proxy">流浪图床(代理) [5MB]</option>`)
        jq('select').append(`<option title="jpeg,jpg,png,gif,bmp,webp" value="s.ee">S.EE [5MB]</option>`)

        jq('#files').change(function () {
            const emfile = jq('#files')[0];
            jq('input[name="submit"]').prop("disabled", false);
            let files_title = new Array();
            for (let i = 0, len = emfile.files.length; i < len; i++) files_title.push(emfile.files[i].name);
            jq('#upload_files').val(files_title.length === 0 ? "选择文件" : `已选择${files_title.length}个文件`);
            jq('#upload_files').attr("title", files_title.join('\n'));
        });

        jq('select').change(async function () {
            let website = jq(this).val();
            let _extensions = '.' + image_host[website].extensions.replace(/,/g, ',.');
            // console.log(_extensions);
            jq('input[type="file"]').attr('accept', _extensions); // 限制上传文件类型
            jq('#upload_auth').prop("disabled", image_host[website].auth === true ? false : true);  // 需要鉴权就解除按钮锁定
            jq('#upload_auth').attr('title', await db.getItem('image_host_website_auth_' + website));
            await db.setItem('image_host_website', website);
            await db.setItem('image_host_website_extensionss_limit', image_host[website].extensions);
        });

        jq('#upload_auth').click(async function () {
            // 填入图床需要的鉴权信息
            const website = jq('select').val();
            const auth = window.prompt(`注意: 脚本不会为输入值进行校验！\n\nToken: https://s.ee/user/developers/\n\n请输入 [${website}] 图床需要的鉴权信息:`);
            if (auth === null || auth.length === 0) return;
            await db.setItem('image_host_website_auth_' + website, auth);
        });

        jq('select').val(await db.getItem('image_host_website') || 'u2.dmhy.org').trigger('change');  // 网页加载后还原上次使用的图床

        jq('input[name="submit"]').click(async function () {
            const emfile = jq('input[type="file"]')[0];
            if (!emfile.value) {
                // 没有选择文件时，不触发上传
                window.alert('请选择文件');
                return;
            };
            jq('.embedded').hide();
            jq('[name="progress"]').show();
            let _list = []; // 存储上传文件的hash值
            await (async () => {
                for (let i = 0, len = emfile.files.length; i < len; i++) {
                    // console.log(emfile.files[i]);
                    jq('[name="progress-total"]').text(`${i + 1} / ${len}`); // 显示当前上传文件的序号
                    let f = await imgCompressor(emfile.files[i]).catch(e => { window.alert(e) });
                    if (!f || !f.file) continue;  // 如果不是有效的文件，则跳过
                    const val = await upload(f.file, f.thumb).catch(e => { }); // 上传文件 返回文件hash
                    console.log(val);
                    if (val) _list.push(val); // 存储hash值
                };
            })();
            // console.log(attach_hash_list);
            let bbcode = '';
            _list.forEach(async (val) => {
                if (/^[a-zA-Z0-9]{32}$/.test(val)) { bbcode += `[attach]${val}[/attach]`; }
                else if (/^https?:\/\/.+/.test(val)) { bbcode += `[img]${val}[/img]`; }
                else { console.error("无效数据 -> " + val); };
            });
            let em = /text_area_id=(?<id>[^\?&]+)/i.exec(location.search);  // 获取text_area_id
            addTextBox(window.parent.document.getElementById(em.groups.id), bbcode); // 添加附件bbcode
            window.parent.document.getElementById(em.groups.id).dispatchEvent(new Event('input'));  // 触发input事件
            jq('[name="progress"]').hide();  // 隐藏进度条
            jq('.embedded').show();  // 显示附件菜单
            jq('[name="file"]').val(''); // 清空输入框
            jq('#upload_files').val("选择文件");
        });

        // 判断是否会触发缩图
        const imgThumb = (file) => {
            return new Promise((resolve) => {
                let img = new Image();              //创建个Image对象
                img.src = url.createObjectURL(file); //将图片路径存入Image对象
                img.onload = async function () {
                    console.log('长: ' + this.height + ' | 宽: ' + this.width)
                    resolve((this.height > 500 || this.width > 500) ? 1 : 0);
                };
                img.onerror = function () {
                    window.alert(`${file.name} 不是有效的图片文件`);
                    resolve('badimg');
                };
            });
        };

        const imgCompressor = (file) => {
            return new Promise(async (resolve, reject) => {

                if (typeof imageConversion !== 'object') { reject('conversion.js 没有加载'); return; };

                const compress_format = (await db.getItem('default_image_compress_format') || 'webp').toLowerCase();  // 压缩格式
                const default_compress = await db.getItem('default_image_compress'); // 全局压缩
                const website = await db.getItem('image_host_website');
                const max_size = image_host[website].size;

                if (file.type.indexOf('image') === 0 && file.size > 1024 * 1024 * max_size) {

                    if (/\.(gif)$/i.test(file.name)) { resolve({ 'file': file, 'thumb': 0 }); return; };  // gif压缩后会变静态图

                    if (!default_compress) {
                        if (!confirm(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)}M)\n图片过大无法上传,是否压缩图片?`)) {
                            resolve({ 'file': null, 'thumb': 'badimg' });
                            return;
                        };
                    };

                    if (!(file instanceof File)) {
                        let reader = new FileReader();
                        reader.onload = async function (e) {
                            jq('[name="progress-percent"]').text('压缩中...  (文件过大)');
                            jq('[name="progress-name"]').text(file.name);
                            imageConversion.compressAccurately(new Blob([new Uint8Array(e.target.result)], { type: file.type }), { size: max_size * 1000, type: 'image/' + compress_format })
                                .then((data) => {
                                    jq('[name="progress-percent"]').text('压缩中...  (文件过大)  完成.');
                                    let _file = data.scale === 'good' ? new File([data.file], file.name + '.' + compress_format, { type: 'image/' + compress_format }) : file;
                                    imgThumb(_file).then(t => {
                                        resolve({ 'file': _file, 'thumb': t });
                                    });
                                })
                                .catch(e => { resolve({ 'file': null, 'thumb': 'badimg' }); });
                        };
                        reader.onerror = function () {
                            window.alert(`${file.name} 读取失败`);
                            // reject('invalid file');
                            resolve({ 'file': null, 'thumb': 'badimg' });
                        }
                        reader.readAsArrayBuffer(file);
                    } else {
                        jq('[name="progress-percent"]').text('压缩中...  (文件过大)');
                        jq('[name="progress-name"]').text(file.name);
                        imageConversion.compressAccurately(file, { size: max_size * 1000, type: 'image/' + compress_format })
                            .then((data) => {
                                jq('[name="progress-percent"]').text('压缩中...  (文件过大)  完成.');
                                let _file = data.scale === 'good' ? new File([data.file], file.name + '.' + compress_format, { type: 'image/' + compress_format }) : file;
                                imgThumb(_file).then(t => {
                                    resolve({ 'file': _file, 'thumb': t });
                                });
                            })
                            .catch(e => { resolve({ 'file': null, 'thumb': 'badimg' }); });
                    };

                }
                else if (file.type.indexOf('image') === 0) {
                    if (/\.(gif)$/i.test(file.name)) { resolve({ 'file': file, 'thumb': 0 }); return; };  // gif压缩后会变静态图
                    // console.log(default_compress);
                    if (!default_compress) { imgThumb(file).then(t => { resolve({ 'file': file, 'thumb': t }); }); return; }; // 未开启全局压缩

                    if (!(file instanceof File)) {
                        let reader = new FileReader();
                        reader.onload = async function (e) {
                            jq('[name="progress-percent"]').text('压缩中...  (全局)');
                            jq('[name="progress-name"]').text(file.name);
                            imageConversion.compress(new Blob([new Uint8Array(e.target.result)], { type: file.type }), { quality: 1, type: 'image/' + compress_format })
                                .then((data) => {
                                    jq('[name="progress-percent"]').text('压缩中...  (全局)  完成.');
                                    let _file = data.scale === 'good' ? new File([data.file], file.name + '.' + compress_format, { type: 'image/' + compress_format }) : file;
                                    imgThumb(_file).then(t => {
                                        resolve({ 'file': _file, 'thumb': t });
                                    });
                                })
                                .catch(e => { resolve({ 'file': null, 'thumb': 'badimg' }); });
                        };
                        reader.onerror = function () {
                            window.alert(`${file.name} 读取失败`);
                            resolve({ 'file': null, 'thumb': 'badimg' });
                        }
                        reader.readAsArrayBuffer(file);
                    } else {
                        jq('[name="progress-percent"]').text('压缩中...  (全局)');
                        jq('[name="progress-name"]').text(file.name);
                        imageConversion.compress(file, { quality: 1, type: 'image/' + compress_format })
                            .then((data) => {
                                jq('[name="progress-percent"]').text('压缩中...  (全局)  完成.');
                                let _file = data.scale === 'good' ? new File([data.file], file.name + '.' + compress_format, { type: 'image/' + compress_format }) : file;
                                imgThumb(_file).then(t => {
                                    resolve({ 'file': _file, 'thumb': t });
                                });
                            })
                            .catch(e => { resolve({ 'file': null, 'thumb': 'badimg' }); });
                    };
                }
                else {
                    resolve({ 'file': file, 'thumb': 'other' })
                };

            });
        };

        // 上传文件
        const upload = async (file, attach_thumb) => {
            // attach_thumb 是判断是否会触发U2返回缩略图的参数 <u2在图片超过一定大小后，会进行一次压缩>
            const website = await db.getItem('image_host_website');
            const website_size = image_host[website].size;
            const website_extensions = image_host[website].extensions.split(',');
            const auth = await db.getItem('image_host_website_auth_' + website);

            switch (website) {
                case 'u2.dmhy.org':
                    return await upload1(file, attach_thumb, website_size, website_extensions);
                case 'p.sda1.dev':
                    return await upload3Proxy(file, website_size, website_extensions);
                case 's.ee':
                    if (auth) {
                        return await upload4Proxy(file, website_size, website_extensions, auth);
                    } else {
                        window.alert(`请先设置图床的鉴权信息\nhttps://s.ee/user/developers/`);
                        return;
                    }
                default:
                    break;
            };

        };

        const uploadErrorHandling = (e) => {
            window.alert(`上传发生错误 -> ${e.message || e}`);
            jq('[name="progress"]').hide();  // 隐藏进度条
            jq('[name="file"]').val(''); // 清空输入框
            jq('#upload_files').val("选择文件");
            jq('.embedded').show();  // 显示附件菜单
        };

        // 上传文件
        const upload1 = (file, attach_thumb, max_size, extensions) => {
            // u2.dmhy.org
            return new Promise(async (resolve, reject) => {

                if (!extensions.includes(file.name.split('.').pop().toLowerCase())) { window.alert(`${file.name} 文件类型不支持`); reject(); return; };
                if (file.size > 1024 * 1024 * max_size) { window.alert(`${file.name} 文件过大`); reject(); return; };

                let formData = new FormData();  // 创建一个form类型的数据
                formData.append('file', file);  // 获取上传文件的数据

                jq.ajax({
                    url: "attachment.php", // 接口
                    type: 'post',
                    cache: false,
                    contentType: false,
                    processData: false,
                    data: formData,
                    xhr: function () {
                        const xhr = new XMLHttpRequest();
                        xhr.upload.addEventListener('progress', function (e) {
                            let progressRate = ((e.loaded / e.total) * 100).toFixed(2) + '%';  // 计算上传进度
                            jq('.progress > div').css('width', progressRate);  // 设置进度条宽度
                            jq('[name="progress-percent"]').text(`${e.loaded} / ${e.total} | ${progressRate}`);
                            jq('[name="progress-name"]').text(file.name);
                        });
                        return xhr;
                    },
                    success: async function (d) {
                        try {
                            let attach_hash_obj = /(?<hash>\w{32})/i.exec(jq(d).find('script').text());
                            // <span class="striking">失败！不允许该文件扩展名。</span>
                            const attach_hash = attach_hash_obj.groups.hash; // 附件的hash值
                            const attach = { "attach_thumb": attach_thumb };
                            await attachmap_db.setItem(attach_hash, attach); // 写入数据库
                            // 不知道怎么计算的，怎么传都用不完配额
                            let limit = jq(d).find('td').text().match(/(?<val>\d+(?:\/| из | of )\d+)/);
                            limit = limit ? limit.groups.val.replace(' из ', '/').replace(' of ', '/') : null;
                            jq('select option[value="u2.dmhy.org"]').text(`U2 [${upload_size_limit}MB] (配额 ${limit})`);
                            jq('.progress > div').css('width', '0%');  // 重置进度条宽度
                            resolve(attach_hash);
                        } catch (e) {
                            uploadErrorHandling(e);
                            reject(e);
                        };
                    },
                    error: function (e) {
                        uploadErrorHandling(e);
                        reject(e);
                    }
                });
            });
        };

        const upload3 = (file, max_size, extensions) => {
            // p.sda1.dev binary
            return new Promise(async (resolve, reject) => {

                if (!extensions.includes(file.name.split('.').pop().toLowerCase())) { window.alert(`${file.name} 文件类型不支持`); reject(); return; };
                if (file.size > 1024 * 1024 * max_size) { window.alert(`${file.name} 文件过大`); reject(); return; };

                async function fileToBlob(file) {
                    // 为兼容Violentmonkey加的转换，Tampermonkey 打开binary后可直传file
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(file);
                    await new Promise(resolve => reader.onload = resolve);
                    return new Blob([reader.result], { type: file.type });
                };

                GM_xmlhttpRequest({
                    method: "POST",
                    data: await fileToBlob(file),
                    // binary: true,
                    // anonymous: true,  // 使用此参数禁止发送cookie会导致无法触发onprogress
                    headers: { "Cookie": "" },// 禁止发送 cookie
                    url: `https://p.sda1.dev/api/v1/upload_external_noform?filename=${encodeURIComponent(file.name.replace(/#/g, '_'))}`,
                    upload: {
                        onprogress: function (e) {
                            if (e.lengthComputable) {
                                let progressRate = ((e.loaded / e.total) * 100).toFixed(2) + '%';  // 计算上传进度
                                jq('.progress > div').css('width', progressRate);  // 设置进度条宽度
                                jq('[name="progress-percent"]').text(`${e.loaded} / ${e.total} | ${progressRate}`);
                                jq('[name="progress-name"]').text(file.name);
                            };
                        }
                    },
                    onload: function (r) {
                        let j = JSON.parse(r.responseText);
                        console.log(j);
                        if (j.success) {
                            let url = j.data.url;
                            console.log(url);
                            resolve(url);
                        } else {
                            uploadErrorHandling(j.message);
                            reject(j.message);
                        };
                        jq('.progress > div').css('width', '0%');  // 重置进度条宽度
                    },
                    onerror: function (e) {
                        uploadErrorHandling(e);
                        reject(e);
                    }
                });

            });

        };

        const upload3Proxy = (file, max_size, extensions) => {
            // p.sda1.dev binary
            return new Promise(async (resolve, reject) => {
                console.log('p.sda1.dev binary TEST')
                if (!extensions.includes(file.name.split('.').pop().toLowerCase())) { window.alert(`${file.name} 文件类型不支持`); reject(); return; };
                if (file.size > 1024 * 1024 * max_size) { window.alert(`${file.name} 文件过大`); reject(); return; };

                async function fileToBlob(file) {
                    // 为兼容Violentmonkey加的转换，Tampermonkey 打开binary后可直传file
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(file);
                    await new Promise(resolve => reader.onload = resolve);
                    return new Blob([reader.result], { type: file.type });
                };

                const blob = await fileToBlob(file);
                const xhr = new XMLHttpRequest();

                xhr.open("POST", `https://u2.kysdm.com/proxy/sda1?filename=${encodeURIComponent(file.name.replace(/#/g, '_'))}`, true);
                xhr.setRequestHeader("Content-Type", file.type);
                // 显式设置不携带 cookies
                xhr.withCredentials = false;

                // 上传进度监听
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const progressRate = ((e.loaded / e.total) * 100).toFixed(2) + '%';
                        jq('.progress > div').css('width', progressRate); // 更新进度条
                        jq('[name="progress-percent"]').text(`${e.loaded} / ${e.total} | ${progressRate}`);
                        jq('[name="progress-name"]').text(file.name);
                    }
                });

                // 上传完成或出错
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        if (response.success) {
                            resolve(response.data.url);
                        } else {
                            uploadErrorHandling(response.message);
                            reject(response.message);
                        }
                    } else {
                        uploadErrorHandling(xhr.statusText);
                        reject(xhr.statusText);
                    }

                    // 重置进度条
                    jq('.progress > div').css('width', '0%');
                };

                xhr.onerror = (e) => {
                    uploadErrorHandling(e);
                    reject(e);
                };

                // 发送 Blob 数据
                xhr.send(blob);

            });

        };

        const upload4Proxy = (file, max_size, extensions, auth) => {
            // s.ee
            return new Promise((resolve, reject) => {

                if (!extensions.includes(file.name.split('.').pop().toLowerCase())) { window.alert(`${file.name} 文件类型不支持`); reject(); return; };
                if (file.size > 1024 * 1024 * max_size) { window.alert(`${file.name} 文件过大`); reject(); return; };

                const formData = new FormData();
                formData.append('smfile', file);

                const xhr = new XMLHttpRequest();
                xhr.open("POST", `https://u2.kysdm.com/proxy/smms`, true);
                // 设置 Authorization 头
                xhr.setRequestHeader("Authorization", auth);
                // 显式设置不携带 cookies
                xhr.withCredentials = false;

                // 上传进度监听
                xhr.upload.addEventListener("progress", (e) => {
                    if (e.lengthComputable) {
                        const progressRate = ((e.loaded / e.total) * 100).toFixed(2) + '%';
                        jq('.progress > div').css('width', progressRate); // 更新进度条
                        jq('[name="progress-percent"]').text(`${e.loaded} / ${e.total} | ${progressRate}`);
                        jq('[name="progress-name"]').text(file.name);
                    }
                });

                // 上传完成或出错
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        if (response.code === 200) {
                            resolve(response.data.url);
                        } else {
                            uploadErrorHandling(response);
                            reject(response);
                        }
                    } else {
                        uploadErrorHandling(xhr.statusText);
                        reject(xhr.statusText);
                    }

                    // 重置进度条
                    jq('.progress > div').css('width', '0%');
                };

                xhr.onerror = (e) => {
                    uploadErrorHandling(e);
                    reject(e);
                };

                // 发送 FormData 数据
                xhr.send(formData);
            });

        };

        // 图片压缩格式
        jq('input[name="submit"]').after(`<input id="default_image_compress_format" title="设置压缩后的图片格式" style="font-size:11px;margin-right:3px" type="button" value="${((format) => { return format ? format : 'WEBP'; })(await db.getItem('default_image_compress_format'))}">`);
        jq(`#default_image_compress_format`).click(async function () {
            await db.getItem('default_image_compress_format').then(async format => {
                if (format === 'WEBP') {
                    await db.setItem('default_image_compress_format', 'JPEG');
                    jq('#default_image_compress_format').val('JPEG');
                } else {
                    await db.setItem('default_image_compress_format', 'WEBP');
                    jq('#default_image_compress_format').val('WEBP');
                };
            });
        });

        // 全局图片压缩
        jq('input[name="submit"]').after(`<input id="default_image_compress" title="全局 - 尝试压缩所有图片\n局部 - 仅尝试压缩超过大小限制的图片" style="font-size:11px;margin-right:3px" type="button" value="${((bool) => { return bool ? '全局' : '局部'; })(await db.getItem('default_image_compress'))}">`);
        jq(`#default_image_compress`).click(async function () {
            await db.getItem('default_image_compress').then(async bool => {
                bool ? await db.setItem('default_image_compress', false) : await db.setItem('default_image_compress', true);
                bool ? jq('#default_image_compress').val('局部') : jq('#default_image_compress').val('全局');
            });
        });

        // 将 attach 标签内的图片转为 img 标签 <attach的图片太糊了，要大图还要点一下，好麻烦xd>
        jq('input[name="submit"]').after(`<input id="bigimg" title="将attach标签的图片转为img标签" style="font-size:11px;margin-right:3px;margin-left:3px" type="button" value="ATTACH转IMG">`);
        jq(`#bigimg`).click(async function () {
            let em = /text_area_id=(?<id>[^\?&]+)/i.exec(location.search);
            if (!em) return;  // 没有找到id直接返回 
            await attach2Img(em.groups.id, window.parent.document);
        });

        // mediainfo
        const mediainfoFn = (dom, file) => {
            return new Promise(async (resolve, reject) => {
                if (typeof MediaInfo !== 'function') {
                    reject('mediainfo.js 没有加载.')
                    return;
                };

                const mediainfo = await MediaInfo({ format: 'text' });
                // console.log('Mediainfo Working…');
                const getSize = () => file.size;
                const readChunk = (chunkSize, offset) =>
                    new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onload = (event) => {
                            if (event.target.error) {
                                reject(event.target.error);
                            };
                            resolve(new Uint8Array(event.target.result));
                        };
                        reader.readAsArrayBuffer(file.slice(offset, offset + chunkSize));
                    });

                // mediainfo.Option('File_FileName', file.name);
                mediainfo
                    .analyzeData(getSize, readChunk)
                    .then((result) => {
                        if (result) {
                            result = result.replace(/(\n)*$/, '');
                            let r = result.split('\n');
                            let index = r[1].startsWith('Format  ') ? 1 : 2;
                            r.splice(index, 0, `Complete name                            : ${file.name}`);
                            result = r.join('\n');
                        };
                        // console.log(result); 
                        addTextBox(dom, `[mediainfo]${result}[/mediainfo]`);
                        resolve();
                    })
                    .catch((error) => {
                        reject(error.stack);
                    });
            });
        };


        // 拖拽&剪贴板上传
        (async (text_area_id) => {
            const box = window.parent.document.getElementById(text_area_id); // 允许拖拽上传的区域

            box.addEventListener('paste', async function (e) {
                if (window.parent.document.getElementById(text_area_id) !== (e.target || e.toElement)) return;

                // https://developer.mozilla.org/zh-CN/docs/Web/API/ClipboardEvent/clipboardData
                // let clipboardData = (e.clipboardData || e.originalEvent.clipboardData);
                let items = e.clipboardData && e.clipboardData.items;

                if (items) {
                    for (var i = 0; i < items.length; i++) {
                        if (!items[i].type.startsWith('image/')) continue;
                        if (!confirm('上传剪贴板中的图片?')) return;
                        jq('.embedded').hide();
                        jq('[name="progress"]').show();
                        // https://developer.mozilla.org/zh-CN/docs/Web/API/DataTransferItem/getAsFile
                        const file = items[i].getAsFile();
                        if (file) {
                            jq('[name="progress-total"]').text(`1 / 1`); // 显示当前上传文件的序号
                            let f = await imgCompressor(file).catch(e => { window.alert(e) });
                            if (!f || !f.file) continue;  // 如果不是有效的文件，则跳过
                            const val = await upload(f.file, f.thumb).catch(e => { }); // 上传文件 返回文件hash
                            let bbcode = '';
                            if (/^[a-zA-Z0-9]{32}$/.test(val)) { bbcode += `[attach]${val}[/attach]`; }
                            else if (/^https?:\/\/.+/.test(val)) { bbcode += `[img]${val}[/img]`; }
                            else { console.error("无效数据 -> " + val); continue; };
                            addTextBox(window.parent.document.getElementById(text_area_id), bbcode); // 添加附件bbcode
                            window.parent.document.getElementById(text_area_id).dispatchEvent(new Event('input'));  // 触发input事件
                            jq('[name="progress"]').hide();  // 隐藏进度条
                            jq('.embedded').show();  // 显示附件菜单
                        };
                        // console.log(file);
                    };
                };
            });


            box.addEventListener("drop", async function (e) {
                e.preventDefault(); //取消默认浏览器拖拽效果

                if (window.parent.document.getElementById(text_area_id) !== (e.target || e.toElement)) return;

                let file_list = e.dataTransfer.files;   // 获取文件对象
                if (file_list.length == 0) return false;

                jq('.embedded').hide();
                jq('[name="progress"]').show();
                let _list = new Array(); // 存储上传文件的hash值
                await (async () => {
                    for (let i = 0, len = file_list.length; i < len; i++) {
                        jq('[name="progress-total"]').text(`${i + 1} / ${len}`); // 显示当前上传文件的序号
                        console.log('文件: ' + file_list[i].name + '| 类型: ' + file_list[i].type);
                        if (/\.(flv|mkv|mp4|ts|avi|mov|wmv|mpg|mpeg|rm|ram|swf|f4v|h261|h264|h263|m2ts)$/i.test(file_list[i].name)) {  // 常见的视频后缀名
                            jq('[name="progress-percent"]').text('解析中...');
                            jq('[name="progress-name"]').text(file_list[i].name);
                            await mediainfoFn(window.parent.document.getElementById(text_area_id), file_list[i]).catch(e => { window.alert(e); });
                            continue;
                        };
                        let f = await imgCompressor(file_list[i]).catch(e => { window.alert(e) });
                        if (!f || !f.file) continue;  // 如果不是有效的文件，则跳过
                        const val = await upload(f.file, f.thumb).catch(e => { }); // 上传文件 返回文件hash
                        if (val) _list.push(val); // 存储hash值
                    };
                })();
                let bbcode = '';

                _list.forEach(async (val) => {
                    if (/^[a-zA-Z0-9]{32}$/.test(val)) { bbcode += `[attach]${val}[/attach]`; }
                    else if (/^https?:\/\/.+/.test(val)) { bbcode += `[img]${val}[/img]`; }
                    else { console.error("无效数据 -> " + val); };
                });

                addTextBox(window.parent.document.getElementById(text_area_id), bbcode); // 添加附件bbcode
                window.parent.document.getElementById(text_area_id).dispatchEvent(new Event('input'));  // 触发input事件
                jq('[name="progress"]').hide();  // 隐藏进度条
                jq('.embedded').show();  // 显示附件菜单

            },
                false);

        })(/text_area_id=(?<id>[^\?&]+)/i.exec(location.search).groups.id);

    })();

    function bencodeDecodeUint8Array(data) {
        const decoder = new TextDecoder();
        let pointer = 0;

        function decodeString() {
            const delimiterIndex = data.indexOf(58, pointer);
            const lengthBuffer = data.slice(pointer, delimiterIndex);
            const length = parseInt(decoder.decode(lengthBuffer), 10);
            const start = delimiterIndex + 1;
            const end = start + length;
            const value = data.slice(start, end);
            pointer = end;
            return value;
        };

        function decodeNumber() {
            const endIndex = data.indexOf(101, pointer);
            const valueBuffer = data.slice(pointer + 1, endIndex);
            const value = parseInt(decoder.decode(valueBuffer), 10);
            pointer = endIndex + 1;
            return value;
        };

        function decodeList() {
            const result = [];
            pointer++; // Move past 'l'
            while (data[pointer] !== 101) {
                const item = decodeValue();
                result.push(item);
            };
            pointer++; // Move past 'e'
            return result;
        };

        function decodeDictionary() {
            const result = {};
            pointer++; // Move past 'd'
            while (data[pointer] !== 101) {
                const key = decoder.decode(decodeString());
                const value = decodeValue();
                result[key] = value;
            };
            pointer++; // Move past 'e'
            return result;
        };

        function decodeValue() {
            const currentByte = data[pointer];

            if (currentByte === 105) {
                return decodeNumber();
            } else if (currentByte === 108) {
                return decodeList();
            } else if (currentByte === 100) {
                return decodeDictionary();
            } else {
                return decodeString();
            };
        };

        return decodeValue();
    };


    /**
     * 生成文件树结构。
     * - item: 路径List
     * - length: 文件体积
     */
    class TrieTree {
        constructor() {
            this.root = {};
        }

        insert(item, length, path_length) {
            let current_node = this.root;

            for (let i = 0; i < item.length; i++) {
                let _item = item[i];
                let keys = Object.keys(current_node);
                let _break = false;

                for (let j = 0; j < keys.length; j++) {
                    let k = keys[j];

                    if (k === _item) {
                        let node = current_node[_item];
                        current_node = node;
                        _break = true;
                    } else if (k === 'children') {
                        let node = current_node['children'][_item];
                        if (node !== undefined) {
                            current_node = node;
                            _break = true;
                        }
                    }
                }

                if (_break === true) {
                    continue;
                }

                let new_node = (i + 1 === item.length) ? { "type": "file", "length": length, "path_length": path_length } : { "type": "directory", "children": {} };

                try {
                    current_node["children"][_item] = new_node;
                } catch (error) {
                    current_node[_item] = new_node;
                }

                current_node = new_node;
            }
        }
    }


    // 对JSON进行排序
    const stringify = function (obj, opts) {
        if (!opts) opts = {};
        if (typeof opts === 'function') opts = { cmp: opts };
        var space = opts.space || '';
        if (typeof space === 'number') space = Array(space + 1).join(' ');
        var cycles = (typeof opts.cycles === 'boolean') ? opts.cycles : false;
        var replacer = opts.replacer || function (key, value) { return value; };

        var cmp = opts.cmp && (function (f) {
            return function (node) {
                return function (a, b) {
                    var aobj = { key: a, value: node[a] };
                    var bobj = { key: b, value: node[b] };
                    return f(aobj, bobj);
                };
            };
        })(opts.cmp);

        var seen = [];
        return (function stringify(parent, key, node, level) {
            var indent = space ? ('\n' + new Array(level + 1).join(space)) : '';
            var colonSeparator = space ? ': ' : ':';

            if (node && node.toJSON && typeof node.toJSON === 'function') {
                node = node.toJSON();
            }

            node = replacer.call(parent, key, node);

            if (node === undefined) {
                return;
            }
            if (typeof node !== 'object' || node === null) {
                return JSON.stringify(node);
            }
            if (isArray(node)) {
                var out = [];
                for (var i = 0; i < node.length; i++) {
                    var item = stringify(node, i, node[i], level + 1) || JSON.stringify(null);
                    out.push(indent + space + item);
                }
                return '[' + out.join(',') + indent + ']';
            }
            else {
                if (seen.indexOf(node) !== -1) {
                    if (cycles) return JSON.stringify('__cycle__');
                    throw new TypeError('Converting circular structure to JSON');
                }
                else seen.push(node);

                var keys = objectKeys(node).sort(cmp && cmp(node));
                var out = [];
                for (var i = 0; i < keys.length; i++) {
                    var key = keys[i];
                    var value = stringify(node, key, node[key], level + 1);

                    if (!value) continue;

                    var keyValue = JSON.stringify(key)
                        + colonSeparator
                        + value;
                    ;
                    out.push(indent + space + keyValue);
                }
                seen.splice(seen.indexOf(node), 1);
                return '{' + out.join(',') + indent + '}';
            }
        })({ '': obj }, '', obj, 0);
    };

    const isArray = Array.isArray || function (x) {
        return {}.toString.call(x) === '[object Array]';
    };

    const objectKeys = Object.keys || function (obj) {
        var has = Object.prototype.hasOwnProperty || function () { return true };
        var keys = [];
        for (const key in obj) {
            if (has.call(obj, key)) keys.push(key);
        }
        return keys;
    };

    function convertBytesToAutoUnit(bytes) {
        var units = ['B', 'KB', 'MB'];
        var unitIndex = 0;

        while (bytes >= 1024 && unitIndex < units.length - 1) {
            bytes >>= 10;
            unitIndex++;
        };

        return bytes + units[unitIndex];
    };

    function convert(s) {
        if (s / 1024 < 1024) return (s / 1024).toFixed(3) + lang['KiB']
        if (s / 1024 / 1024 < 1024) return (s / 1024 / 1024).toFixed(3) + lang['MiB']
        if (s / 1024 / 1024 / 1024 < 1024) return (s / 1024 / 1024 / 1024).toFixed(3) + lang['GiB']
        if (s / 1024 / 1024 / 1024 / 1024 < 1024) return (s / 1024 / 1024 / 1024 / 1024).toFixed(3) + lang['TiB']
    };

    const putFileTree = (torrent_tree) => {
        // 插入ID
        let counter = 0;
        const InsertSeq = (data) => {
            for (const key in data) {
                data[key]['id'] = counter;
                counter++;
                if (data[key]['type'] == 'directory') InsertSeq(data[key]['children']);
            };
            return data;
        };
        // 获取文件ID
        const getFile = (data) => {
            let a = []
            for (const key in data) {
                if (data[key]['type'] == 'file') a.push(data[key]['id']);
            };
            a = a.concat(getDirectory(data));
            return a;
        };
        // 获取文件夹ID
        const getDirectory = (data, directory = []) => {
            for (const key in data) {
                if (data[key]['type'] == 'directory') directory.push(data[key]['id']);
            };
            return directory;
        };
        // 获取文件体积
        const getSize = (data, size = 0) => {
            // console.log(data);
            for (const key in data) {
                if (data[key]['type'] == 'file') {
                    size = size + data[key]['length'];
                } else {
                    size = getSize(data[key]['children'], size);
                };
            }
            return size;
        };
        // 遍历JSON
        const tree = (j, i) => {
            for (const key in j) {
                if (j[key]['type'] == 'directory') {
                    let children = j[key]['children'];
                    let f_id_sh = getFile(children);  // 获取文件夹需要的id
                    let f_size = convert(getSize(children))  // 文件夹大小
                    if (f_id === 0) {
                        f_html = f_html + `<tr id="f_id_0" tag="closed"><td class="rowfollow"><a href="javascript:void(0)" onclick="showorhide([${f_id_sh}],0)" class="faqlink">${key}</a></td><td class="rowfollow dir_size" align="right">[${f_size}]</td></tr>`;
                    } else {
                        f_html = f_html + `<tr id="f_id_${f_id}" style="display: none;" tag="closed"><td class="rowfollow">${space.repeat(i)}<a href="javascript:void(0)" onclick="showorhide([${f_id_sh}],${f_id})" class="faqlink">${key}</a></td><td class="rowfollow dir_size" align="right">[${f_size}]</td></tr>`;
                    };
                    f_id++;
                    tree(children, i + 1);
                }
                else {
                    const color = (j[key]['path_length'] > 230) ? 'color: red;' : '';
                    if (f_id === 0) {
                        // 单文件种子
                        f_html = f_html + `<tr id="f_id_${f_id}" style="${color}"><td class="rowfollow">${space.repeat(i)}${key}</td><td class="rowfollow" align="right">${convert(j[key]['length'])}</td></tr>`;
                    } else {
                        f_html = f_html + `<tr id="f_id_${f_id}" style="display: none;${color}"><td class="rowfollow">${space.repeat(i)}${key}</td><td class="rowfollow" align="right">${convert(j[key]['length'])}</td></tr>`;
                    };
                    f_id++;
                };
            };
        };

        if (torrent_tree === null) {
            return;
        };
        torrent_tree = stringify(torrent_tree, function (a, b) {
            // 对keys排序
            if (typeof (a.value) !== 'object' || typeof (b.value) !== 'object') return 0;
            if (a.value.type === 'directory' && b.value.type === 'file') {
                return -1;
            } else if (a.value.type === 'file' && b.value.type === 'directory') {
                return 1;
            } else {
                return a.key.toLowerCase() < b.key.toLowerCase() ? -1 : 1;
            };
        });
        torrent_tree = JSON.parse(torrent_tree);
        torrent_tree = InsertSeq(torrent_tree);
        // console.log(__json);
        let f_id = 0;  // 元素id
        let f_html = '';  // 文件列表
        const space = '&nbsp;&nbsp;&nbsp;&nbsp;';  // 缩进
        tree(torrent_tree, 0);
        // $('#filelist').find('tr').after(f_html);
        jq('#file_tree').html(
            `<span id="filelist">
            <table border="1" cellspacing="0" cellpadding="5">
                <tbody>
                    ${f_html}
                </tbody>
            </table>
        </span>`
        );
    };

    async function pageTorrentInfo() {
        const torrentBlob = await db.getItem(`upload_autoSaveMessageTorrentBlob`)
        const response = await fetch(URL.createObjectURL(torrentBlob));
        const arrayBuffer = await response.arrayBuffer();
        const torrentUint8Array = new Uint8Array(arrayBuffer)
        const decodedData = bencodeDecodeUint8Array(torrentUint8Array);
        console.log(decodedData);
        // https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder
        const encoder = new TextEncoder();
        const decoderUtf8 = new TextDecoder();
        const decoder = decodedData.encoding ? new TextDecoder(decoderUtf8.decode(decodedData.encoding)) : new TextDecoder();
        let maxPathUtf8Bytes = 0;
        let maxPathName = new Array();
        let torrentSize = 0;
        let fileCount;
        const torrentName = decoder.decode(decodedData.info.name);
        const piecesLength = decodedData.info['piece length'];
        const files = decodedData.info.files;
        const file_tree = decodedData.info['file tree']; //v2
        const trie = new TrieTree();

        let torrentVer;
        let piecesCount;
        if (typeof files === 'object' && typeof file_tree === 'object') {
            torrentVer = 'hybrid';
            piecesCount = decodedData.info.pieces.length / 20;
        } else if (typeof file_tree === 'undefined' && (typeof files === 'object' || typeof files === 'undefined')) {
            torrentVer = 'v1'
            piecesCount = decodedData.info.pieces.length / 20;
        } else if (typeof file_tree === 'object') {
            torrentVer = 'v2'
        } else {
            torrentVer = 'null'
        };

        if (torrentVer === 'v2') {
            if (Object.keys(file_tree).length === 1) {
                // 只有一个文件时  即使外面有一层文件夹，制作V2种子时会自动忽略外面的文件夹
                fileCount = 1;
                const _path = Object.keys(file_tree)[0];
                const _length = file_tree[_path][""].length;
                piecesCount = Math.ceil(_length / piecesLength)
                const currentPathUtf8Bytes = encoder.encode(_path).length;
                maxPathUtf8Bytes = currentPathUtf8Bytes;
                maxPathName = [_path];
                trie.insert([_path], _length, currentPathUtf8Bytes);
            } else {
                // 遍历v2的树结构，生成自定义的树结构
                const traverseFileTree = (obj, depth = 0, path = '') => {
                    // console.log(obj);
                    for (const key in obj) {
                        if (typeof obj[key] === 'object') {
                            if (key === '') {
                                fileCount++;
                                piecesCount += Math.ceil(obj[key].length / piecesLength);
                                const currentPathUtf8Bytes = encoder.encode(path).length;
                                trie.insert(path.split('/'), obj[key].length, currentPathUtf8Bytes);
                                if (maxPathUtf8Bytes < currentPathUtf8Bytes) {
                                    maxPathUtf8Bytes = currentPathUtf8Bytes;
                                    maxPathName = [path];
                                } else if (maxPathUtf8Bytes === currentPathUtf8Bytes) {
                                    maxPathName.push(path);
                                };
                                return;
                            }
                            const nextPath = path !== '' ? `${path}/${key}` : `${torrentName}/${key}`;
                            traverseFileTree(obj[key], depth + 1, nextPath);
                        }
                    }
                }
                piecesCount = 0;
                fileCount = 0;
                traverseFileTree(file_tree)
            };
        } else {
            if (typeof files === 'undefined') {
                fileCount = 1;
                const length = decodedData.info.length;
                torrentSize = length;
                const currentPathUtf8Bytes = encoder.encode(torrentName).length;
                trie.insert([torrentName], length, currentPathUtf8Bytes);
                maxPathUtf8Bytes = currentPathUtf8Bytes;
                maxPathName = [torrentName];
            } else {
                fileCount = files.length;
                for (let file in files) {
                    if (files.hasOwnProperty(file)) {
                        let paths = files[file].path;
                        const length = files[file].length;
                        torrentSize = torrentSize + length;
                        let currentPath = torrentName;
                        let newPaths = [torrentName];
                        for (let path in paths) {
                            if (paths.hasOwnProperty(path)) {
                                const pahtDecode = decoder.decode(paths[path])
                                currentPath = currentPath + '/' + pahtDecode;
                                newPaths.push(pahtDecode);
                            };
                        };
                        const currentPathUtf8Bytes = encoder.encode(currentPath).length;
                        trie.insert(newPaths, length, currentPathUtf8Bytes);
                        if (maxPathUtf8Bytes < currentPathUtf8Bytes) {
                            maxPathUtf8Bytes = currentPathUtf8Bytes;
                            maxPathName = [currentPath];
                        } else if (maxPathUtf8Bytes === currentPathUtf8Bytes) {
                            maxPathName.push(currentPath);
                        };
                    };
                };
            };
        }

        jq('#torrentinfo1').html(`<b>版本:</b> &nbsp;${torrentVer} &nbsp; &nbsp;<b>区块:</b> &nbsp;${convertBytesToAutoUnit(piecesLength)} &nbsp; &nbsp;<b>区块数:</b> &nbsp;${piecesCount} &nbsp; &nbsp;<b>文件数:</b> &nbsp;${fileCount}`);
        jq('#torrentinfo2').html(`&nbsp; &nbsp;<b>路径长度:</b> &nbsp;${maxPathUtf8Bytes}`);
        jq('#torrentinfo2').prop('title', maxPathName.join("\n"));

        let warnStr = new Array();
        if (torrentVer !== 'v1') warnStr.push('非V1模式种子');
        if (!(1048576 <= piecesLength <= 16777216)) warnStr.push('区块不在1M~16M内');
        if (piecesCount > 10000) warnStr.push('区块数量超过1W');
        if (maxPathUtf8Bytes > 230) warnStr.push('路径长度超过230字节');
        jq('#torrentinfo3').html(warnStr.join(' | '));
        putFileTree(trie.root);
        pageTorrentCheck(trie.root)
    }

    // 候选处理脚本
    function pageTorrentCheck(directory) {
        (() => {
            const style = document.createElement('style');
            style.innerHTML = `
                .char-box-rounded {
                    display: inline-block;
                    border: 1.5px solid;
                    border-radius: 6px;
                    padding: 1px 2px;
                    margin: 0 2px;
                    line-height: 1.1;
                }
            `;
            document.head.appendChild(style);
        })();

        class Logger {
            constructor() {
                this.logs = [];
            }

            addLog(content) {
                const formattedContent = content.replace(/^([^→]+) → (.+)$/, '$1 → <span style="color: rgb(128, 128, 128);">$2</span>');
                this.logs.push(formattedContent);
            }

            renderLogs(targetElementId) {
                const targetElement = document.getElementById(targetElementId);
                if (targetElement) {
                    targetElement.innerHTML = this.logs.join('<br>');
                }
            }
        }

        const logger = new Logger();

        /**
         * Blu-ray 目录完整性检查的统一入口。
         *
         * 主循环只负责发现当前目录名是否命中 bluRayStructures 配置表；
         * 命中后由本函数统一完成两件事：
         * - 检查 BDMV / CERTIFICATE 是否在同一父目录中成对出现
         * - 调用该目录自己的 checker 处理必需项、BACKUP 和其它专属规则
         *
         * @param {Object} parentDirectory - 当前 BD 目录的父目录对象，用于查找同级目录。
         * @param {string} parentPath - 父目录路径，用于输出缺失同级目录的日志。
         * @param {string} directoryName - 实际命中的目录名，保留原始大小写用于拼接路径。
         * @param {Object} directory - 当前 BD 目录对象。
         * @param {Object} structure - bluRayStructures 中对应的规则配置。
         */
        function checkBluRayDirectory(parentDirectory, parentPath, directoryName, directory, structure) {
            // BDMV 与 CERTIFICATE 必须同级出现。
            // 通过配置表中的 peerDirectory 做互检，可以同时覆盖：
            // - 只有 BDMV、缺少 CERTIFICATE
            // - 只有 CERTIFICATE、缺少 BDMV
            const peerItem = getDirectoryItem(parentDirectory, structure.peerDirectory);
            if (!peerItem || peerItem.type !== 'directory') {
                logger.addLog(`${structure.peerDirectory} 缺失目录 → ${parentPath}/${structure.peerDirectory}`);
            }

            structure.checker(directory, `${parentPath}/${directoryName}`, structure);
        }

        /**
         * 检查 BDMV 目录的结构完整性。
         *
         * 通用部分交给 checkDiscStructure：
         * - BDMV 根目录下必须存在 index.bdmv / MovieObject.bdmv
         * - BDMV 根目录下必须存在 BACKUP / CLIPINF / PLAYLIST / STREAM
         *
         * BDMV 特有部分在本函数处理：
         * - BACKUP 中的关键文件、CLIPINF、PLAYLIST 需要与主目录对应
         * - STREAM 与 CLIPINF 的编号需要一一对应
         * - STREAM 下的 m2ts 文件体积应为 192 字节的倍数
         */
        function checkBDMV(directory, currentPath, structure) {
            checkDiscStructure('BDMV', directory, currentPath, structure);

            // 检测 BACKUP 目录是否存在
            const backupItem = getDirectoryItem(directory, 'BACKUP');
            if (backupItem && backupItem.type === 'directory') {
                // log(`检测到 BACKUP 目录 ${currentPath}/BACKUP`);

                // 检查 BACKUP 目录结构是否与主目录一致
                checkBackup(backupItem.children, directory, currentPath);  // 比较 BACKUP 目录与主 BDMV 目录
            }

            // 检测 STREAM 和 CLIPINF 目录
            const streamItem = getDirectoryItem(directory, 'STREAM');
            const clipinfItem = getDirectoryItem(directory, 'CLIPINF');
            if (streamItem && streamItem.type === 'directory' && clipinfItem && clipinfItem.type === 'directory') {
                // log(`检测到 STREAM 和 CLIPINF 目录 ${currentPath}/STREAM 和 ${currentPath}/CLIPINF`);

                const streamDirectory = streamItem.children;
                const clipinfDirectory = clipinfItem.children;

                // 调用 checkClipInfo 函数，检测 STREAM 和 CLIPINF 文件的对应关系
                checkClipInfo(streamDirectory, clipinfDirectory, currentPath);

                // 检测 M2TS 文件体积
                checkStreamFileSize(streamDirectory, currentPath);
            }
        }

        /**
         * 检查 CERTIFICATE 目录的结构完整性。
         *
         * CERTIFICATE 的规则比 BDMV 简单：
         * - 根目录必须存在 id.bdmv
         * - 根目录必须存在 BACKUP
         * - 如果 BACKUP 存在，则 BACKUP/id.bdmv 需要与根目录 id.bdmv 对应
         */
        function checkCertificate(directory, currentPath, structure) {
            checkDiscStructure('CERTIFICATE', directory, currentPath, structure);

            // 如果 BACKUP 目录已经由 checkDiscStructure 报过缺失，这里直接结束，避免重复报错。
            const backupItem = getDirectoryItem(directory, 'BACKUP');
            if (!backupItem || backupItem.type !== 'directory') return;

            compareBackupFiles('CERTIFICATE/BACKUP', backupItem.children, directory, currentPath, structure.files);
        }

        /**
         * 从目录对象中按名称取子项，忽略大小写。
         *
         * 种子文件列表里目录名通常是标准大写，但真实发布中偶尔会出现大小写变化。
         * 检查完整性时不应因为 BACKUP / backup 这种大小写差异导致脚本取不到对象并报错。
         */
        function getDirectoryItem(directory, itemName) {
            const lowerItemName = itemName.toLowerCase();
            const key = Object.keys(directory).find(key => key.toLowerCase() === lowerItemName);
            return key ? directory[key] : null;
        }

        /**
         * 通用目录结构检查。
         *
         * @param {string} label - 日志中使用的目录名，例如 BDMV 或 CERTIFICATE。
         * @param {Object} directory - 当前要检查的目录对象。
         * @param {string} currentPath - 当前目录在种子中的路径，用于输出日志。
         * @param {{ files: string[], directories: string[] }} structure - 必需文件和必需目录清单。
         */
        function checkDiscStructure(label, directory, currentPath, structure) {
            structure.files.forEach(file => {
                const item = getDirectoryItem(directory, file);
                if (!item) {
                    logger.addLog(`${label} 缺失文件 → ${currentPath}/${file}`);
                } else if (item.type !== 'file') {
                    logger.addLog(`${label} 类型错误 → ${currentPath}/${file} 应为文件`);
                }
            });

            structure.directories.forEach(dir => {
                const item = getDirectoryItem(directory, dir);
                if (!item) {
                    logger.addLog(`${label} 缺失目录 → ${currentPath}/${dir}`);
                } else if (item.type !== 'directory') {
                    logger.addLog(`${label} 类型错误 → ${currentPath}/${dir} 应为目录`);
                }
            });
        }

        /**
         * 比较主目录与 BACKUP 目录中指定文件的存在性和大小。
         *
         * 这里只比较“必须备份”的文件：
         * - BDMV 使用 index.bdmv / MovieObject.bdmv
         * - CERTIFICATE 使用 id.bdmv
         *
         * 更完整的内容一致性比较会在 handleTorrentChecksum 中通过 SHA256 完成。
         */
        function compareBackupFiles(label, backupDirectory, mainDirectory, currentPath, files) {
            files.forEach(file => {
                const mainFile = getDirectoryItem(mainDirectory, file);
                const backupFile = getDirectoryItem(backupDirectory, file);

                if (!backupFile && mainFile) {
                    logger.addLog(`${label} 缺失文件 → ${currentPath}/BACKUP/${file}`);
                } else if (backupFile && mainFile && mainFile.length !== backupFile.length) {
                    logger.addLog(`${label} 文件大小不匹配 → ${currentPath}/BACKUP/${file}`);
                }
            });
        }

        // 检测 M2TS 文件体积是否为 192 的倍数
        function checkStreamFileSize(streamDirectory, currentPath) {
            for (const [name, file] of Object.entries(streamDirectory)) {
                if (name.toLowerCase().endsWith('.m2ts')) {
                    const size = file.length;
                    if (size % 192 !== 0) {
                        logger.addLog(`体积非 192 的倍数 (余${size % 192}) → ${currentPath}/STREAM/${name}`);
                    }
                }
            }
        }

        // 检查 BACKUP 目录和主 BDMV 目录是否一致
        function checkBackup(backupDirectory, mainDirectory, currentPath) {
            // 必须备份的文件和文件夹
            const requiredBackupItems = {
                files: ['index.bdmv', 'MovieObject.bdmv'],
                directories: ['CLIPINF', 'PLAYLIST']
            };

            compareBackupFiles('BDMV/BACKUP', backupDirectory, mainDirectory, currentPath, requiredBackupItems.files);

            // 检查必需备份的文件夹并比较文件
            requiredBackupItems.directories.forEach(dir => {
                const mainSubDir = getDirectoryItem(mainDirectory, dir);
                const backupSubDir = getDirectoryItem(backupDirectory, dir);
                const innerPath = `${currentPath}/BACKUP/${dir}`;

                if (!backupSubDir && mainSubDir) {
                    logger.addLog(`BDMV/BACKUP 缺失目录 → ${innerPath}`);
                } else if (backupSubDir && mainSubDir) {
                    // 比较文件夹中的文件 (.clpi / .m2ts)
                    compareFilesInDirectory(backupSubDir.children, mainSubDir.children, innerPath);
                }
            });
        }

        // 比较主目录和 BACKUP 目录中的文件
        function compareFilesInDirectory(backupFiles, mainFiles, currentPath) {
            const mainFileMap = new Map(Object.keys(mainFiles).map(file => [file.toLowerCase(), file]));
            const backupFileMap = new Map(Object.keys(backupFiles).map(file => [file.toLowerCase(), file]));

            mainFileMap.forEach((mainFileName, lowerFileName) => {
                const backupFileName = backupFileMap.get(lowerFileName);
                const mainFile = mainFiles[mainFileName];
                const backupFile = backupFileName ? backupFiles[backupFileName] : null;

                if (!backupFile) {
                    logger.addLog(`BDMV/BACKUP 缺失文件 → ${currentPath}/${mainFileName}`);
                } else {
                    // 检查文件大小是否不同
                    if (mainFile.length !== backupFile.length) {
                        logger.addLog(`BDMV/BACKUP 文件大小不匹配 → ${currentPath}/${backupFileName}`);
                    }
                }
            });

            backupFileMap.forEach((backupFileName, lowerFileName) => {
                if (!mainFileMap.has(lowerFileName)) {
                    logger.addLog(`BDMV/BACKUP 多余文件 → ${currentPath}/${backupFileName}`);
                }
            });
        }

        // 检测 .clpi 文件是否与 .m2ts 文件对应
        function checkClipInfo(streamDirectory, clipinfDirectory, currentPath) {
            const m2tsFiles = Object.keys(streamDirectory)
                .filter(key => key.toLowerCase().endsWith('.m2ts'))
                .map(key => key.toLowerCase().replace('.m2ts', ''));

            const clpiFiles = Object.keys(clipinfDirectory)
                .filter(key => key.toLowerCase().endsWith('.clpi'))
                .map(key => key.toLowerCase().replace('.clpi', ''));

            // 比对两个文件夹的文件
            m2tsFiles.forEach(file => {
                if (!clpiFiles.includes(file)) {
                    logger.addLog(`缺少对应的 CLIPINF 文件 → ${currentPath}/CLIPINF/${file}.clpi`);
                }
            });

            clpiFiles.forEach(file => {
                if (!m2tsFiles.includes(file)) {
                    logger.addLog(`缺少对应的 STREAM 文件 → ${currentPath}/STREAM/${file}.m2ts`);
                }
            });
        }

        /**
         * 比较 BD 目录中 BACKUP 文件与主文件的 SHA256。
         *
         * API 返回的是扁平文件列表，形如：
         * - xxx/BDMV/index.bdmv
         * - xxx/BDMV/BACKUP/index.bdmv
         * - xxx/CERTIFICATE/id.bdmv
         * - xxx/CERTIFICATE/BACKUP/id.bdmv
         *
         * 本函数先按 BDMV / CERTIFICATE 根路径分组，再把 BACKUP 文件路径中的
         * "/BACKUP/" 去掉，得到它理论上对应的主文件路径，最后比较两者 hash。
         *
         * @param {Array} fileList - 文件信息数组，每个元素包含 hash 和 path 属性。
         * @returns {Array<{ path: string, backupRoot: string }>} - hash 不匹配的 BACKUP 文件及其根目录类型。
         */
        function getMismatchedDiscBackups(fileList) {
            const discGroups = {};
            const backupRoots = ['BDMV', 'CERTIFICATE'];

            // 按 BDMV / CERTIFICATE 根路径分组
            for (const { path, hash } of fileList) {
                // 只处理 BDMV 和 CERTIFICATE 内部文件，其它媒体文件、扫图等不参与 BACKUP 完整性比对。
                const backupRoot = backupRoots.find(root => path.includes(`/${root}/`));
                if (!backupRoot) continue;

                // rootPath 用于区分同一个种子中可能存在的多套 BD 目录结构。
                // 例如 /DISC1/BDMV 和 /DISC2/BDMV 会被分到两个组里，避免交叉比较。
                const rootIndex = path.indexOf(`/${backupRoot}/`);
                const rootPath = `${path.substring(0, rootIndex)}/${backupRoot}`;
                (discGroups[rootPath] ||= []).push({ path, hash, backupRoot });
            }

            const mismatched = [];

            for (const files of Object.values(discGroups)) {
                // 建立主文件映射
                const mainFiles = Object.fromEntries(
                    files
                        .filter(f => !f.path.includes("/BACKUP/"))
                        .map(f => [f.path, f.hash])
                );

                // 检查 BACKUP 文件
                for (const { path, hash, backupRoot } of files) {
                    if (!path.includes("/BACKUP/")) continue;

                    // BACKUP 文件的主文件路径只差一个 /BACKUP/ 层级。
                    // 如果主文件不存在，mainHash 为 undefined，也会被视为不匹配并输出错误。
                    const mainPath = path.replace("/BACKUP/", "/");
                    const mainHash = mainFiles[mainPath];

                    if (mainHash !== hash) {
                        mismatched.push({ path, backupRoot });
                    }
                }
            }

            return mismatched;
        }

        const getFileExtension = (filePath) => {
            const ext = filePath.split('.').pop().toLowerCase();
            return ext === filePath ? '' : ext; // 如果没有扩展名，则返回空字符串
        }

        const pathBasedRules = [
            { pattern: /\/CERTIFICATE(\/BACKUP)?\/$/, allowedFileNames: /^id\.bdmv$|^(app|bu)\.discroot\.crt$|^online\.crl$|^online\.crt$|^online\.sig$/ },
            { pattern: /\/BDMV\/AUXDATA\/$/, allowedFileNames: /^(dvb.fontindex|_dsa_version_|bdtmdlist\.xml|sound\.bdmv|\d{5}\.otf)$/ },
            { pattern: /\/BDMV\/STREAM\/$/, allowedFileNames: /^\d{5}\.m2ts$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/JAR\/\d{5}\//, allowedFileNames: /^.+\.(png|txt|csv|xml|aca|bdmv|properties)$|^bluray_project\.bin$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/JAR\/$/, allowedFileNames: /^\d{5}\.jar$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/BDJO\/$/, allowedFileNames: /^\d{5}\.bdjo$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/PLAYLIST\/$/, allowedFileNames: /^\d{5}\.mpls$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/CLIPINF\/$/, allowedFileNames: /^\d{5}\.clpi$/ },
            // { pattern: /\/BDMV(\/BACKUP)?\/JAR\/00000\/$/, allowedFileNames: /^(main\.0\.aca|main\.1\.png|map\.txt)$/ },
            { pattern: /\/BDMV\/META\/DL\/$/, allowedFileNames: /^bdmt_(eng|jpn|deu|fra|ita|nld|spa|zho|kor)\.xml$|^[^\/]+\.jpg$|^(discinfo|disclib|titleinfo)\.xsd$/ },
            { pattern: /\/BDMV(\/BACKUP)?\/$/, allowedFileNames: /^(MovieObject|index)\.bdmv$/ },
            { pattern: /\/VIDEO_TS\/$/, allowedFileNames: /^(VIDEO_TS|VTS_\d{2}_\d)\.(BUP|IFO|VOB)$/ },
            { pattern: /\/(?:scans?|bk)\/(?:[^\/]+\/){0,3}$/i, allowedFileNames: /[^\/]+\.(bmp|tif|tiff|png|jpg|jpeg|webp|jxl)$/i },  // 确保扫描文件夹中只包含图片文件
            { pattern: /^\/(?:[^\/]+\/){0,5}$/, allowedFileNames: /[^\/]+\.(iso|mds|mkv|ts|mp4|png|jpg|jpeg|bmp|webp|tif|tiff|flac|wav|aiff|m4a|cue|log)$/i },  // 0-5层文件夹
        ];

        function isFileNameValidForPath(directoryPath, fileName) {
            if (typeof directoryPath !== 'string') {
                console.warn({ directoryPath, fileName, pattern: null, allowedFileNames: null });
                return false;
            }

            const normalizedDirectoryPath = directoryPath === ''
                ? '/'
                : directoryPath.endsWith('/') ? directoryPath : `${directoryPath}/`;

            const rule = pathBasedRules.find(rule => rule.pattern.test(normalizedDirectoryPath));
            if (rule) {
                if (rule.allowedFileNames.test(fileName)) {
                    console.debug({ directoryPath: normalizedDirectoryPath, fileName, ...rule });
                    return true;
                }
            }
            console.warn({ directoryPath: normalizedDirectoryPath, fileName, pattern: null, allowedFileNames: null });
            return false;
        }

        function hasNestedBDMV(directory) {
            // 查找当前目录树中是否存在嵌套的 BDMV 文件夹
            for (const [name, item] of Object.entries(directory)) {
                if (item.type === "directory") {
                    if (name.toLowerCase() === "bdmv") {
                        // 发现更深层的 BDMV，立刻返回 true
                        return true;
                    }
                    // 否则继续在子目录里查找
                    if (hasNestedBDMV(item.children)) {
                        return true;
                    }
                }
            }
            return false;
        }

        // 垃圾文件夹的名称
        const junkFolders = new Set(["makemkv", "any!", "xrvl", "fab!", "aac!"]);

        // 垃圾文件的完整名称
        const junkFiles = new Set([".ds_store", "thumbs.db", "disc.inf"]);

        // 垃圾文件扩展名
        const junkFileExtensions = new Set([".m3u8", ".m3u", ".lwi", ".bat", ".md5", ".nfo", ".accurip", ".miniso"]);

        // 可疑文件扩展名 <总感觉会漏，还是维护白名单吧>
        // const suspiciousFileExtensions = new Set([".txt", ".xml"]);

        // BD 目录的最小完整性要求。
        // BDMV 和 CERTIFICATE 在标准 Blu-ray 目录结构中应当作为同级目录出现，
        // 因此这里用同一张配置表维护两类目录的必需项、同级依赖和专属检查函数。
        // 遍历目录树时只需要查表并调用 checkBluRayDirectory，避免在主循环里分别写两套分支。
        const bluRayStructures = {
            bdmv: {
                label: 'BDMV',
                peerDirectory: 'CERTIFICATE',
                files: ["index.bdmv", "MovieObject.bdmv"],
                directories: ["BACKUP", "CLIPINF", "PLAYLIST", "STREAM"],
                shouldSkip: hasNestedBDMV,
                checker: checkBDMV
            },
            certificate: {
                label: 'CERTIFICATE',
                peerDirectory: 'BDMV',
                files: ["id.bdmv"],
                directories: ["BACKUP"],
                checker: checkCertificate
            }
        };

        // 不可见字符
        const invisibleCharPattern = /[\u0000-\u001F\u007F\u200B-\u200F\u2028-\u202F\uFEFF\u200E]/g;

        // 日文变音符号
        const japaneseDiacriticPattern = /(.[\u3099\u309A])/g;

        // Windows 系统中不允许的字符
        const invalidCharsPattern = /[<>:"/\\|?*]/g;

        // 用栈模拟递归
        let stack = [];
        stack.push({ directory, currentPath: '' });

        // 迭代栈，直到栈为空
        while (stack.length > 0) {
            const { directory, currentPath } = stack.pop();

            // 遍历目录中的每个子项
            for (const [key, item] of Object.entries(directory)) {
                const lowerKey = key.toLowerCase(); // 将文件名或文件夹名转为小写
                const fullPath = `${currentPath}/${key}`; // 构造当前文件或文件夹的绝对路径

                // 检查文件或文件夹名中是否包含非法字符
                const invalidCharsMatches = key.match(invalidCharsPattern);
                if (invalidCharsMatches) {
                    // const invalidChars = invalidCharsMatches.join(', ');
                    const invalidChars = Array.from(new Set(invalidCharsMatches)).join(', ');
                    const highlightedPath = key.replace(invalidCharsPattern, char =>
                        `<span class="char-box-rounded">${char}</span>`
                    );
                    logger.addLog(`非法字符 → ${invalidChars} - ${highlightedPath}`); // 输出包含非法字符的路径和字符
                }

                // 检查是否存在不可见字符
                const invisibleCharMatches = key.match(invisibleCharPattern);
                if (invisibleCharMatches) {
                    // 将不可见字符转换为 Unicode 转义序列
                    // const unicodeChars = invisibleCharMatches.map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', ');
                    const unicodeChars = Array.from(new Set(invisibleCharMatches))
                        .map(char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`).join(', '); // 去重并转换为 Unicode
                    // 将完整路径中的不可见字符都替换成 Unicode 标记。
                    // 子目录报错时，父目录中已有的不可见字符也需要一并显式展示，
                    // 否则日志里会混入真实不可见字符，看起来像只标出了最后一级目录。
                    const highlightedPath = fullPath.replace(invisibleCharPattern, char =>
                        `<span class="char-box-rounded">\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}</span>`
                    );
                    logger.addLog(`不可见字符 → ${unicodeChars} - ${highlightedPath}`);
                }

                // 检查是否存在日文变音符号
                const japaneseDiacriticMatches = key.match(japaneseDiacriticPattern);
                if (japaneseDiacriticMatches) {
                    const unicodeChars = Array.from(new Set(japaneseDiacriticMatches))
                        .map(m => `\\u${m.charCodeAt(1).toString(16).padStart(4, '0')}`)
                        .join(', ');
                    const highlightedPath = fullPath.replace(japaneseDiacriticPattern, (match) => {
                        const diacriticUnicode = match.charCodeAt(1).toString(16).padStart(4, '0');
                        return `<span class="char-box-rounded">${match} \\u${diacriticUnicode}</span>`;
                    });
                    logger.addLog(`日文变音符号 → ${unicodeChars} - ${highlightedPath}`);
                }

                // 如果是目录，则将目录压入栈中
                if (item.type === "directory") {
                    if (junkFolders.has(lowerKey)) {
                        logger.addLog(`垃圾文件夹 → ${fullPath}`); // 输出垃圾文件夹的绝对路径
                        continue;  // 如果是垃圾文件夹，那么内部的文件都没用
                    }
                    else {
                        const bluRayStructure = bluRayStructures[lowerKey];
                        if (bluRayStructure && !bluRayStructure.shouldSkip?.(item.children)) {
                            checkBluRayDirectory(directory, currentPath, key, item.children, bluRayStructure);
                        }
                    }
                    // 将子目录压入栈中
                    stack.push({ directory: item.children, currentPath: fullPath });
                }
                // 如果是文件
                else if (item.type === "file") {
                    const ext = getFileExtension(lowerKey);
                    // const isValidExt = ext.length > 0 && ext.length <= 5;  // 扩展名长度检查

                    // 如果文件大小为 0
                    if (item.length === 0) {
                        logger.addLog(`空文件 → ${fullPath}`); // 输出空文件的绝对路径
                    }
                    else if (!isFileNameValidForPath(currentPath, key)) {
                        // 检查是否是垃圾文件（通过完整名称匹配）
                        if (junkFiles.has(lowerKey)) {
                            logger.addLog(`垃圾文件 → ${fullPath}`); // 输出垃圾文件的绝对路径
                        }
                        // 检查是否是垃圾文件后缀
                        else if (junkFileExtensions.has("." + ext)) {
                            logger.addLog(`垃圾文件 → ${fullPath}`); // 输出带垃圾后缀的文件路径
                        }
                        // 检查扩展名是否合法
                        else if (ext.length < 1) {
                            logger.addLog(`缺少扩展名 → ${fullPath}`);
                        }
                        // 扩展名长度检查
                        // else if (!isValidExt) {
                        //     logger.addLog(`扩展名长度异常 → ${fullPath}`); // 输出扩展名长度异常的文件路径
                        // }
                        // // 检查是否是可疑文件后缀
                        // else if (!allowedFileExtensions.has("." + ext)) {
                        //     logger.addLog(`可疑文件 → ${fullPath}`); // 输出可疑文件的绝对路径
                        // }
                        else {
                            logger.addLog(`可疑文件 → ${fullPath}`); // 输出可疑文件的绝对路径
                        }
                    }
                }
            }
        }

        logger.addLog('完成');
        logger.renderLogs('torrentcheck');
    }


    // 动态加载js
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = url;
            document.body.appendChild(script);
            script.onload = function () {
                resolve('ok')
            };
            script.onerror = function () {
                reject('err');
            };
        });
    };

    // 异步 replace
    // https://stackoverflow.com/questions/33631041/javascript-async-await-in-replace
    async function replaceAsync(str, regex, asyncFn) {
        const promises = [];
        str.replace(regex, (match, ...args) => {
            const promise = asyncFn(match, ...args);
            promises.push(promise);
        });
        const data = await Promise.all(promises);
        return str.replace(regex, () => data.shift());
    };

    // 当前时间 字符串格式
    function getDateString() {
        const zero = (obj) => { return obj < 10 ? '0' + obj : obj };
        const time = new Date();
        return time.getFullYear().toString() + zero(time.getMonth() + 1).toString() + zero(time.getDate()).toString()
            + zero(time.getHours()) + zero(time.getMinutes()) + zero(time.getSeconds())
    };

    async function getApi(token, uid, tid) {
        return await new Promise((resolve, reject) => {
            // https://www.w3school.com.cn/jquery/ajax_ajax.asp
            jq.ajax({
                type: 'get',
                url: `https://u2.kysdm.com/api/v2/torrents/${tid}/history?limit=1`,
                headers: { "Authorization": "Bearer " + token },
                success: r => resolve(r),
                error: r => {
                    console.log('发生错误，HTTP状态码[' + r.status + ']。');
                    reject(r.status);
                },
            });
        });
    };

    function isWhitespace(str) {
        return /^\s*$/.test(str);
    }

    function lang_init(lang) {
        var lang_json = {
            "zh_CN": {
                "quote": "引用",
                "info": "发布信息",
                "mediainfo": "媒体信息",
                "code": "代码",
                "spoiler": "警告！下列文字很可能泄露剧情，请谨慎选择是否观看。",
                "spoiler_button_1": "我就是手贱",
                "spoiler_button_2": "我真是手贱",
                "main_title": "主标题",
                "rt_text": "请输入上标",
                "main_body": "请输入正文",
                "main_body_prefix": "请输入标题",
                "url_name": "请输入网址名称",
                "url_link": "请输入网址链接",
                "select_type": "请选择分类...",
                "preview": "预览",
                "auto_fold": "过深引用自动折叠",
                "KiB": " KiB",
                "MiB": " MiB",
                "GiB": " GiB",
                "TiB": " TiB",
            },
            "zh_TW": {
                "quote": "引用",
                "info": "發佈訊息",
                "mediainfo": "媒體訊息",
                "code": "代碼",
                "spoiler": "警告！下列文字很可能洩露劇情，請謹慎選擇是否觀看。",
                "spoiler_button_1": "我就是手賤",
                "spoiler_button_2": "我真是手賤",
                "main_title": "主標題",
                "rt_text": "請輸入上標",
                "main_body": "請輸入正文",
                "main_body_prefix": "請輸入標題",
                "url_name": "請輸入網址名稱",
                "url_link": "請輸入網址連結",
                "select_type": "請選擇分類...",
                "preview": "預覽",
                "auto_fold": "過深引用自動摺疊",
                "KiB": " KiB",
                "MiB": " MiB",
                "GiB": " GiB",
                "TiB": " TiB",
            },
            "zh_HK": {
                "quote": "引用",
                "info": "發佈訊息",
                "mediainfo": "媒體訊息",
                "code": "代碼",
                "spoiler": "警告！下列文字很可能洩露劇情，請謹慎選擇是否觀看。",
                "spoiler_button_1": "我就是手賤",
                "spoiler_button_2": "我真是手賤",
                "main_title": "主標題",
                "rt_text": "請輸入上標",
                "main_body": "請輸入正文",
                "main_body_prefix": "請輸入標題",
                "url_name": "請輸入網址名稱",
                "url_link": "請輸入網址鏈接",
                "select_type": "請選擇分類...",
                "preview": "預覽",
                "auto_fold": "過深引用自動摺疊",
                "KiB": " KiB",
                "MiB": " MiB",
                "GiB": " GiB",
                "TiB": " TiB",
            },
            "en_US": {
                "quote": "Quote",
                "info": "Infobox",
                "mediainfo": "Media Info",
                "code": "CODE",
                "spoiler": "Warning! This section contains spoiler!",
                "spoiler_button_1": "I agree to view this.",
                "spoiler_button_2": "Hide this.",
                "main_title": "Main Title",
                "rt_text": "Please enter superscript",
                "main_body": "Please enter the text",
                "main_body_prefix": "Please enter a title",
                "url_name": "Please enter the URL name",
                "url_link": "Please enter the URL link",
                "select_type": "Please select a type.",
                "preview": "Preview",
                "auto_fold": "Over quote auto fold",
                "KiB": " KiB",
                "MiB": " MiB",
                "GiB": " GiB",
                "TiB": " TiB",
            },
            "ru_RU": {
                "quote": "Цитата",
                "info": "Отправленные",
                "mediainfo": "Данные о Медиа",
                "code": "CODE",
                "spoiler": "Предупреждение! Данный раздел содержит СПОЙЛЕРЫ!",
                "spoiler_button_1": "I agree to view this.",
                "spoiler_button_2": "Hide this.",
                "main_title": "Основное название",
                "rt_text": "Пожалуйста, введите надстрочный индекс",
                "main_body": "Пожалуйста, введите текст",
                "main_body_prefix": "Пожалуйста, введите название",
                "url_name": "Пожалуйста, введите имя URL",
                "url_link": "Пожалуйста, введите URL-ссылку",
                "select_type": "выберите тип ...",
                "preview": "Предварительный просмотр",
                "auto_fold": "Автоматическое складывание для более глубоких ссылок",
                "KiB": " KiБ",
                "MiB": " MiБ",
                "GiB": " GiБ",
                "TiB": " TiБ",
            }
        };
        return lang_json[lang];
    };

})();
