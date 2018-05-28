var _ = require('lodash');
var React = require('react'), PropTypes = React.PropTypes;
var Relaks = require('relaks');
var Memoize = require('utils/memoize');
var Merger = require('data/merger');
var UserFinder = require('objects/finders/user-finder');
var StoryFinder = require('objects/finders/story-finder');

var Database = require('data/database');
var Route = require('routing/route');
var Locale = require('locale/locale');
var Theme = require('theme/theme');

// mixins
var UpdateCheck = require('mixins/update-check');

// widgets
var SmartList = require('widgets/smart-list');
var NotificationView = require('views/notification-view');
var NewItemsAlert = require('widgets/new-items-alert');

require('./notification-list.scss');

module.exports = Relaks.createClass({
    displayName: 'NotificationList',
    propTypes: {
        notifications: PropTypes.arrayOf(PropTypes.object),
        currentUser: PropTypes.object,

        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    },

    statics: {
        /**
         * Extract id from URL hash
         *
         * @param  {String} hash
         *
         * @return {Object}
         */
        parseHash: function(hash) {
            var notification, highlighting;
            if (notification = Route.parseId(hash, /N(\d+)/)) {
                highlighting = true;
            } else if (notification = Route.parseId(hash, /n(\d+)/)) {
                highlighting = false;
            }
            return { notification, highlighting };
        },

        /**
         * Get URL hash based on given parameters
         *
         * @param  {Object} params
         *
         * @return {String}
         */
        getHash: function(params) {
            if (params.notification != undefined) {
                if (params.highlighting) {
                    return `N${params.notification}`;
                } else {
                    return `n${params.notification}`;
                }
            }
            return '';
        },
    },

    /**
     * Retrieve data needed by synchronous component
     *
     * @param  {Meanwhile} meanwhile
     *
     * @return {Promise<ReactElement>}
     */
    renderAsync: function(meanwhile) {
        var params = this.props.route.parameters;
        var db = this.props.database.use({ schema: params.schema, by: this });
        var props = {
            users: null,
            stories: null,

            currentUser: this.props.currentUser,
            notifications: this.props.notifications,
            database: this.props.database,
            route: this.props.route,
            locale: this.props.locale,
            theme: this.props.theme,
        };
        meanwhile.show(<NotificationListSync {...props} />);
        return db.start().then((userId) => {
            return UserFinder.findNotificationTriggerers(db, props.notifications).then((users) => {
                props.users = users;
            });
        }).then(() => {
            meanwhile.show(<NotificationListSync {...props} />);
            return StoryFinder.findStoriesOfNotifications(db, props.notifications, props.currentUser).then((stories) => {
                props.stories = stories;
            });
        }).then(() => {
            return <NotificationListSync {...props} />;
        })
    },
});

