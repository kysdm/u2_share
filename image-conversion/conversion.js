(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["imageConversion"] = factory();
	else
		root["imageConversion"] = factory();
})(this, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, "canvastoDataURL", function() { return /* reexport */ canvastoDataURL; });
__webpack_require__.d(__webpack_exports__, "canvastoFile", function() { return /* reexport */ canvastoFile; });
__webpack_require__.d(__webpack_exports__, "dataURLtoFile", function() { return /* reexport */ dataURLtoFile; });
__webpack_require__.d(__webpack_exports__, "dataURLtoImage", function() { return /* reexport */ dataURLtoImage; });
__webpack_require__.d(__webpack_exports__, "downloadFile", function() { return /* reexport */ downloadFile; });
__webpack_require__.d(__webpack_exports__, "filetoDataURL", function() { return /* reexport */ filetoDataURL; });
__webpack_require__.d(__webpack_exports__, "imagetoCanvas", function() { return /* reexport */ imagetoCanvas; });
__webpack_require__.d(__webpack_exports__, "urltoBlob", function() { return /* reexport */ urltoBlob; });
__webpack_require__.d(__webpack_exports__, "urltoImage", function() { return /* reexport */ urltoImage; });
__webpack_require__.d(__webpack_exports__, "compress", function() { return /* binding */ compress; });
__webpack_require__.d(__webpack_exports__, "compressAccurately", function() { return /* binding */ compressAccurately; });
__webpack_require__.d(__webpack_exports__, "EImageType", function() { return /* reexport */ EImageType; });

// CONCATENATED MODULE: ./src/models/index.ts
var EImageType;
(function (EImageType) {
    EImageType["PNG"] = "image/png";
    EImageType["JPEG"] = "image/jpeg";
    EImageType["GIF"] = "image/gif";
    EImageType["WEBP"] = "image/webp";
})(EImageType || (EImageType = {}));

// CONCATENATED MODULE: ./src/utils/checkImageType.ts
function checkImageType(type) {
    return ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].some(i => i === type);
}

// CONCATENATED MODULE: ./src/utils/index.ts



// CONCATENATED MODULE: ./src/canvastoDataURL.ts
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


/**
 * 将一个Canvas对象转变为一个dataURL字符串
 * 该方法可以做压缩处理
 *
 * @param {canvas} canvas
 * @param {number=} quality - 传入范围 0-1，表示图片压缩质量，默认0.92
 * @param {string=} type - 确定转换后的图片类型，选项有 "image/png", "image/jpeg", "image/gif",默认"image/jpeg"
 * @returns {Promise(string)} Promise含有一个dataURL字符串参数
 */
function canvastoDataURL(canvas, quality = 0.92, type = EImageType.JPEG) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!checkImageType(type)) {
            type = EImageType.JPEG;
        }
        return canvas.toDataURL(type, quality);
    });
}
;

// CONCATENATED MODULE: ./src/canvastoFile.ts

/**
 * 将一个canvas对象转变为一个File（Blob）对象
 * 该方法可以做压缩处理
 *
 * @param {canvas} canvas
 * @param {number=} quality - 传入范围 0-1，表示图片压缩质量，默认0.92
 * @param {string=} type - 确定转换后的图片类型，选项有 "image/png", "image/jpeg", "image/gif",默认"image/jpeg"
 * @returns {Promise(Blob)}
 */
function canvastoFile(canvas, quality = 0.92, type = EImageType.JPEG) {
    return new Promise(resolve => canvas.toBlob(blob => resolve(blob), type, quality));
}
;

// CONCATENATED MODULE: ./src/dataURLtoFile.ts
var dataURLtoFile_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

/**
 * 将一个dataURL字符串转变为一个File（Blob）对象
 * 转变时可以确定File对象的类型
 *
 * @param {string} dataURL
 * @param {string=} type - 确定转换后的图片类型，选项有 "image/png", "image/jpeg", "image/gif"
 * @returns {Promise(Blob)}
 */
function dataURLtoFile(dataURL, type) {
    return dataURLtoFile_awaiter(this, void 0, void 0, function* () {
        const arr = dataURL.split(',');
        let mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        if (checkImageType(type)) {
            mime = type;
        }
        return new Blob([u8arr], {
            type: mime,
        });
    });
}
;

