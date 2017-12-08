var _ = require('lodash');
var Promise = require('bluebird');
var Express = require('express');
var BodyParser = require('body-parser');
var Passport = require('passport')
var Crypto = Promise.promisifyAll(require('crypto'));
var FS = Promise.promisifyAll(require('fs'));
var Moment = require('moment');
var Request = require('request');
var HtpasswdAuth = require('htpasswd-auth');
var Async = require('async-do-while');
var HttpError = require('errors/http-error');
var Database = require('database');
var Shutdown = require('shutdown');
var UserTypes = require('objects/types/user-types');
var UserSettings = require('objects/settings/user-settings');

var Import = require('external-services/import');
var GitlabUserImporter = require('gitlab-adapter/user-importer');

// accessors
var Authentication = require('accessors/authentication');
var Authorization = require('accessors/authorization');
var Project = require('accessors/project');
var Server = require('accessors/server');
var System = require('accessors/system');
var User = require('accessors/user');

var server;
var authenticationLifetime = 2; // hours
var cleanUpInterval;

function start() {
    var app = Express();
    app.set('json spaces', 2);
    app.use(BodyParser.json());
    app.use(Passport.initialize());
    app.post('/auth/session', handleSessionStart);
    app.get('/auth/session/:token', handleSessionRetrieval);
    app.post('/auth/session/:token/end', handleSessionTermination);
    app.post('/auth/htpasswd', handleHttpasswdRequest);
    app.get('/auth/:provider/:callback?', handleOAuthTestRequest, handleOAuthActivationRequest, handleOAuthRequest);
    server = app.listen(80);

    cleanUpInterval = setInterval(removeUnusedAuthorizationObjects, 60 * 60 * 1000);
}

function stop() {
    clearInterval(cleanUpInterval);

    return new Promise((resolve, reject) => {
        if (server) {
            var resolved = false;
            server.on('close', () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            });
            server.close();
            setTimeout(() => {
                // just in case close isn't firing
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            }, 1000);
        } else {
            resolve();
        }
    });
};

/**
 * Send response to browser as JSON object or HTML text
 *
 * @param  {Response} res
 * @param  {Object|String} result
 */
function sendResponse(res, result) {
    if (typeof(result) === 'string') {
        res.type('html').send(result);
    } else {
        res.json(result);
    }
}

/**
 * Send error to browser as JSON object
 *
 * @param  {Response} res
 * @param  {Object} err
 */
function sendError(res, err) {
    if (!err) {
        return;
    }
    var statusCode = err.statusCode;
    var message = err.message;
    console.error(err);
    if (!statusCode) {
        // not an expected error
        console.error(err);
        statusCode = 500;
        if (process.env.NODE_ENV === 'production') {
            message = 'Internal server error';
        }
    }
    res.status(statusCode).json({ message });
}

/**
 * Create a new authentication object
 *
 * @param  {Request} req
 * @param  {Response} res
 */
function handleSessionStart(req, res) {
    var host = req.headers['host'];
    var protocol = req.headers['x-connection-protocol'];
    var area = req.body.area;
    Database.open().then((db) => {
        // generate a random token for tracking the authentication
        // process; if successful, this token will be upgraded to
        // an authorization token
        return Crypto.randomBytesAsync(24).then((buffer) => {
            if (!(area === 'client' || area === 'admin')) {
                throw new HttpError(400);
            }
            var authentication = {
                area,
                token: buffer.toString('hex'),
            };
            return Authentication.saveOne(db, 'global', authentication);
        }).then((authentication) => {
            // send list of available strategies to client, along with the
            // authentication token
            var criteria = { disabled: false, deleted: false };
            return Server.find(db, 'global', criteria, '*').then((servers) => {
                var providers = _.filter(_.map(servers, (server) => {
                    if (canProvideAccess(server, area)) {
                        var url = `${protocol}://${host}/auth/${server.type}?sid=${server.id}&token=${authentication.token}`;
                        return {
                            type: server.type,
                            details: server.details,
                            url,
                        };
                    }
                }));
                return System.findOne(db, 'global', criteria, '*').then((system) => {
                    if (!system) {
                        // in case the system object hasn't been created yet
                        system = { details: {} };
                    }
                    return {
                        system: _.pick(system, 'details'),
                        authentication: {
                            token: authentication.token,
                            expire: Moment(authentication.ctime).add(authenticationLifetime, 'hour').toISOString(),
                        },
                        providers,
                    };
                });
            });
        });
    }).then((results) => {
        sendResponse(res, results);
    }).catch((err) => {
        sendError(res, err);
    });
}