var NotificationListSync = module.exports.Sync = React.createClass({
    displayName: 'NotificationList.Sync',
    mixins: [ UpdateCheck ],
    propTypes: {
        notifications: PropTypes.arrayOf(PropTypes.object),
        currentUser: PropTypes.object,
        users: PropTypes.arrayOf(PropTypes.object),

        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    },

    /**
     * Return initial state of component
     *
     * @return {Object}
     */
    getInitialState: function() {
        return {
            hiddenNotificationIds: [],
        };
    },

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render: function() {
        var notifications = sortNotifications(this.props.notifications);
        var anchor;
        var hashParams = module.exports.parseHash(this.props.route.hash);
        if (hashParams.notification) {
            anchor = `notification-${hashParams.notification}`;
        }
        var smartListProps = {
            items: notifications,
            behind: 20,
            ahead: 40,
            anchor: anchor,
            offset: 10,

            onIdentity: this.handleNotificationIdentity,
            onRender: this.handleNotificationRender,
            onAnchorChange: this.handleNotificationAnchorChange,
            onBeforeAnchor: this.handleNotificationBeforeAnchor,
        };
        return (
            <div className="notification-list">
                <SmartList {...smartListProps} />
                {this.renderNewNotificationAlert()}
            </div>
        );
    },

    /**
     * Render alert indicating there're new stories hidden up top
     *
     * @return {ReactElement}
     */
    renderNewNotificationAlert: function() {
        var t = this.props.locale.translate;
        var count = _.size(this.state.hiddenNotificationIds);
        var params = {
            notification: _.first(this.state.hiddenNotificationIds)
        };
        var props = {
            hash: module.exports.getHash(params),
            route: this.props.route,
            onClick: this.handleNewNotificationAlertClick,
        };
        return (
            <NewItemsAlert {...props}>
                {t('alert-$count-new-notifications', count)}
            </NewItemsAlert>
        );
    },

    /**
     * Mark unread notification as seen after some time
     *
     * @param  {Object} prevProps
     * @param  {Object} prevState
     */
    componentDidUpdate: function(prevProps, prevState) {
        if (prevProps.notifications !== this.props.notifications || prevState.hiddenNotificationIds !== this.state.hiddenNotificationIds) {
            // need a small delay here, since hiddenNotificationIds isn't updated
            // until the SmartList's componentDidUpdate() is called
            setTimeout(() => {
                var unread = _.filter(this.props.notifications, (notification) => {
                    if (!notification.seen) {
                        if (!_.includes(this.state.hiddenNotificationIds, notification.id)) {
                            return true;
                        }
                    }
                });
                if (!_.isEmpty(unread)) {
                    var delay = unread.length;
                    if (delay > 5) {
                        delay = 5;
                    } else if (delay < 2) {
                        delay = 2;
                    }
                    clearTimeout(this.markAsSeenTimeout);
                    this.markAsSeenTimeout = setTimeout(() => {
                        this.markAsSeen(unread);
                    }, delay * 1000);
                }
            }, 50);
        }
    },

    /**
     * Clear timeout on unmount
     */
    componentWillUnmount: function() {
        clearTimeout(this.markAsSeenTimeout);
    },

    /**
     * Return id of notification view in response to event triggered by SmartList
     *
     * @type {String}
     */
    handleNotificationIdentity: function(evt) {
        return `notification-${evt.item.id}`;
    },

    /**
     * Render a notification in response to event triggered by SmartList
     *
     * @param  {Object} evt
     *
     * @return {ReactElement}
     */
    handleNotificationRender: function(evt) {
        if (evt.needed) {
            var notification = evt.item;
            var user = findUser(this.props.users, notification);
            var props = {
                notification,
                user,
                database: this.props.database,
                route: this.props.route,
                locale: this.props.locale,
                theme: this.props.theme,
                onClick: this.handleNotificationClick,
            };
            return <NotificationView key={notification.id} {...props} />;
        } else {
            var height = evt.previousHeight || evt.estimatedHeight || 25;
            return <div className="notification-view" style={{ height }} />
        }
    },

    /**
     * Set seen flag of notifications to true
     *
     * @param  {Array<Notification>} notifications
     *
     * @return {Promise<Array>}
     */
    markAsSeen: function(notifications) {
        var params = this.props.route.parameters;
        var db = this.props.database.use({ schema: params.schema, by: this });
        var notificationsAfter = _.map(notifications, (notification) => {
            return { id: notification.id, seen: true };
        });
        return db.save({ table: 'notification' }, notificationsAfter);
    },

    /**
     * Called when user clicks on a notification
     *
     * @param  {Object} evt
     */
    handleNotificationClick: function(evt) {
        var notification = evt.target.props.notification;
        if (!notification.seen) {
            this.markAsSeen([ notification ]);
        }
    },

    /**
     * Called when a different notification is shown at the top of the viewport
     *
     * @return {Object}
     */
    handleNotificationAnchorChange: function(evt) {
        var params = {
            notification: _.get(evt.item, 'id')
        };
        var hash = module.exports.getHash(params);
        this.props.route.reanchor(hash);
    },

    /**
     * Called when SmartList notice new items were rendered off screen
     *
     * @param  {Object} evt
     */
    handleNotificationBeforeAnchor: function(evt) {
        var hiddenNotificationIds = _.map(evt.items, 'id');
        this.setState({ hiddenNotificationIds });
    },

    /**
     * Called when user clicks on new notification alert
     *
     * @param  {Event} evt
     */
    handleNewNotificationAlertClick: function(evt) {
        this.setState({ hiddenNotificationIds: [] });
    },
});

var sortNotifications = Memoize(function(notifications) {
    return _.orderBy(notifications, [ 'ctime' ], [ 'desc' ]);
});

var findUser = Memoize(function(users, notification) {
    if (notification) {
        return _.find(users, { id: notification.user_id });
    } else {
        return null;
    }
});
