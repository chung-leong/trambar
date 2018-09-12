import _ from 'lodash';
import EnvironmentMonitor from 'env/environment-monitor';
import LocaleManager from 'locale/locale-manager';
import RouteManager from 'relaks-route-manager';
import PayloadManager from 'transport/payload-manager';
import PushNotifier from 'transport/push-notifier';
import WebsocketNotifier from 'transport/websocket-notifier';
import RemoteDataSource from 'data/remote-data-source';
import IndexedDBCache from 'data/indexed-db-cache';
import LocalStorageCache from 'data/local-storage-cache';
import BlobManager from 'transport/blob-manager';
import CORSRewriter from 'routing/cors-rewriter';

import languages from 'languages';

const SettingsLocation = {
    schema: 'local',
    table: 'settings'
};

const SessionLocation = {
    schema: 'local',
    table: 'session',
}

function start(cfg) {
    let envMonitor = new EnvironmentMonitor({});
    let routeManager = new RouteManager({
        basePath: cfg.basePath,
        routes: cfg.routes,
        // CORSRewriter will extract site address from the URL when there's one
        // and default to the site address of the page when there isn't; the
        // address will appear in .context
        rewrites: [ CORSRewriter ],
    });
    let localeManager = new LocaleManager({
        directory: languages
    });
    let cache;
    if (IndexedDBCache.isAvailable()) {
        cache = new IndexedDBCache()
    } else {
        cache = new LocalStorageCache();
    }
    let dataSource = new RemoteDataSource({
        discoveryFlags: cfg.discoveryFlags,
        retrievalFlags: cfg.retrievalFlags,
        cache,
    });
    let notifier;
    if (process.env.PLATFORM === 'cordova') {
        notifier = new PushNotifier({
        });
    } else {
        notifier = new WebsocketNotifier({
        });
    }
    let payloadManager = new PayloadManager({
        uploadURL: getUploadURL,
        streamURL: getStreamURL,
    });
    envMonitor.activate();
    routeManager.activate();
    if (envMonitor.online) {
        dataSource.activate();
        payloadManager.activate();
        notifier.activate();
    }

    // look for sign in page
    let signInPageName = _.findKey(cfg.routes, (route) => {
        return route.public && route.signIn;
    });

    envMonitor.addEventListener('change', (evt) => {
        if (envMonitor.online) {
            dataSource.activate();
            payloadManager.activate();
            notifier.activate();
        } else {
            dataSource.deactivate();
            payloadManager.deactivate();
            notifier.deactivate();
        }
    });
    routeManager.addEventListener('beforechange', (evt) => {
        // see if a page requires authentication
        let { name, context, route } = evt;
        if (route.public !== true) {
            // page requires authorization--see if it's been acquired already
            let { address } = context;
            let location = { address };
            if (!dataSource.hasAuthorization(location)) {
                // nope, we need to postpone the page switch
                // first, see if there's a saved session
                let promise = loadSession(address).then((session) => {
                    if (!dataSource.restoreAuthorization(location, session)) {
                        // there was none or it's expired--show the sign-in page
                        return evt.substitute(signInPageName).then(() => {
                            // ask the data-source to request authentication
                            return dataSource.requestAuthentication(location);
                        });
                    }
                });
                evt.postponeDefault(promise);
            }
        }
    });
    dataSource.addEventListener('authentication', (evt) => {
        // go to the sign-in page if we aren't there already
        if (routeManager.name !== signInPageName) {
            routeManager.substitute(signInPageName);
        }
    });
    dataSource.addEventListener('authorization', (evt) => {

    });
    dataSource.addEventListener('expiration', (evt) => {

    });
    notifier.addEventListener('notify', (evt) => {
        if (process.env.NODE_ENV !== 'production') {
            _.each(evt.changes, (change) => {
                console.log(`Change notification: ${change.schema}.${change.table} ${change.id}`);
            });
        }

        // invalidate database queries
        dataSource.invalidate(evt.changes);
    });
    notifier.addEventListener('revalidation', (evt) => {
        // force cache revalidation
    });
    localeManager.addEventListener('change', (evt) => {
        // save the selected locale after it's been changed
        let { localeCode, browserLocaleCode } = localeManager;
        if (localeCode == browserLocaleCode) {
            removeLocale();
        } else {
            saveLocale(localeCode);
        }
    });
    payloadManager.addEventListener('permission', (evt) => {
        // add a task object in the backend so upload would be accepted
        let promise = addPayloadTasks(evt.destination, evt.payloads)
        evt.postponeDefault(promise);
    });
    payloadManager.addEventListener('update', (evt) => {
        // update payloads using information from the backend
        let promise = updateBackendProgress(evt.destination, evt.payloads);
        evt.postponeDefault(promise);
    });
    payloadManager.addEventListener('uploadpart', (evt) => {
        // associate a remote URL with a blob after it's been uploaded, so we
        // don't need to download the file again when the need arises
        let { destination, part, response } = evt;
        if (response && response.url) {
            if (part.file) {
                let { address } = destination;
                let url = url + response.url;
                BlobManager.associate(part.file, url);
            }
        }
    });

    return loadLocale().then((savedLocale) => {
        return localeManager.start(savedLocale);
    }).then(() => {
        return routeManager.start();
    }).then(() => {
        return {
            envMonitor,
            routeManager,
            localeManager,
            payloadManager,
            dataSource,
            notifier,
        };
    });

    function loadLocale() {
        let criteria = { key: 'language' };
        let query = Object.assign({ criteria }, SettingsLocation);
        return dataSource.find(query).then((records) => {
            let record = records[0];
            if (record) {
                return record.selectedLocale;
            }
        });
    }

    function saveLocale(localeCode) {
        var record = {
            key: 'language',
            selectedLocale: localeCode
        };
        return dataSource.save(SettingsLocation, [ record ]);
    }

    function removeLocale(localeCode) {
        var record = {
            key: 'language',
        };
        return dataSource.remove(SettingsLocation, [ record ]);
    }

    function loadSession(address) {
        let criteria = { key: address };
        let query = Object.assign({ criteria }, SessionLocation);
        return dataSource.find(query).then((records) => {
            var record = records[0];
            if (record) {
                return {
                    address: record.key,
                    handle: record.handle,
                    token: record.token,
                    user_id: record.user_id,
                    etime: record.etime,
                };
            }
        });
    }

    function saveSession(session) {
        let record = {
            key: session.address,
            handle: session.handle,
            token: session.token,
            user_id: session.user_id,
            etime: session.etime,
        };
        return dataSource.save(SessionLocation, [ record ]).return();
    }

    function removeSession(address) {
        let record = {
            key: address,
        };
        return dataSource.remove(SessionLocation, [ record ]).return();
    }

    function getUploadURL(destination, id, type, part) {
        let { address, schema } = destination;
        let uri;
        switch (type) {
            case 'image':
                if (part === 'main') {
                    uri = `/srv/media/images/upload/${schema}/`;
                }
                break;
            case 'video':
                if (part === 'main') {
                    uri = `/srv/media/videos/upload/${schema}/`;
                } else if (part === 'poster') {
                    uri = `/srv/media/videos/poster/${schema}/`;
                }
                break;
            case 'audio':
                if (part === 'main') {
                    uri = `/srv/media/audios/upload/${schema}/`;
                } else if (part === 'poster') {
                    uri = `/srv/media/audios/poster/${schema}/`;
                }
                break;
            case 'website':
                if (part === 'poster') {
                    uri = `/srv/media/html/poster/${schema}/`;
                }
                break;
        }
        return (uri) ? `${address}${uri}?token=${id}` : null;
    }

    function getStreamURL(destination, id) {
        let { address, schema } = destination;
        return `${address}/srv/media/stream/?id=${id}`;
    }

    function addPayloadTasks(destination, payloads) {
        let { address, schema } = destination;
        let tasks = _.map(payloads, (payload) => {
            // place the status of each part in the options column
            let status = {}
            _.each(payload.parts, (part) => {
                status[part.name] = false;
            });
            return {
                token: payload.token,
                action: `add-${payload.type}`,
                options: status,
                user_id: userId,
            };
        });
        let location = {
            address,
            schema,
            table: 'task',
        };
        return dataSource.save(location, tasks);
    }

    function updateBackendProgress(destination, payloads) {
        let location = {
            address,
            schema,
            table: 'task',
            criteria: {
                token: _.map(payloads, 'id'),
            }
        };
        return dataSource.find(query).then((tasks) => {
            let changed = false;
            _.each(tasks, (task) => {
                let payload = _.find(payloads, { id: task.token });
                if (payload) {
                    if (payload.type === 'unknown') {
                        // restore type
                        payload.type = _.replace(this.action, /^add\-/, '');
                        payload.sent = (task.completion > 0);
                        changed = true;
                    }
                    if (payload.processed !== payload.completion) {
                        payload.processed = task.completion;
                        changed = true;
                    }
                    if (payload.processEndTime !== task.etime) {
                        payload.processEndTime = task.etime;
                        if (task.etime && !task.failed) {
                            payload.completed = true;
                        }
                        changed = true;
                    }
                    if (task.failed && !payload.failed) {
                        payload.failed = true;
                        changed = true;
                    }
                }
            });
            return changed;
        });
    }
}

export {
    start,
};
