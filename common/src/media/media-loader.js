import { BlobManager } from '../transport/blob-manager.js';
import { loadText, loadUint8Array } from '../transport/blob-reader.js';
import { getDimensions, getOrientation } from './jpeg-analyser.js';
import { captureFrame } from './frame-grabber.js';
import { getOrientationMatrix, invertMatrix, transformRect } from './image-orientation.js';
import { CordovaFile } from '../transport/cordova-file.js';

/**
 * Load an image
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Promise<HTMLImageElement}
 */
async function loadImage(blob) {
  let url;
  if (typeof(blob) === 'string') {
    url = blob;
  } else {
    if (blob instanceof CordovaFile) {
      let arrayBuffer = await blob.getArrayBuffer();
      blob = new Blob([ arrayBuffer ], { type: blob.type });
    }
    url = BlobManager.manage(blob);
  }
  return new Promise((resolve, reject) => {
    let image = document.createElement('IMG');
    image.src = url;
    image.onload = function(evt) {
      resolve(image);
    };
    image.onerror = function(evt) {
      console.log('load image error', evt.message)
      reject(new Error(`Unable to load ${url}`));
    };
  });
}

/**
 * Load an video
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Promise<HTMLVideoElement}
 */
async function loadVideo(blob) {
  if (/iPhone/i.test(navigator.userAgent)) {
    // iPhone doesn't allow loading of video programmatically
    return new Error('Cannot load video on iPhone');
  }
  let url;
  if (typeof(blob) === 'string') {
    url = blob;
  } else {
    url = BlobManager.manage(blob);
  }
  return new Promise((resolve, reject) => {
    let video = document.createElement('VIDEO');
    video.src = url;
    video.preload = true;
    video.onloadeddata = function(evt) {
      resolve(video);
    };
    video.onerror = function(evt) {
      reject(new Error(`Unable to load ${url}`));
    };
  });
}

/**
 * Load an audio
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Promise<HTMLAudioElement}
 */
async function loadAudio(blob) {
  let url;
  if (typeof(blob) === 'string') {
    url = blob;
  } else {
    url = BlobManager.manage(blob);
  }
  return new Promise((resolve, reject) => {
    let audio = document.createElement('AUDIO');
    audio.src = url;
    audio.preload = true;
    audio.onloadeddata = function(evt) {
      resolve(audio);
    };
    audio.onerror = function(evt) {
      reject(new Error(`Unable to load ${url}`));
    };
  });
}

/**
 * Load an SVG picture
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Promise<HTMLImageElement}
 */
async function loadSVG(blob) {
  let xml = await loadText(blob);
  let parser = new DOMParser;
  let doc = parser.parseFromString(xml, 'text/xml');
  let svg = doc.getElementsByTagName('svg')[0];
  if (!svg) {
    throw new Error('Invalid SVG document');
  }
  return svg;
}

/**
 * Obtain dimensions of image
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Object}
 */
async function getImageMetadata(blob) {
  if (typeof(blob) === 'string') {
    try {
      blob = await BlobManager.fetch(blob);
    } catch (err) {
      // we might not be able to fetch the file as a blob
      // due to cross-site restriction
      let img = await loadImage(blob);
      return {
        width: img.naturalWidth,
        height: img.naturalHeight,
        format: guessFileFormat(url, 'image')
      };
    }
  }
  let format = extractFileFormat(blob.type);
  if (format === 'svg') {
    // naturalWidth and naturalHeight aren't correct when the SVG file
    // doesn't have width and height set
    let svg = await loadSVG(blob);
    let width = svg.width.baseVal.value;
    let height = svg.height.baseVal.value;
    let viewBox = svg.viewBox.baseVal;
    if (!width) {
      width = viewBox.width;
    }
    if (!height) {
      height = viewBox.height;
    }
    if (!width) {
      width = 1000;
    }
    if (!height) {
      height = 1000;
    }
    return { width, height, format };
  } else if (format === 'jpeg') {
    let bytes = await loadUint8Array(blob);
    let dimensions = getDimensions(bytes);
    let orientation = getOrientation(bytes);
    if (!dimensions) {
      throw new Error('Invalid JPEG file');
    }
    let width, height;
    if (orientation >= 5) {
      width = dimensions.height;
      height = dimensions.width;
    } else {
      width = dimensions.width;
      height = dimensions.height;
    }
    return { width, height, format };
  } else {
    let img = await loadImage(blob);
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      format: format,
    }
  }
}

/**
 * Obtain dimensions and duration of video
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Object}
 */
async function getVideoMetadata(blob) {
  if (typeof(blob) === 'string') {
    try {
      blob = await BlobManager.fetch(blob);
    } catch (err) {
      // we might not be able to fetch the file as a blob
      // due to cross-site restriction
      const video = await loadVideo(blob);
      const posterBlob = await captureFrame(video);
      return {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: Math.round(video.duration * 1000),
        format: guessFileFormat(url, 'video'),
        poster: posterBlob,
      };
    }
  }
  const video = await loadVideo(blob);
  const posterBlob = await captureFrame(video);
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    duration: Math.round(video.duration * 1000),
    format: extractFileFormat(blob.type),
    poster: posterBlob,
  };
}

