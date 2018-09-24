class NumberArray {
    static from(s) {
        return s.split(',').map(parseInt);
    }

    static to(a) {
        return a.join(',');
    }
}

const routes = {
    'bookmarks-page': {
        path: '/bookmarks/',
        hash: [
            'S${highlightStoryID}',
            's${scrollToStoryID}',
            'R${highlightReactionID}',
            'r${scrollToReactionID}',
        ],
        params: {
            scrollToStoryID: Number,
            highlightStoryID: Number,
            scrollToReactionID: Number,
            highlightReactionID: Number,
        },
        load: (params, context) => {
            params.ui = {
                navigation: { section: 'bookmarks' }
            };
            return import('pages/bookmarks-page' /* webpackChunkName: "page-bookmarks" */).then((module) => {
                params.module = module;
            });
        }
    },
    'news-page': {
        path: '/news/',
        query: {
            roles: '${roleIDs}',
            search: '${search}',
            date: '${date}',
        },
        hash: [
            'S${highlightStoryID}',
            's${scrollToStoryID}',
            'R${highlightReactionID}',
            'r${scrollToReactionID}',
        ],
        params: {
            roleIDs: NumberArray,
            search: String,
            date: String,
            scrollToStoryID: Number,
            highlightStoryID: Number,
            scrollToReactionID: Number,
            highlightReactionID: Number,
        },
        load: (params, context) => {
            let statistics = { type: 'daily-activities', public: 'guest' };
            params.ui = {
                calendar: { statistics },
                filter: {},
                search: { statistics },
                navigation: { section: 'news' }
            };
            return import('pages/news-page' /* webpackChunkName: "page-news" */).then((module) => {
                params.module = module;
            });
        }
    },
    'notifications-page': {
        path: '/notifications/',
        query: {
            date: '${date}',
        },
        hash: [
            'N${highlightNotificationID}',
            'n${scrollToNotificationID}',
        ],
        params: {
            date: String,
            highlightNotificationID: Number,
            scrollToNotificationID: Number,
        },
        load: (params, context) => {
            let route = {};
            let statistics = { type: 'daily-notifications', user_id: 'current' };
            params.ui = {
                calendar: { statistics },
                navigation: { section: 'notifications' }
            };
            return import('pages/notifications-page' /* webpackChunkName: "page-notifications" */).then((module) => {
                params.module = module;
            });
        }
    },
    'people-page': {
        path: '/people/',
        query: {
            roles: '${roleIDs}',
            search: '${search}',
            date: '${date}',
        },
        hash: [
            'u${scrollToUserID}',
        ],
        params: {
            roleIDs: NumberArray,
            search: String,
            date: String,
            scrollToUserID: Number,
        },
        load: (params, context) => {
            let statistics = { type: 'daily-activities' };
            // go back to full list
            params.ui = {
                calendar: { statistics },
                filter: {},
                search: { statistics },
                navigation: { section: 'people' }
            }
            return import('pages/people-page' /* webpackChunkName: "page-people" */).then((module) => {
                params.module = module;
            });
        }
    },
    'person-page': {
        path: '/people/${selectedUserID}/',
        query: {
            search: '${search}',
            date: '${date}',
        },
        hash: [
            'S${highlightStoryID}',
            's${scrollToStoryID}',
            'R${highlightReactionID}',
            'r${scrollToReactionID}',
        ],
        params: {
            schema: String,
            search: String,
            date: String,
            selectedUserID: Number,
            scrollToStoryID: Number,
            highlightStoryID: Number,
            scrollToReactionID: Number,
            highlightReactionID: Number,
        },
        load: (params, context) => {
            // include user ID in URLs generated by search and calendar bar
            let { selectedUserID } = params;
            let route = { selectedUserID };
            let statistics = { type: 'daily-activities', user_id: user };
            params.ui = {
                calendar: { route, statistics },
                search: { route, statistics },
                navigation: { section: 'people' }
            };
            return import('pages/people-page' /* webpackChunkName: "page-people" */).then((module) => {
                params.module = module;
            });
        }
    },
    'settings-page': {
        path: '/settings/',
        params: {
            schema: String,
        },
        load: (params, context) => {
            params.ui = {
                navigation: { section: 'settings '},
            };
            return import('pages/settings-page' /* webpackChunkName: "page-settings" */).then((module) => {
                params.module = module;
            });
        }
    },
    'start-page': {
        path: '/',
        query: {
            add: '${addingServer}',
            ac: '${activationCode}',
            p: '${schema}',
        },
        params: {
            schema: String,
            activationCode: String,
            addingServer: Boolean,
        },
        load: (params, context) => {
            params.ui = {
                navigation: { top: false, bottom: false }
            };
            return import('pages/start-page' /* webpackChunkName: "page-start" */).then((module) => {
                params.module = module;
            });
        },
    },
    'sign-in-page': {
        path: '/',
        load: (params, context) => {
            params.ui = {
                navigation: { top: false, bottom: false }
            };
            return import('pages/start-page' /* webpackChunkName: "page-start" */).then((module) => {
                params.module = module;
            });
        },
        public: true,
        signIn: true,
    },
    'error-page': {
        path: '*',
        load: (params, context) => {
            return import('pages/error-page' /* webpackChunkName: "page-error" */).then((module) => {
                params.module = module;
            });
        },
    }
};

export {
    routes,
};
