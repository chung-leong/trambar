import _ from 'lodash';
import Bluebird from 'bluebird';
import FS from 'fs'; Bluebird.promisifyAll(FS);
import Path from 'path';
import Express from 'express';
import CORS from 'cors';
import BodyParser from 'body-parser';
import Multer from 'multer';
import Moment from 'moment';
import DNSCache from 'dnscache';
import FileType from 'file-type';

import { Database } from './lib/database.mjs';
import { HTTPError } from './lib/errors.mjs';
import { TaskLog } from './lib/task-log.mjs';
import * as Shutdown from './lib/shutdown.mjs';

import * as CacheFolders from './lib/media-server/cache-folders.mjs';
import * as FileManager from './lib/media-server/file-manager.mjs';
import * as ImageManager from './lib/media-server/image-manager.mjs';
import * as VideoManager from './lib/media-server/video-manager.mjs';
import * as StockPhotoImporter from './lib/media-server/stock-photo-importer.mjs';

let server;
const cacheControl = {
  image: 'max-age=2592000, immutable',
  video: 'max-age=86400',
  audio: 'max-age=86400',
};

DNSCache({ enable: true, ttl: 300, cachesize: 100 });

async function start() {
  // make sure cache folders exist and stock photos are linked
  await CacheFolders.create();
  await StockPhotoImporter.importPhotos();

  // start up Express
  const app = Express();
  const upload = Multer({ dest: '/var/tmp' });
  app.use(CORS());
  app.use(BodyParser.json());
  app.set('json spaces', 2);
  app.get('/srv/media/images/:hash/original/:alias', handleImageRequest);
  app.get('/srv/media/images/:hash/:filename', handleImageRequest);
  app.get('/srv/media/images/:hash', handleImageRequest);
  app.get('/srv/media/videos/:hash/original/:alias', handleVideoRequest);
  app.get('/srv/media/videos/:hash', handleVideoRequest);
  app.get('/srv/media/audios/:hash/original/:alias', handleAudioRequest);
  app.get('/srv/media/audios/:hash', handleAudioRequest);
  app.get('/srv/media/cliparts/:filename', handleClipartRequest);
  app.post('/srv/media/images/upload/:schema/', upload.single('file'), handleImageUpload);
  app.post('/srv/media/videos/upload/:schema/', upload.single('file'), handleVideoUpload);
  app.post('/srv/media/videos/poster/:schema/', upload.single('file'), handleVideoPoster);
  app.post('/srv/media/audios/upload/:schema/', upload.single('file'), handleAudioUpload);
  app.post('/srv/media/audios/poster/:schema/', upload.single('file'), handleAudioPoster);
  app.post('/srv/media/stream/', upload.single('file'), handleStream);
  app.post('/internal/import', upload.single('file'), handleImageImport);
  await new Promise((resolve, reject) => {
    server = app.listen(80, () => {
      resolve();
      reject = null;
    });
    server.once('error', (evt) => {
      if (reject) {
        reject(new Error(evt.message));
      }
    })
  });
}

async function stop() {
  await Shutdown.close(server);
}

/**
 * Send a JSON object to browser
 *
 * @param  {Response} res
 * @param  {Object} result
 */
function sendJSON(res, result) {
  res.json(result);
}

/**
 * Send binary data to browser
 *
 * @param  {Response} res
 * @param  {Buffer} buffer
 * @param  {String} mimeType
 * @param  {String|undefined} cc
 */
function sendFile(res, buffer, mimeType, cc) {
  res.type(mimeType)
  if (cc) {
    res.set('Cache-Control', cc);
  }
  res.send(buffer);
}

/**
 * Send static file to browser
 *
 * @param  {Response} res
 * @param  {String} path
 * @param  {String|undefined} cc
 * @param  {String|undefined} filename
 *
 * @return {Promise}
 */