// CONCATENATED MODULE: ./src/dataURLtoImage.ts
/**
 * 将dataURL字符串转变为image对象
 *
 * @param {srting} dataURL - dataURL字符串
 * @returns {Promise(Image)}
 */
function dataURLtoImage(dataURL) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('dataURLtoImage(): dataURL is illegal'));
        img.src = dataURL;
    });
}
;

// CONCATENATED MODULE: ./src/downloadFile.ts
/**
 * 将图片下载到本地
 *
 * @param {Blob} file - 一个File（Blob）对象
 * @param {string=} fileName - 下载后的文件名（可选参数，不传以时间戳命名文件）
 */
function downloadFile(file, fileName) {
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(file);
    link.download = fileName || Date.now().toString(36);
    document.body.appendChild(link);
    const evt = document.createEvent('MouseEvents');
    evt.initEvent('click', false, false);
    link.dispatchEvent(evt);
    document.body.removeChild(link);
}
;

// CONCATENATED MODULE: ./src/filetoDataURL.ts
/**
 * 将File（Blob）对象转变为一个dataURL字符串
 *
 * @param {Blob} file
 * @returns {Promise(string)} Promise含有一个dataURL字符串参数
 */
function filetoDataURL(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = e => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}
;

// CONCATENATED MODULE: ./src/imagetoCanvas.ts
var imagetoCanvas_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * 将一个image对象转变为一个canvas对象
 *
 * @param {image} image
 *
 * @typedef {Object=} config - 转变为canvas时的一些参数配置
 * 		@param {number} width - canvas图像的宽度，默认为image的宽度
 * 		@param {number} height - canvas图像的高度，默认为image的高度
 * 		@param {number} scale - 相对于image的缩放比例，范围0-10，默认不缩放；
 * 			设置config.scale后会覆盖config.width和config.height的设置；
 * 		@param {number} orientation - 图片旋转参数，默认不旋转，参考如下：
 * 			参数	 旋转方向
 * 			1		0°
 * 			2		水平翻转
 * 			3		180°
 * 			4		垂直翻转
 * 			5		顺时针90°+水平翻转
 * 			6		顺时针90°
 * 			7		顺时针90°+垂直翻转
 * 			8		逆时针90°
 * @type {config}
 *
 * @returns {Promise(canvas)}
 */
function imagetoCanvas(image, config = {}) {
    return imagetoCanvas_awaiter(this, void 0, void 0, function* () {
        const myConfig = Object.assign({}, config);
        const cvs = document.createElement('canvas');
        const ctx = cvs.getContext('2d');
        let height;
        let width;
        for (const i in myConfig) {
            if (Object.prototype.hasOwnProperty.call(myConfig, i)) {
                myConfig[i] = Number(myConfig[i]);
            }
        }
        // 设置宽高
        if (!myConfig.scale) {
            width = myConfig.width || myConfig.height * image.width / image.height || image.width;
            height = myConfig.height || myConfig.width * image.height / image.width || image.height;
        }
        else {
            // 缩放比例0-10，不在此范围则保持原来图像大小
            const scale = myConfig.scale > 0 && myConfig.scale < 10 ? myConfig.scale : 1;
            width = image.width * scale;
            height = image.height * scale;
        }
        // 当顺时针或者逆时针旋转90时，需要交换canvas的宽高
        if ([5, 6, 7, 8].some(i => i === myConfig.orientation)) {
            cvs.height = width;
            cvs.width = height;
        }
        else {
            cvs.height = height;
            cvs.width = width;
        }
        // 设置方向
        switch (myConfig.orientation) {
            case 3:
                ctx.rotate(180 * Math.PI / 180);
                ctx.drawImage(image, -cvs.width, -cvs.height, cvs.width, cvs.height);
                break;
            case 6:
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(image, 0, -cvs.width, cvs.height, cvs.width);
                break;
            case 8:
                ctx.rotate(270 * Math.PI / 180);
                ctx.drawImage(image, -cvs.height, 0, cvs.height, cvs.width);
                break;
            case 2:
                ctx.translate(cvs.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(image, 0, 0, cvs.width, cvs.height);
                break;
            case 4:
                ctx.translate(cvs.width, 0);
                ctx.scale(-1, 1);
                ctx.rotate(180 * Math.PI / 180);
                ctx.drawImage(image, -cvs.width, -cvs.height, cvs.width, cvs.height);
                break;
            case 5:
                ctx.translate(cvs.width, 0);
                ctx.scale(-1, 1);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(image, 0, -cvs.width, cvs.height, cvs.width);
                break;
            case 7:
                ctx.translate(cvs.width, 0);
                ctx.scale(-1, 1);
                ctx.rotate(270 * Math.PI / 180);
                ctx.drawImage(image, -cvs.height, 0, cvs.height, cvs.width);
                break;
            default:
                ctx.drawImage(image, 0, 0, cvs.width, cvs.height);
        }
        return cvs;
    });
}
;

// CONCATENATED MODULE: ./src/urltoBlob.ts
/**
 * 通过一个图片的url加载所需要的File（Blob）对象
 *
 * @param {string} url - 图片URL
 * @returns {Promise(Blob)}
 *
 */
function urltoBlob(url) {
    return fetch(url).then(response => response.blob());
}
;

// CONCATENATED MODULE: ./src/urltoImage.ts
/**
 * 通过一个图片的url加载所需要的image对象
 *
 * @param {string} url - 图片URL
 * @returns {Promise(Image)}
 */
function urltoImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('urltoImage(): Image failed to load, please check the image URL'));
        img.src = url;
    });
}
;