/**
 * Handle authentication by password stored in a htpasswd file
 *
 * @param  {Request} req
 * @param  {Response} res
 */
function handleHttpasswdRequest(req, res) {
    var token = req.body.token;
    var username = _.trim(_.lowerCase(req.body.username));
    var password = _.trim(req.body.password);
    Database.open().then((db) => {
        return Authentication.findOne(db, 'global', { token }, '*').then((authentication) => {
            if (!authentication) {
                throw new HttpError(400);
            }
            if (!username || !password) {
                throw new HttpError(400);
            }
            var htpasswdPath = process.env.HTPASSWD_PATH;
            if (!htpasswdPath) {
                throw new HttpError(403);
            }
            return FS.readFileAsync(htpasswdPath, 'utf-8').then((data) => {
                return HtpasswdAuth.authenticate(username, password, data);
            }).catch((err) => {
                if (err.code === 'ENOENT') {
                    // password file isn't there
                    throw new HttpError(403);
                } else {
                    throw err;
                }
            }).then((successful) => {
                if (successful !== true) {
                    return Promise.delay(Math.random() * 1000).return(null);
                }
                var criteria = { username, deleted: false };
                var userColumns = 'id, type, requested_project_ids';
                return User.findOne(db, 'global', criteria, userColumns).then((user) => {
                    if (!user) {
                        // create the admin user if it's not there
                        var name = _.capitalize(username);
                        if (name === 'Root') {
                            name = 'Administrator';
                        }
                        var user = {
                            type: 'admin',
                            username,
                            details: { name },
                            settings: UserSettings.default,
                            hidden: true,
                        };
                        return User.insertOne(db, 'global', user);
                    }
                    return user;
                });
            }).then((user) => {
                return authorizeUser(db, user, authentication, 'htpasswd').then((authorization) => {
                    return {
                        authorization: {
                            token: authorization.token,
                            user_id: authorization.user_id,
                        }
                    };
                });
            });
        });
    }).then((results) => {
        sendResponse(res, results);
    }).catch((err) => {
        sendError(res, err);
    });
}

/**
 * Return an authentication object, used by the client to determine if login
 * was successful
 *
 * @param  {Request} req
 * @param  {Response} res
 */
function handleSessionRetrieval(req, res) {
    var token = req.params.token;
    Database.open().then((db) => {
        var criteria = { token, deleted: false };
        return Authorization.findOne(db, 'global', criteria, 'token, user_id').then((authorization) => {
            if (!authorization) {
                return Authentication.findOne(db, 'global', criteria, 'id').then((authentication) => {
                    if (!authentication) {
                        throw new HttpError(404);
                    }
                    // no authorization yet
                    return {};
                });
            }
            // see which projects the user has access to
            var userId = authorization.user_id;
            var userColumns = 'id, type, requested_project_ids';
            return User.findOne(db, 'global', { id: userId }, userColumns).then((user) => {
                return {
                    authorization: {
                        token: authorization.token,
                        user_id: authorization.user_id,
                    }
                };
            });
        });
    }).then((results) => {
        sendResponse(res, results);
    }).catch((err) => {
        sendError(res, err);
    });
}

/**
 * Mark authorization object as deleted
 *
 * @param  {Request} req
 * @param  {Response} res
 */
function handleSessionTermination(req, res) {
    var token = req.params.token;
    Database.open().then((db) => {
        var criteria = { token, deleted: false };
        return Authorization.findOne(db, 'global', criteria, 'id').then((authorization) => {
            if (!authorization) {
                throw new HttpError(404);
            }
            authorization.deleted = true;
            return Authorization.updateOne(db, 'global', authorization).return(true);
        });
    }).then((results) => {
        sendResponse(res, results);
    }).catch((err) => {
        sendError(res, err);
    });
}

/**
 * Redirect to OAuth provider
 *
 * @param  {Request}   req
 * @param  {Response}  res
 * @param  {Function} done
 */
