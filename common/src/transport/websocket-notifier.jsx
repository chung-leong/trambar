var _ = require('lodash');
var Promise = require('bluebird');
var React = require('react'), PropTypes = React.PropTypes;
var SockJS = require('sockjs-client');
var Async = require('async-do-while');

var Locale = require('locale/locale');

// widgets
var Diagnostics = require('widgets/diagnostics');
var DiagnosticsSection = require('widgets/diagnostics-section');

module.exports = React.createClass({
    displayName: 'WebsocketNotifier',
    propTypes: {
        serverAddress: PropTypes.string,
        initialReconnectionDelay: PropTypes.number,
        maximumReconnectionDelay: PropTypes.number,
        defaultProfileImage: PropTypes.string,

        locale: PropTypes.instanceOf(Locale),

        onConnect: PropTypes.func,
        onDisconnect: PropTypes.func,
        onNotify: PropTypes.func,
        onAlertClick: PropTypes.func,
    },

    statics: {
        isAvailable: function() {
            return (process.env.PLATFORM !== 'mobile');
        }
    },

    /**
     * Return default props
     *
     * @return {Object}
     */
    getDefaultProps: function() {
        return {
            initialReconnectionDelay: 500,
            maximumReconnectionDelay: 30000,
        };
    },

    /**
     * Return initial state of component
     *
     * @return {Object}
     */
    getInitialState: function() {
        return {
            socket: null,
            notificationPermitted: false,
            serverResponse: null,
            reconnectionCount: 0,
            recentMessages: [],
        };
    },

     /**
      * Ask user for permission to show notification on mount
      */
     componentWillMount: function() {
         requestNotificationPermission().then(() => {
             this.setState({ notificationPermitted: true })
         }).catch((err) => {
         })

         // connect on mount if we somehow have the info (unlikely)
         this.updateConnection(this.props);
     },

    /**
     * Change the connect when server or schema changes
     *
     * @param  {Object} nextProps
     */
    componentWillReceiveProps: function(nextProps) {
        if (this.props.serverAddress !== nextProps.serverAddress) {
             this.updateConnection(nextProps);
        }
    },

    /**
     * Update the connection to reflect new props
     *
     * @param  {Object} nextProps
     */
    updateConnection: function(nextProps) {
        this.disconnect();
        if (nextProps.serverAddress) {
            this.connect(nextProps.serverAddress)
        }
    },

    /**
     * Connect to server
     *
     * @param  {String} serverAddress
     *
     * @return {Boolean}
     */
    connect: function(serverAddress) {
        // track connection attempt with an object
        var attempt = this.connectionAttempt;
        if (attempt) {
            if (attempt.serverAddress === serverAddress) {
                // already connecting to server
                return attempt.promise;
            }
        }
        attempt = this.connectionAttempt = { serverAddress };

        var connected = false;
        var delay = this.props.initialReconnectionDelay;
        var maximumDelay = this.props.maximumReconnectionDelay;

        // keep trying to connect until the effort is abandoned (i.e. user
        // goes to a different server)
        Async.do(() => {
            return this.createSocket(serverAddress).then((socket) => {
                if (attempt === this.connectionAttempt) {
                    socket.onmessage = (evt) => {
                        if (this.state.socket === socket) {
                            var object = parseJSON(evt.data);
                            if (object.changes) {
                                this.triggerNotifyEvent(serverAddress, object.changes);
                            } else if (object.alert) {
                                this.showAlert(serverAddress, object.alert);
                            } else if (object.socket) {
                                var connection = {
                                    method: 'websocket',
                                    relay: null,
                                    token: object.socket,
                                    address: serverAddress,
                                    details: {
                                        user_agent: navigator.userAgent
                                    },
                                };
                                this.setState({ serverResponse: object });
                                this.triggerConnectEvent(connection);
                            }

                            var recentMessages = _.slice(this.state.recentMessages);
                            recentMessages.unshift(object);
                            if (recentMessages.length > 10) {
                               recentMessages.splice(10);
                            }
                            this.setState({ recentMessages })
                        }
                    };
                    socket.onclose = () => {
                        if (this.state.socket === socket) {
                            // we're still supposed to be connected
                            // try to reestablish connection
                            this.setState({ socket: null, serverResponse: null }, () => {
                                console.log('Reestablishing web-socket connection...');
                                this.connect(serverAddress).then((connected) => {
                                    if (connected) {
                                        var reconnectionCount = this.state.reconnectionCount + 1;
                                        this.setState({ reconnectionCount })
                                        console.log('Connection reestablished');
                                    }
                                });
                            });
                        } else {
                            this.setState({ socket: null, serverResponse: null, reconnectionCount: 0 });
                        }
                        if (this.props.serverAddress === serverAddress) {
                            this.triggerDisconnectEvent();
                        }
                    };
                    this.setState({ socket });
                }
                connected = true;
            }).catch((err) => {
                delay *= 2;
                if (delay > maximumDelay) {
                    delay = maximumDelay;
                }
                console.log(`Connection attempt in ${delay}ms: ${serverAddress}`);
                return Promise.delay(delay);
            });
        });
        Async.while(() => {
            if (attempt === this.connectionAttempt) {
                return !connected;
            } else {
                return false;
            }
        });
        Async.return(() => {
            this.connectionAttempt = null;
            return connected;
        });
        attempt.promise = Async.end();
        return attempt.promise;
    },

    /**
     * Close web-socket connection
     */
    disconnect: function() {
        var socket = this.state.socket;
        if (socket) {
            // set state.socket to null first, to stop reconnection attempt
            this.setState({ socket: null, serverResponse: null, reconnectionCount: 0 }, () => {
                socket.close();
            });
        }
    },

    /**
     * Create a SockJS socket
     *
     * @param  {String} serverAddress
     *
     * @return {Promise<SockJS>}
     */
    createSocket: function(serverAddress) {
        return new Promise((resolve, reject) => {
            var url = `${serverAddress}/socket`;
            var socket = new SockJS(url);
            var isFulfilled = false;
            socket.onopen = (evt) => {
                if (!isFulfilled) {
                    isFulfilled = true;
                    resolve(socket);
                }
            };
            socket.onclose = () => {
                if (!isFulfilled) {
                    // neither onopen() or onerror() was called
                    reject(new Error('Unable to establish a connection'));
                }
            };
            socket.onerror = (evt) => {
                if (!isFulfilled) {
                    isFulfilled = true;
                    reject(new Error(evt.message));
                }
            };
        });
    },

    /**
     * Notify parent component that a change event was received
     *
     * @param  {String} address
     * @param  {Object} changes
     */
    triggerNotifyEvent: function(address, changes) {
        if (this.props.onNotify) {
            this.props.onNotify({
                type: 'notify',
                target: this,
                address,
                changes,
            });
        }
    },

    /**
     * Notify parent component that a connection was established
     *
     * @param  {Object} connection
     */
    triggerConnectEvent: function(connection) {
        if (this.props.onConnect) {
            this.props.onConnect({
                type: 'connect',
                target: this,
                connection,
            });
        }
    },

    /**
     * Notify parent component that a connection was lost
     */
    triggerDisconnectEvent: function() {
        if (this.props.onDisconnect) {
            this.props.onDisconnect({
                type: 'disconnect',
                target: this,
            });
        }
    },

    /**
     * Inform parent component that an alert was clicked
     *
     * @param  {String} address
     * @param  {Object} alert
     */
    triggerAlertClickEvent: function(address, alert) {
        if (this.props.onAlertClick) {
            this.props.onAlertClick({
                type: 'alertclick',
                target: this,
                address,
                alert,
            })
        }
    },

    /**
     * Display an alert popup
     *
     * @param  {String} serverAddress
     * @param  {Object} alert
     */
    showAlert: function(serverAddress, alert) {
        if (this.state.notificationPermitted) {
            var options = {};
            if (alert.profile_image) {
                options.icon = `${serverAddress}${alert.profile_image}`;
            } else {
                options.icon = this.props.defaultProfileImage;
            }
            if (alert.message) {
                options.body = alert.message;
            } else if (alert.attached_image) {
                // show attach image only if there's no text
                options.image = `${serverAddress}${alert.attached_image}`;
            }
            options.lang = _.get(this.props.locale, 'languageCode');
            var notification = new Notification(alert.title, options);
            notification.addEventListener('click', () => {
                this.triggerAlertClickEvent(serverAddress, alert);
                notification.close();
            });
        }
    },

    /**
     * Render diagnostics
     *
     * @return {ReactElement}
     */
    render: function() {
        var id = _.get(this.state.serverResponse, 'socket');
        return (
            <Diagnostics type="websocket-notifier">
                <DiagnosticsSection label="Connection">
                    <div>ID: {id}</div>
                    <div>Socket: {this.state.socket ? 'established' : 'none'}</div>
                    <div>Reconnection count: {this.state.reconnectionCount}</div>
                    <div>Notification: {this.state.notificationPermitted ? 'permitted' : 'denied'}</div>
                </DiagnosticsSection>
                <DiagnosticsSection label="Recent messages">
                    {_.map(this.state.recentMessages, renderJSON)}
                </DiagnosticsSection>
            </Diagnostics>
        );
    },
});

function parseJSON(text) {
    try {
        return JSON.parse(text);
    } catch (err) {
    }
}

function requestNotificationPermission() {
    return new Promise((resolve, reject) => {
        Notification.requestPermission((status) => {
            if (status === 'granted') {
                resolve();
            } else {
                reject(new Error('Unable to gain permission'))
            }
        })
    });
}

function renderJSON(object) {
    return <pre>{JSON.stringify(object, undefined, 4)}</pre>;
}