/**
 * Obtain duration of audio
 *
 * @param  {Blob|CordovaFile|string} blob
 *
 * @return {Object}
 */
async function getAudioMetadata(blob) {
  if (typeof(blob) === 'string') {
    try {
      blob = await BlobManager.fetch(blob);
    } catch (err) {
      // we might not be able to fetch the file as a blob
      // due to cross-site restriction
      let audio = await loadAudio(blob);
      return {
        duration: Math.round(audio.duration * 1000),
        format: guessFileFormat(url, 'image'),
      };
    }
  }
  let audio = await loadAudio(blob);
  return {
    duration: Math.round(audio.duration * 1000),
    format: extractFileFormat(blob.type),
  };
}

/**
 * Guess image format based on file extension
 *
 * @param  {string} url
 * @param  {string} category
 *
 * @return {string}
 */
function guessFileFormat(url, category) {
  const m = /\.(\w+)$/.execute(url.replace(/#.*/, '').replace(/\?.*/, ''));
  if (m) {
    const ext = m[1].toLowerCase();
    switch (ext) {
      case 'jpg': return 'jpeg';
      default: return ext;
    }
  } else {
    switch (category) {
      case 'image': return 'jpeg';
      case 'video': return 'mp4';
      case 'audio': return 'mp3';
      default: return '';
    }
  }
}

/**
 * Obtain file category from MIME type
 *
 * @param  {string} mimeType
 *
 * @return {string}
 */
function extractFileCategory(mimeType) {
  const parts = mimeType.split('/');
  return parts[0].toLowerCase();
}

/**
 * Obtain file format from MIME type
 *
 * @param  {string} mimeType
 *
 * @return {string}
 */
function extractFileFormat(mimeType) {
  const parts = mimeType.split('/');
  const format = (parts[1]) ? parts[1].toLowerCase() : '';
  switch (format) {
    case 'svg+xml':
      return 'svg';
    default:
      return format;
  }
}

/**
 * Extract a 4x4 mosiac of an image file
 *
 * @param  {Blob|CordovaFile|string} blob
 * @param  {Object} rect
 *
 * @return {Object}
 */
async function extractMosaic(blob, rect) {
  try {
    if (typeof(blob) === 'string') {
      blob = await BlobManager.fetch(blob);
    }
    // load the image and its bytes
    let image = await loadImage(blob);
    let bytes = await loadUint8Array(blob);
    let orientation = JPEGAnalyser.getOrientation(bytes) || 1;

    // correct for orientation and apply clipping
    let fullCanvas = document.createElement('CANVAS');
    fullCanvas.width = rect.width;
    fullCanvas.height = rect.height;
    let matrix = getOrientationMatrix(orientation, image.naturalWidth, image.naturalHeight);
    let inverse = invertMatrix(matrix);
    let src = transformRect(inverse, rect);
    let dst = transformRect(inverse, { left: 0, top: 0, width: fullCanvas.width, height: fullCanvas.height });
    let fullContext = fullCanvas.getContext('2d');
    fullContext.transform.apply(fullContext, matrix);
    fullContext.drawImage(image, src.left, src.top, src.width, src.height, dst.left, dst.top, dst.width, dst.height);

    // shrink to 48x48 first
    let miniCanvas = document.createElement('CANVAS');
    miniCanvas.width = miniCanvas.height = 48;
    let miniContext = miniCanvas.getContext('2d');
    miniContext.drawImage(fullCanvas, 0, 0, fullCanvas.width, fullCanvas.height, 0, 0, miniCanvas.width, miniCanvas.height);

    // then shrink further to 4x4
    let microCanvas = document.createElement('CANVAS');
    microCanvas.width = microCanvas.height = 4;
    let microContext = miniCanvas.getContext('2d');
    miniContext.drawImage(miniCanvas, 0, 0, miniCanvas.width, miniCanvas.height, 0, 0, microCanvas.width, microCanvas.height);

    let imageData = microContext.getImageData(0, 0, microCanvas.width, microCanvas.height);
    let pixels = imageData.data;
    if (pixels.length >= 64) {
      let colors = [];
      for (let i = 0; i < 16; i++) {
        let r = pixels[i * 4 + 0];
        let g = pixels[i * 4 + 1];
        let b = pixels[i * 4 + 2];
        let rgb = (r << 16) | (g << 8) | (b << 0);
        colors.push(rgb.toString(16));
      }
      return colors;
    }
  } catch (err) {
    console.error(err);
  }
}

/**
 * Return information about a MediaFile
 *
 * @param  {MediaFile} mediaFile
 *
 * @return {MediaFileData}
 */
function getFormatData(mediaFile) {
  return new Promise((resolve, reject) => {
    mediaFile.getFormatData(resolve, reject);
  });
}

export {
  loadImage,
  loadVideo,
  loadAudio,
  loadSVG,
  getImageMetadata,
  getVideoMetadata,
  getAudioMetadata,
  extractFileCategory,
  extractFileFormat,
  extractMosaic,
  getFormatData,
};