function handleOAuthRequest(req, res, done) {
    var serverId = parseInt(req.query.sid);
    var token = req.query.token;
    Database.open().then((db) => {
        return Authentication.findOne(db, 'global', { token }, '*').then((authentication) => {
            if (!authentication) {
                throw new HttpError(400);
            }
            var criteria = { id: serverId, deleted: false };
            return Server.findOne(db, 'global', criteria, '*').then((server) => {
                if (!server) {
                    throw new HttpError(400);
                }
                var params = { sid: serverId, token };
                return authenticateThruPassport(req, res, server, params).then((account) => {
                    return findMatchingUser(db, server, account).then((user) => {
                        // save the info from provider for potential future use
                        var details = {
                            profile: account.profile._json,
                            access_token: account.accessToken,
                            refresh_token: account.refreshToken,
                        };
                        return authorizeUser(db, user, authentication, server.type, server.id, details);
                    });
                });
            });
        });
    }).then(() => {
        var html = `<script> close() </script>`;
        sendResponse(res, html);
    }).catch((err) => {
        // display error
        sendError(res, err);
    });
}

/**
 * Acquire access token from an OAuth provider
 *
 * @param  {Request}   req
 * @param  {Response}  res
 * @param  {Function}  done
 */
function handleOAuthTestRequest(req, res, done) {
    if (!req.query.test) {
        done();
        return;
    }

    var serverId = parseInt(req.query.sid);
    var token = req.query.token;
    Database.open().then((db) => {
        // make sure we have admin access
        return Authorization.check(db, token, 'admin').then((userId) => {
            var criteria = { id: serverId, deleted: false };
            return Server.findOne(db, 'global', criteria, '*').then((server) => {
                if (!server) {
                    throw new HttpError(400);
                }
                var params = { test: 1, sid: serverId, token };
                var scope;
                return authenticateThruPassport(req, res, server, params, scope);
            });
        });
    }).then(() => {
        var html = `
            <h1>Success</h1>
        `;
        sendResponse(res, html);
    }).catch((err) => {
        // TODO: display error as HTML
        sendError(res, err);
    });
}

/**
 * Acquire access token from an OAuth provider
 *
 * @param  {Request}   req
 * @param  {Response}  res
 * @param  {Function}  done
 */
function handleOAuthActivationRequest(req, res, done) {
    if (!req.query.activation) {
        done();
        return;
    }

    var serverId = parseInt(req.query.sid);
    var token = req.query.token;
    Database.open().then((db) => {
        // make sure we have admin access
        return Authorization.check(db, token, 'admin').then((userId) => {
            var criteria = { id: serverId, deleted: false };
            return Server.findOne(db, 'global', criteria, '*').then((server) => {
                if (!server) {
                    throw new HttpError(400);
                }
                var params = { activation: 1, sid: serverId, token };
                var scope;
                if (server.type === 'gitlab') {
                    scope = [ 'api' ];
                }
                return authenticateThruPassport(req, res, server, params, scope).then((account) => {
                    var profile = account.profile._json;
                    var isAdmin = false;
                    if (server.type === 'gitlab') {
                        isAdmin = profile.is_admin;
                    }
                    if (!isAdmin) {
                        var name = account.profile.displayName;
                        throw new HttpError(403, {
                            reason: `The account "${name}" does not have administrative access`,
                        });
                    }
                    // save the access and refresh tokens
                    var settings = _.clone(server.settings);
                    settings.api = {
                        access_token: account.accessToken,
                        refresh_token: account.refreshToken,
                    };
                    return Server.updateOne(db, 'global', { id: server.id, settings });
                });
            });
        });
    }).then(() => {
        var html = `
            <h1>Success</h1>
            <script> setTimeout(close, 500) </script>
        `;
        sendResponse(res, html);
    }).catch((err) => {
        // TODO: display error as HTML
        sendError(res, err);
    });
}

/**
 * Create a new Authorization record for user, checking for existence and
 * if he can access the area in question
 *
 * @param  {Database} db
 * @param  {User} user
 * @param  {Authenication} authentication
 * @param  {String} authType
 * @param  {Number} serverId
 * @param  {Object} details
 *
 * @return {Promise<Authorization>}
 */