// CONCATENATED MODULE: ./src/index.ts
var src_awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};











/**
 * 压缩File（Blob）对象
 * @param {Blob} file - 一个File（Blob）对象
 * @param {(number|object)} config - 如果传入是number类型，传入范围 0-1，表示图片压缩质量,默认0.92；也可以传入object类型，以便更详细的配置
 * @example
 * 		imageConversion.compress(file,0.8)
 *
 * 		imageConversion.compress(file,{
 * 			quality: 0.8, //图片压缩质量
 * 			type："image/png", //转换后的图片类型，选项有 "image/png", "image/jpeg", "image/gif"
 * 			width: 300, //生成图片的宽度
 * 			height：200， //生产图片的高度
 * 			scale: 0.5， //相对于原始图片的缩放比率,设置config.scale后会覆盖config.width和config.height的设置；
 * 			orientation:2, //图片旋转方向
 * 		})
 *
 * @returns {Promise(object)}
 */
function compress(file, config = {}) {
    return src_awaiter(this, void 0, void 0, function* () {
        if (!(file instanceof Blob)) {
            throw new Error('compress(): First arg must be a Blob object or a File object.');
        }
        if (typeof config !== 'object') {
            config = Object.assign({
                quality: config,
            });
        }
        config.quality = Number(config.quality);
        if (Number.isNaN(config.quality)) {
            return file;
        }
        const dataURL = yield filetoDataURL(file);
        let originalMime = dataURL.split(',')[0].match(/:(.*?);/)[1]; // 原始图像图片类型
        let mime = EImageType.JPEG; // 默认压缩类型
        if (checkImageType(config.type)) {
            mime = config.type;
            originalMime = config.type;
        }
        const image = yield dataURLtoImage(dataURL);
        const canvas = yield imagetoCanvas(image, Object.assign({}, config));
        const compressDataURL = yield canvastoDataURL(canvas, config.quality, mime);
        const compressFile = yield dataURLtoFile(compressDataURL, originalMime);
        if (compressFile.size > file.size) {
            return { 'file': file, 'scale': 'bad' };
        }
        return { 'file': compressFile, 'scale': 'good' };
    });
}
;
/**
 * 根据体积压缩File（Blob）对象
 *
 * @param {Blob} file - 一个File（Blob）对象
 * @param {(number|object)} config - 如果传入是number类型，则指定压缩图片的体积,单位Kb;也可以传入object类型，以便更详细的配置
 * 		@param {number} size - 指定压缩图片的体积,单位Kb
 * 		@param {number} accuracy - 相对于指定压缩体积的精确度，范围0.8-0.99，默认0.95；
 *        如果设置 图片体积1000Kb,精确度0.9，则压缩结果为900Kb-1100Kb的图片都算合格；
 * @example
 *  	imageConversion.compress(file,100) //压缩后图片大小为100kb
 *
 * 		imageConversion.compress(file,{
 * 			size: 100, //图片压缩体积，单位Kb
 * 			accuracy: 0.9, //图片压缩体积的精确度，默认0.95
 * 			type："image/png", //转换后的图片类型，选项有 "image/png", "image/jpeg", "image/gif"
 * 			width: 300, //生成图片的宽度
 * 			height: 200, //生产图片的高度
 * 			scale: 0.5, //相对于原始图片的缩放比率,设置config.scale后会覆盖config.width和config.height的设置；
 * 			orientation:2, //图片旋转方向
 * 		})
 *
 * @returns {Promise(object)}
 */
