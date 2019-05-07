import _ from 'lodash';
import Bluebird from 'bluebird'
import FS from 'fs'; Bluebird.promisifyAll(FS);
import Request from 'request';
import Crypto from 'crypto';
import { PassThrough } from 'stream';
import HTTPError from '../common/errors/http-error.mjs';

/**
 * Save file to cache folder, using the MD5 hash of its content as name
 *
 * @param  {String} srcPath
 * @param  {String} dstFolder
 *
 * @return {String}
 */
async function saveFile(srcPath, dstFolder) {
    let hash = await hashFile(srcPath);
    try {
        await FS.statAsync(dstPath);
    } catch (err) {
        let inputStream = FS.createReadStream(srcPath);
        let outputStream = FS.createWriteStream(dstPath);
        await new Promise((resolve, reject) => {
            inputStream.once('error', reject);
            outputStream.once('finish', resolve);
            inputStream.pipe(outputStream);
        });
    }
    return hash;
}

/**
 * Rename a file, deleting it if the destination already exists
 *
 * @param  {String} srcPath
 * @param  {String} dstPath
 *
 * @return {Promise}
 */
async function moveFile(srcPath, dstPath) {
    if (srcPath === dstPath) {
        return;
    }
    try {
        // delete source file if dest file exists already
        await FS.statAsync(dstPath);
        await FS.unlinkAsync(srcPath);
    } catch (err) {
        try {
            await FS.renameAsync(srcPath, dstPath);
        } catch (err) {
            // can't rename accross volumes
            let readStream = FS.createReadStream(srcPath);
            let writeStream = FS.createWriteStream(dstPath);
            await new Promise((resolve, reject) => {
                writeStream.once('error', reject);
                writeStream.once('finish', resolve);
                readStream.once('error', reject);
                readStream.once('close', async () => {
                    await FS.unlinkAsync(srcPath);
                });
                readStream.pipe(writeStream);
            });
        }
    }
}

/**
 * Generate MD5 hash of file contents
 *
 * @param  {String} srcPath
 *
 * @return {Promise<String>}
 */
async function hashFile(srcPath) {
    let hash = Crypto.createHash('md5');
    let stream = FS.createReadStream(srcPath);
    await new Promise((resolve, reject) => {
        stream.once('error', reject);
        hash.once('readable', resolve);
        stream.pipe(hash);
    });
    return hash.read().toString('hex');
}


/**
 * Download file file off the Internet
 *
 * @param  {String} url
 * @param  {String} dstFolder
 *
 * @return {Promise<String>}
 */
async function downloadFile(url, dstFolder) {
    let previousDownload = await recallDownload(url, dstFolder);
    let headers = await getRetrievalHeaders(previousDownload, dstFolder);
    let request = Request.get({ url, headers });
    let passThru = new PassThrough;
    let response = await new Promise((resolve, reject) => {
        request.once('response', resolve);
        request.once('error', reject);
        request.pipe(passThru);
    });
    if (response.statusCode === 200) {
        // stream contents into temp file
        let tempPath = makeTempPath(dstFolder, url);
        let tempFile = FS.createWriteStream(tempPath);
        let tempFilePromise = new Promise((resolve, reject) => {
            tempFile.once('finish', resolve);
            tempFile.once('error', reject);
        });
        //  calculate the MD5 hash at the same time
        let md5Hash = Crypto.createHash('md5');
        let md5HashPromise = new Promise((resolve, reject) => {
            md5Hash.once('readable', resolve);
            md5Hash.once('error', reject);
        });
        passThru.pipe(md5Hash);
        passThru.pipe(tempFile);
        await Promise.all([ tempFilePromise, md5HashPromise ]);

        // rename file to its MD5 hash
        let hash = md5Hash.read().toString('hex');
        let dstPath = `${dstFolder}/${hash}`;
        await moveFile(tempPath, dstPath);
        await rememberDownload(url, dstFolder, hash, response.headers);
        return dstPath;
    } else if (response.statusCode === 204) {
        return null;
    } else if (response.statusCode === 304) {
        return previousDownload.path;
    } else if (response.statusCode >= 400) {
        throw new HTTPError(response.statusCode);
    } else {
        throw new HTTPError(500);
    }
}

/**
 * Preserve user-uploaded file or a file at a URL
 *
 * @param  {File|undefined} file
 * @param  {String|undefined} url
 * @param  {String} dstFolder
 *
 * @return {Promise<String|null>}
 */
async function preserveFile(file, url, dstFolder) {
    if (file) {
        let srcPath = file.path;
        let hash = await hashFile(srcPath);
        let dstPath = `${dstFolder}/${hash}`;
        await moveFile(srcPath, dstPath);
        return dstPath;
    } else if (url) {
        return downloadFile(url, dstFolder);
    }
    return null;
}

/**
 * Generate MD5 hash
 *
 * @param  {String|Buffer} data
 *
 * @return {String}
 */
function md5(data) {
    let hash = Crypto.createHash('md5').update(data);
    return hash.digest('hex');
}

/**
 * Return a temporary path for a URL
 *
 * @param  {String} dstFolder
 * @param  {String} url
 * @param  {String} ext
 *
 * @return {String}
 */
function makeTempPath(dstFolder, url, ext) {
    let date = (new Date).toISOString();
    let hash = md5(`${url} ${date}`);
    if (!ext) {
        ext = '';
    }
    return `${dstFolder}/${hash}${ext}`;
}

/**
 * Save information about a downloaded file
 *
 * @param  {String} url
 * @param  {String} dstFolder
 * @param  {String} hash
 * @param  {Object<String>} headers
 *
 * @return {Promise}
 */
async function rememberDownload(url, dstFolder, hash, headers) {
    try {
        let etag = headers['etag'];
        let mtime = headers['last-modified'];
        let type = headers['content-type'];
        let size = parseInt(headers['content-length']);
        let info = { url, hash, type, size, etag, mtime };
        let json = JSON.stringify(info, undefined, 2);
        let folder = `${dstFolder}/.url`;
        try {
            await FS.statAsync(folder);
        } catch (err) {
            await FS.mkdirAsync(folder);
        }
        let urlHash = md5(url);
        let path = `${dstFolder}/.url/${urlHash}`;
        return FS.writeFileAsync(path, json);
    } catch (err) {
        console.error(err);
    }
}

/**
 * Retrieve saved information about a previous download (if any)
 *
 * @param  {String} url
 * @param  {String} dstFolder
 *
 * @return {Promise<Object|undefined>}
 */
async function recallDownload(url, dstFolder) {
    try {
        let urlHash = md5(url);
        let path = `${dstFolder}/.url/${urlHash}`;
        let json = await FS.readFileAsync(path, 'utf-8');
        let info = JSON.parse(json);
        info.path = `${dstFolder}/${info.hash}`;

        // verify that the file is there
        if (info.size !== undefined) {
            let stats = await FS.statAsync(info.path);
            if (info.size !== stats.size) {
                throw new Error('Size mismatch');
            }
        }
        return info;
    } catch (err) {
    }
}

/**
 * Return HTTP headers for conditional download
 *
 * @param  {Object} previousDownload
 *
 * @return {Object|undefined}
 */
function getRetrievalHeaders(previousDownload) {
    if (previousDownload) {
        if (previousDownload.etag) {
            return {
                'If-None-Match': previousDownload.etag
            };
        } else if (previousDownload.mtime) {
            return {
                'If-Modified-Since': previousDownload.mtime
            };
        }
    }
}

export {
    moveFile,
    saveFile,
    hashFile,
    downloadFile,
    preserveFile,
    makeTempPath,
};