async function sendStaticFile(res, path, cc, filename) {
  const info = await getFileType(path);
  res.type(info.mime);
  if (cc) {
    res.set('Cache-Control', cc);
  }
  if (filename) {
    res.set('Content-disposition', `attachment; filename=${filename}`);
  }
  try {
    const stat = await FS.lstatAsync(path);
    if (stat.isSymbolicLink()) {
      // serve file through Express if it's a symlink, since it's probably
      // pointing to a file that only exist in this Docker container
      res.sendFile(path);
    } else {
      // ask Nginx to server the file
      const relPath = path.substr(CacheFolders.root.length + 1);
      const uri = `/srv/static_media/${relPath}`;
      res.set('X-Accel-Redirect', uri).end();
    }
  } catch (err) {
    sendError(res, new HTTPError(404));
  }
}

/**
 * Send error to browser as JSON object
 *
 * @param  {Response} res
 * @param  {Object} err
 */
function sendError(res, err) {
  let statusCode = err.statusCode;
  let message = err.message;
  if (!statusCode) {
    // not an expected error
    statusCode = 500;
    if (process.env.NODE_ENV === 'production') {
      message = 'Internal server error';
    } else {
      console.error(err);
    }
  }
  res.status(statusCode).json({ message });
}

/**
 * Handle image request
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleImageRequest(req, res) {
  try {
    const { hash, filename } = req.params;
    const path = `${CacheFolders.image}/${hash}`;
    if (filename) {
      const m = /([^.]*?)(\.(.+))?$/i.exec(filename);
      if (!m) {
        throw new HTTPError(400, 'Invalid filename');
      }
      const filters = m[1];
      let format = m[3];
      if (!format || format === 'jpg') {
        format = 'jpeg';
      }
      const buffer = await ImageManager.applyFilters(path, filters, format);
      sendFile(res, buffer, format, cacheControl.image);
    } else {
      await sendStaticFile(res, path, cacheControl.image);
    }
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Handle video request
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleVideoRequest(req, res) {
  try {
    const { hash } = req.params;
    const path = `${CacheFolders.video}/${hash}`;
    await sendStaticFile(res, path, cacheControl.video);
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Handle audio request
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleAudioRequest(req, res) {
  try {
    const { hash } = req.params;
    const path = `${CacheFolders.audio}/${hash}`;
    await sendStaticFile(res, path, cacheControl.audio);
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Handle clipart request
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleClipartRequest(req, res) {
  try {
    const { filename } = req.params;
    const path = Path.resolve(`../media/cliparts/${filename}`);
    const info = await getFileType(path);
    res.type(info.mime);
    res.set('Cache-Control', 'max-age=86400');
    res.sendFile(path);
  } catch (err) {
    sendError(res, new HTTPError(404));
  }
}

/**
 * Handle image upload, either attached file or a URL
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleImageUpload(req, res) {
  try {
    const { file } = req;
    const { url } = req.body;
    const { schema } = req.params;
    const { token } = req.query;
    const taskLog = await TaskLog.obtain(schema, token, 'add-image');
    try {
      const imagePath = await FileManager.preserveFile({ file, url }, CacheFolders.image, taskLog);
      if (!imagePath) {
        throw new HTTPError(400);
      }

      // save image metadata into the task object
      // a PostgreSQL stored-proc will then transfer that into objects
      // that contains the token
      taskLog.describe('extracting metadata from image');
      const metadata = await ImageManager.getImageMetadata(imagePath);
      const url = getFileURL(imagePath);
      taskLog.merge({
        url,
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        title: metadata.title,
      });
      const result = { url };
      sendJSON(res, result);
      await taskLog.finish('main');
    } catch (err) {
      await taskLog.abort(err);
      throw err;
    }
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Handle internal image import request from other part of system
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleImageImport(req, res) {
  const { file } = req;
  const { url, headers } = req.body;
  const taskLog = TaskLog.start('image-import', {
    file: (file) ? file.originalname : undefined,
    url,
  });
  try {
    const beginning = new Date;
    const imagePath = await FileManager.preserveFile({ file, url, headers }, CacheFolders.image, taskLog);
    if (!imagePath) {
      throw new HTTPError(400);
    }

    const metadata = await ImageManager.getImageMetadata(imagePath);
    const result = {
      type: 'image',
      url: getFileURL(imagePath),
      format: metadata.format,
      width: metadata.width,
      height: metadata.height,
    };
    sendJSON(res, result);

    const stats = await FS.statAsync(imagePath);
    if (stats.ctime > beginning) {
      taskLog.merge(result);
    }
    await taskLog.finish();
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
    await taskLog.abort(err);
  }
}

/**
 * Handle video upload
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleVideoUpload(req, res) {
  return handleMediaUpload(req, res, 'video');
}

/**
 * Handle video poster
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleVideoPoster(req, res) {
  return handleMediaPoster(req, res, 'video');
}

/**
 * Handle audio upload
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleAudioUpload(req, res) {
  return handleMediaUpload(req, res, 'audio');
}

/**
 * Handle audio upload
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleAudioPoster(req, res) {
  return handleMediaPoster(req, res, 'audio');
}

/**
 * Handle video or audio upload, either as attached file, a URL, or a stream
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleMediaUpload(req, res, type) {
  try {
    const { file } = req;
    const { url } = req.body;
    const schema = req.params.schema;
    const token = req.query.token;
    const streamID = req.body.stream;
    const generatePoster = !!req.body.generate_poster;
    const taskLog = await TaskLog.obtain(schema, token, `add-${type}`);
    let result;
    try {
      if (streamID) {
        // handle streaming upload--transcoding job has been created already
        const job = VideoManager.findTranscodingJob(streamID);
        if (!job) {
          throw new HTTPError(404);
        }
        monitorTranscodingJob(job, taskLog);
        result = {};
      } else {
        // transcode an uploaded file--move it into cache folder first
        const dstFolder = CacheFolders[type];
        const mediaPath = await FileManager.preserveFile({ file, url }, dstFolder, taskLog);
        if (!mediaPath) {
          throw new HTTPError(400);
        }

        const url = getFileURL(mediaPath);
        // create the transcoding job, checking if it exists already on
        // the off-chance the same file is uploaded twice at the same time
        const jobID = Path.basename(mediaPath);
        if (!VideoManager.findTranscodingJob(jobID)) {
          const job = await VideoManager.startTranscodingJob(mediaPath, type, jobID);
          if (generatePoster) {
            await VideoManager.requestPosterGeneration(job);
          }
          monitorTranscodingJob(job, taskLog);
        }
        result = { url };
      }
      sendJSON(res, result);
    } catch (err) {
      await taskLog.abort(err);
      throw err;
    }
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Monitor a transcoding job, saving progress into a task object
 *
 * @param  {Object} job
 * @param  {TaskLog} taskLog
 */