function compressAccurately(file, config = {}) {
    return src_awaiter(this, void 0, void 0, function* () {
        if (!(file instanceof Blob)) {
            throw new Error('compressAccurately(): First arg must be a Blob object or a File object.');
        }
        if (typeof config !== 'object') {
            config = Object.assign({
                size: config,
            });
        }
        // 如果指定体积不是数字或者数字字符串，则不做处理
        config.size = Number(config.size);
        if (Number.isNaN(config.size)) {
            return file;
        }
        // 如果指定体积大于原文件体积，则不做处理；
        if (config.size * 1024 > file.size) {
            return file;
        }
        config.accuracy = Number(config.accuracy);
        if (!config.accuracy
            || config.accuracy < 0.8
            || config.accuracy > 0.99) {
            config.accuracy = 0.95; // 默认精度0.95
        }
        const resultSize = {
            max: config.size * (2 - config.accuracy) * 1024,
            accurate: config.size * 1024,
            min: config.size * config.accuracy * 1024,
        };
        const dataURL = yield filetoDataURL(file);
        let originalMime = dataURL.split(',')[0].match(/:(.*?);/)[1]; // 原始图像图片类型
        let mime = EImageType.JPEG;
        if (checkImageType(config.type)) {
            mime = config.type;
            originalMime = config.type;
        }
        const image = yield dataURLtoImage(dataURL);
        const canvas = yield imagetoCanvas(image, Object.assign({}, config));
        /**
         * 经过测试发现，blob.size与dataURL.length的比值约等于0.75
         * 这个比值可以同过dataURLtoFile这个方法来测试验证
         * 这里为了提高性能，直接通过这个比值来计算出blob.size
         */
        const proportion = 0.75;
        let imageQuality = 0.5;
        let compressDataURL;
        const tempDataURLs = [null, null];
        /**
         * HTMLCanvasElement.toBlob()以及HTMLCanvasElement.toDataURL()压缩参数
         * 的最小细粒度为0.01，而2的7次方为128，即只要循环7次，则会覆盖所有可能性
         */
        for (let x = 1; x <= 7; x++) {
            compressDataURL = yield canvastoDataURL(canvas, imageQuality, mime);
            const CalculationSize = compressDataURL.length * proportion;
            // 如果到循环第七次还没有达到精确度的值，那说明该图片不能达到到此精确度要求
            // 这时候最后一次循环出来的dataURL可能不是最精确的，需要取其周边两个dataURL三者比较来选出最精确的；
            if (x === 7) {
                if (resultSize.max < CalculationSize || resultSize.min > CalculationSize) {
                    compressDataURL = [compressDataURL, ...tempDataURLs]
                        .filter(i => i) // 去除null
                        .sort((a, b) => Math.abs(a.length * proportion - resultSize.accurate)
                        - Math.abs(b.length * proportion - resultSize.accurate))[0];
                }
                break;
            }
            if (resultSize.max < CalculationSize) {
                tempDataURLs[1] = compressDataURL;
                imageQuality -= Math.pow(0.5, (x + 1));
            }
            else if (resultSize.min > CalculationSize) {
                tempDataURLs[0] = compressDataURL;
                imageQuality += Math.pow(0.5, (x + 1));
            }
            else {
                break;
            }
        }
        const compressFile = yield dataURLtoFile(compressDataURL, originalMime);
        // 如果压缩后体积大于原文件体积，则返回源文件；
        if (compressFile.size > file.size) {
            return { 'file': file, 'scale': 'bad' };
        }
        return { 'file': compressFile, 'scale': 'good' };
    });
}
;




/***/ })
/******/ ]);
});