function authorizeUser(db, user, authentication, authType, serverId, details) {
    if (!user) {
        return Promise.reject(new HttpError(401));
    }
    if (authentication.area === 'admin' && user.type !== 'admin') {
        return Promise.reject(new HttpError(403));
    }
    // update Authentication record
    authentication.type = authType;
    authentication.user_id = user.id;
    authentication.server_id = serverId;
    _.assign(authentication.details, details);
    return Authentication.updateOne(db, 'global', authentication).then((authentication) => {
        // create Authorization record
        var lifetime = (authentication.area === 'client') ? 30 : 1;
        var expirationDate = Moment().add(lifetime, 'day').format('YYYY-MM-DD');
        var authorization = {
            token: authentication.token,
            user_id: authentication.user_id,
            expiration_date: expirationDate,
            area: authentication.area,
        };
        return Authorization.insertOne(db, 'global', authorization);
    });
}

/**
 * Return true if server can provide access to an area
 *
 * @param  {Server} server
 * @param  {String} area
 *
 * @return {Boolean}
 */
function canProvideAccess(server, area) {
    if (server.settings.oauth) {
        if (server.settings.oauth.client_id && server.settings.oauth.client_secret) {
            if (area === 'admin') {
                switch (server.type) {
                    case 'gitlab':
                        return true;
                }
            } else if (area === 'client') {
                switch (server.type) {
                    default:
                        return true;
                }
            }
        }
    }
    return false;
}

var plugins = {
    dropbox: 'passport-dropbox-oauth2',
    facebook: 'passport-facebook',
    github: 'passport-github',
    gitlab: 'passport-gitlab2',
    google: 'passport-google-oauth2',
};

function authenticateThruPassport(req, res, server, params, scope) {
    return new Promise((resolve, reject) => {
        // obtain info needed for callback URL from Request object
        var host = req.headers['host'];
        var protocol = req.headers['x-connection-protocol'];
        var provider = req.params.provider;
        // add params as query variables in callback URL
        var query = _.reduce(params, (query, value, name) => {
            if (query) {
                query += '&';
            }
            query += name + '=' + value;
            return query;
        }, '');
        var settings = {
            clientID: server.settings.oauth.client_id,
            clientSecret: server.settings.oauth.client_secret,
            baseURL: server.settings.oauth.base_url,
            callbackURL: `${protocol}://${host}/auth/${provider}/callback?${query}`,
        };
        var options = { session: false, scope };
        if (provider === 'facebook') {
            // ask Facebook to return these fields
            settings.profileFields = [
                'id',
                'email',
                'gender',
                'link',
                'displayName',
                'name',
                'picture',
                'verified'
            ];
        }
        // create strategy object, resolving promise when we have the profile
        var Strategy = require(plugins[server.type]);
        var strategy = new Strategy(settings, (accessToken, refreshToken, profile, done) => {
            // just resolve the promise--no need to call done() since we're not
            // using Passport as an Express middleware
            resolve({ accessToken, refreshToken, profile });
        });
        // trigger Passport middleware manually
        Passport.use(strategy);
        var auth = Passport.authenticate(server.type, options, (err, user, info) => {
            // if this callback is called, then authentication has failed, since
            // the callback passed to Strategy() resolves the promise and does
            // not invoke done()
            reject(err);
        });
        auth(req, res);
    });
}

/**
 * Find or create a user that's linked with the external account
 *
 * @param  {Database} db
 * @param  {Server} server
 * @param  {Object} account
 *
 * @return {Promise<User>}
 */
function findMatchingUser(db, server, account) {
    // look for a user with the external id
    var profile = account.profile;
    var criteria = {
        external_object: {
            type: server.type,
            server_id: server.id,
            user: { id: profile.id },
        },
        deleted: false,
    };
    return User.findOne(db, 'global', criteria, 'id, type').then((user) => {
        if (user) {
            return user;
        }
        // find a user with the email address
        return Promise.reduce(_.map(profile.emails, 'value'), (matching, email) => {
            if (matching) {
                return matching;
            }
            if (!email) {
                return null;
            }
            var criteria = { email, deleted: false, order: 'id' };
            return User.findOne(db, 'global', criteria, 'id, type, external');
        }, null);
    }).then((user) => {
        if (!user) {
            if (!acceptNewUser(server)) {
                throw new HttpError(403);
            }
        }
        return retrieveProfileImage(profile).then((image) => {
            var link = Import.Link.create(server, {
                user: { id: profile.id }
            });
            var userAfter = copyUserProperties(user, image, server, profile, link);
            if(userAfter) {
                if (user) {
                    return User.updateOne(db, 'global', userAfter);
                } else {
                    if (userAfter.disabled) {
                        // don't create disabled user
                        throw new HttpError(403);
                    }
                    return User.insertUnique(db, 'global', userAfter);
                }
            }
        });
    });
}