async function monitorTranscodingJob(job, taskLog) {
  // monitor transcoding progress
  job.onProgress = (evt) => { taskLog.report(evt.target.progress) };

  // wait for poster to be generated
  if (job.posterFile) {
    taskLog.describe(`generating poster`);
    await VideoManager.awaitPosterGeneration(job);
    if (!job.aborted) {
      taskLog.merge({
        poster_url: getFileURL(job.posterFile.path),
        width: job.posterFile.width,
        height: job.posterFile.height,
      });
      await taskLog.finish('poster');
    } else {
      await taskLog.abort(new Error('Transcoding aborted'));
    }
  }

  // wait for transcoding to finish
  taskLog.describe(`transcoding ${job.type}`);
  await VideoManager.awaitTranscodingJob(job);
  if (!job.aborted) {
    // save URL and information about available version to task object
    // (doing so transfer these properties into details.resources of
    // object that has the Task object's token as payload_token)
    const versions = _.map(job.outputFiles, (outputFile) => {
      return {
        name: outputFile.name,
        width: outputFile.width,
        height: outputFile.height,
        bitrates: {
          video: outputFile.videoBitrate,
          audio: outputFile.audioBitrate,
        },
        format: outputFile.format,
      };
    });
    taskLog.merge({
      url: getFileURL(job.inputFile.path),
      duration: job.inputFile.duration,
      width: job.inputFile.width,
      height: job.inputFile.height,
      bitrates: {
        video: job.inputFile.videoBitrate,
        audio: job.inputFile.audioBitrate,
      },
      versions,
    });
    await taskLog.finish('main');
  } else {
    await taskLog.abort(new Error('Transcoding aborted'));
  }
}