/**
 * Copy information from Passport profile object into user object
 *
 * @param  {User|null} user
 * @param  {Object} image
 * @param  {Server} server
 * @param  {Object} profile
 * @param  {Object} link
 *
 * @return {User|null}
 */
function copyUserProperties(user, image, server, profile, link) {
    var json = profile._json;
    if (server.type === 'gitlab') {
        // use GitlabAdapter's importer
        return GitlabUserImporter.copyUserProperties(user, image, server, json, link);
    } else {
        var userAfter = _.cloneDeep(user) || {
            role_ids: _.get(server, 'settings.user.role_ids', []),
            settings: UserSettings.default,
        };
        var email = _.first(_.map(profile.emails, 'value'));
        var name = profile.displayName;
        var username = profile.username || proposeUsername(profile);
        var imported = Import.reacquire(userAfter, link, 'user');
        Import.set(userAfter, imported, 'username', username);
        Import.set(userAfter, imported, 'details.name', name);
        Import.set(userAfter, imported, 'details.email', email);
        Import.attach(userAfter, imported, 'image', image);

        // set user type
        if (server.type === 'facebook') {
            Import.set(userAfter, imported, 'details.gender', json.gender);
        }
        var userType = _.get(server, 'settings.user.type');
        if (user) {
            // set it if it's more privileged
            if (UserTypes.indexOf(userType) > UserTypes.indexOf(userAfter.type)) {
                userAfter.type = userType;
            }
        } else {
            if (userType) {
                userAfter.type = userType;
            } else {
                userAfter.type = 'regular';
                userAfter.disabled
            }
        }

        if (_.isEqual(user, userAfter)) {
            return null;
        }
        return userAfter;
    }
}

/**
 * Return true if server accepts new users
 *
 * @param  {Server} server
 *
 * @return {Boolean}
 */
function acceptNewUser(server) {
    var type = _.get(server, 'settings.user.type');
    var mapping = _.get(server, 'settings.user.mapping');
    return !!type || _.some(mapping);
}

/**
 * Propose a username based on user's profile information
 *
 * @param  {Object} profile
 *
 * @return {String}
 */
function proposeUsername(profile) {
    if (profile.username) {
        return profile.username;
    }
    var email = _.get(profile.emails, '0.value');
    if (email) {
        return _.replace(email, /@.*/, '');
    }
    var lname = toSimpleLatin(profile.name.familyName);
    var fname = toSimpleLatin(profile.name.givenName);
    if (lname && fname) {
        return fname.charAt(0) + lname;
    } else if (fname || lname) {
        return fname || lname;
    }
    return 'user';
}

/**
 * Convert string to ASCII lowercase
 *
 * @param  {String} s
 *
 * @return {String}
 */
function toSimpleLatin(s) {
    if (s) {
        return s.normalize('NFD').toLowerCase().replace(/[^a-z]/g, '');
    }
}

/**
 * Ask Media Server to import an external user's avatar
 *
 * @param  {Object} profile
 *
 * @return {Promise<Object>}
 */
function retrieveProfileImage(profile) {
    var url = profile.avatarUrl;
    if (!url) {
        url = _.get(profile.photos, '0.value')
    }
    if (!url) {
        return Promise.resolve(null);
    }
    var options = {
        json: true,
        url: 'http://media_server/internal/import',
        body: {
            external_url: url
        },
    };
    return new Promise((resolve, reject) => {
        Request.post(options, (err, resp, body) => {
            if (!err) {
                var image = body;
                resolve(image);
            } else {
                console.log('Unable to retrieve profile image: ' + url);
                resolve(null);
            }
        });
    });
}

/**
 * Remove old unused authentication objects
 *
 * @return {Promise<Array>}
 */
function removeUnusedAuthorizationObjects() {
    return Database.open().then((db) => {
        var limit = Moment().subtract(authenticationLifetime * 2, 'hour').toISOString();
        var criteria = {
            user_id: null,
            older_than: limit,
        };
        return Authentication.removeMatching(db, 'global', criteria);
    });
}

exports.start = start;
exports.stop = stop;

if (process.argv[1] === __filename) {
    start();
}

Shutdown.on(stop);