/**
 * Handle video or audio poster upload
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleMediaPoster(req, res, type) {
  try {
    const { file } = req;
    const { url } = req.body;
    const { schema } = req.params;
    const { token } = req.query;
    const taskLog = await TaskLog.obtain(schema, token, `add-${type}`);
    try {
      const imagePath = await FileManager.preserveFile({ file, url }, CacheFolders.image, taskLog);
      if (!imagePath) {
        throw new HTTPError(400);
      }
      const url = getFileURL(imagePath);
      const metadata = await ImageManager.getImageMetadata(imagePath);
      sendJSON(res, { url });

      taskLog.merge({
        poster_url: url,
        width: metadata.width,
        height: metadata.height,
      });
      await taskLog.finish('poster');
    } catch (err) {
      await taskLog.abort(err);
    }
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Handle the addition of a new chunk to a stream
 *
 * @param  {Request} req
 * @param  {Response} res
 */
async function handleStream(req, res) {
  try {
    const jobID = req.query.id;
    const file = req.file;
    const abort = !!req.body.abort;
    const chunk = parseInt(req.body.chunk);
    const generatePoster = !!req.body.generate_poster;

    let job = VideoManager.findTranscodingJob(jobID);
    if (chunk === 0) {
      if (job) {
        throw new HTTPError(409);
      }
      if (!file) {
        throw new HTTPError(400);
      }
      // create the job
      const type = _.first(_.split(file.mimetype, '/'));
      if (type !== 'video' && type !== 'audio') {
        throw new HTTPError(400);
      }
      job = await VideoManager.startTranscodingJob(null, type, jobID);
      if (generatePoster) {
        await VideoManager.requestPosterGeneration(job);
      }
    } else {
      if (!job) {
        throw new HTTPError(404);
      }
    }
    if (file) {
      VideoManager.transcodeSegment(job, file);
    } else {
      VideoManager.endTranscodingJob(job, abort);
    }
    sendJSON(res, { status: 'OK' });
  } catch (err) {
    sendError(res, err);
  }
}

/**
 * Return the file extension and mime type
 *
 * @param  {String} path
 *
 * @return {Promise<Object>}
 */
async function getFileType(path) {
  const fd = await FS.openAsync(path, 'r');
  try {
    const len = 1024;
    const buffer = Buffer.alloc(len);
    await FS.readAsync(fd, buffer, 0, len, 0);
    const info = FileType(buffer);
    if (info.mime === 'application/xml') {
      const text = buffer.toString('utf-8');
      if (text.indexOf('<svg')) {
        info.mime = 'image/svg+xml';
      }
    }
    if (!info) {
      info = {
        ext: undefined,
        mime: 'application/octet-stream'
      };
    }
    return info;
  } finally {
    FS.closeAsync(fd);
  }
}

/**
 * Return the URL of a file in the cache folder
 *
 * @param  {String} path
 *
 * @return {String}
 */
function getFileURL(path) {
  return `/srv/media/${Path.relative(CacheFolders.root, path)}`
}

if ('file://' + process.argv[1] === import.meta.url) {
  start();
  Shutdown.addListener(stop);
}

export {
  start,
  stop,
};