import _ from 'lodash';
import Promise from 'bluebird';
import React, { PureComponent } from 'react';
import { AsyncComponent } from 'relaks';
import Memoize from 'utils/memoize';
import Empty from 'data/empty';
import ComponentRefs from 'utils/component-refs';
import UserFinder from 'objects/finders/user-finder';
import RepoFinder from 'objects/finders/repo-finder';
import BookmarkFinder from 'objects/finders/bookmark-finder';
import ReactionFinder from 'objects/finders/reaction-finder';

// widgets
import SmartList from 'widgets/smart-list';
import StoryView from 'views/story-view';
import StoryEditor from 'editors/story-editor';
import NewItemsAlert from 'widgets/new-items-alert';

import './story-list.scss';

class StoryList extends AsyncComponent {
    static displayName = 'StoryList';

    /**
     * Extract id from URL hash
     *
     * @param  {String} hash
     *
     * @return {Object}
     */
    static parseHash(hash) {
        var story, highlighting;
        if (story = Route.parseId(hash, /S(\d+)/)) {
            highlighting = true;
        } else if (story = Route.parseId(hash, /s(\d+)/)) {
            highlighting = false;
        }
        return { story, highlighting };
    }

    /**
     * Get URL hash based on given parameters
     *
     * @param  {Object} params
     *
     * @return {String}
     */
    static getHash(params) {
        if (params.story) {
            if (params.highlighting) {
                return `S${params.story}`;
            } else {
                return `s${params.story}`;
            }
        }
        return '';
    }

    /**
     * Render the component asynchronously
     *
     * @param  {Meanwhile} meanwhile
     * @param  {Object} prevProps
     *
     * @return {Promise<ReactElement>}
     */
    renderAsync(meanwhile, prevProps) {
        var params = this.props.route.parameters;
        var db = this.props.database.use({ schema: params.schema, by: this });
        var props = {
            authors: null,
            reactions: null,
            respondents: null,
            recommendations: null,
            recipients: null,
            repos: null,

            access: this.props.access,
            acceptNewStory: this.props.acceptNewStory,
            stories: this.props.stories,
            draftStories: this.props.draftStories,
            pendingStories: this.props.pendingStories,
            currentUser: this.props.currentUser,
            project: this.props.project,
            database: this.props.database,
            payloads: this.props.payloads,
            route: this.props.route,
            locale: this.props.locale,
            theme: this.props.theme,
        };
        meanwhile.show(<StoryListSync {...props} />);
        return db.start().then((currentUserId) => {
            // load repos first, so "add to issue tracker" option doesn't pop in
            // suddenly in triple-column mode
            return RepoFinder.findProjectRepos(db, props.project).then((repos) => {
                props.repos = repos;
            });
        }).then(() => {
            meanwhile.show(<StoryListSync {...props} />);
            var stories = _.filter(_.concat(props.pendingStories, props.draftStories, props.stories));
            return UserFinder.findStoryAuthors(db, stories).then((users) => {
                props.authors = users;
            });
        }).then(() => {
            meanwhile.show(<StoryListSync {...props} />);
            var stories = _.filter(_.concat(props.pendingStories, props.stories));
            return ReactionFinder.findReactionsToStories(db, stories, props.currentUser).then((reactions) => {
                props.reactions = reactions;
            });
        }).then(() => {
            meanwhile.show(<StoryListSync {...props} />);
            return UserFinder.findReactionAuthors(db, props.reactions).then((users) => {
                props.respondents = users;
            })
        }).then(() => {
            meanwhile.show(<StoryListSync {...props} />);
            var stories = _.filter(_.concat(props.pendingStories, props.stories));
            return BookmarkFinder.findBookmarksByUser(db, props.currentUser, stories).then((bookmarks) => {
                props.recommendations = bookmarks;
            });
        }).then(() => {
            meanwhile.show(<StoryListSync {...props} />);
            return UserFinder.findBookmarkRecipients(db, props.bookmarks).then((users) => {
                props.recipients = users;
            });
        }).then(() => {
            return <StoryListSync {...props} />;
        });
    }
}

class StoryListSync extends PureComponent {
    static displayName = 'StoryList.Sync';

    constructor(props) {
        super(props);
        this.components = ComponentRefs({
            list: SmartList
        });
        this.state = {
            hiddenStoryIds: [],
        };
    }

    /**
     * Cancel payloads of stories that no longer exists
     *
     * @param  {Object} nextProps
     */
    componentWillReceiveProps(nextProps) {
        if (this.props.stories !== nextProps.stories || this.props.draftStories !== nextProps.draftStories || this.props.pendingStories !== nextProps.pendingStories) {
            var storiesBefore = _.concat(this.props.draftStories, this.props.pendingStories, this.props.stories);
            var storiesAfter = _.concat(nextProps.draftStories, nextProps.pendingStories, nextProps.stories);
            var storiesAfterHash = _.keyBy(storiesAfter, 'id');
            _.each(storiesBefore, (story) => {
                if (story) {
                    if (!storiesAfterHash[story.id]) {
                        // TODO: clean this up
                        var params = this.props.route.parameters;
                        var location = {
                            address: params.address,
                            schema: params.schema,
                            table: 'story'
                        };
                        var permanentID = this.props.database.findPermanentID(location, story.id);
                        if (!permanentID || !storiesAfterHash[permanentID]) {
                            nextProps.payloads.abandon(story);
                        }
                    }
                }
            });
        }
    }

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        var setters = this.components.setters;
        var stories = sortStories(this.props.stories, this.props.pendingStories);
        if (this.props.acceptNewStory) {
            stories = attachDrafts(stories, this.props.draftStories, this.props.currentUser);
        }
        var anchor;
        var hashParams = StoryList.parseHash(this.props.route.hash);
        if (hashParams.story) {
            anchor = `story-${hashParams.story}`;
        }
        var smartListProps = {
            ref: setters.list,
            items: stories,
            offset: 20,
            behind: 4,
            ahead: 8,
            anchor: anchor,

            onIdentity: this.handleStoryIdentity,
            onRender: this.handleStoryRender,
            onAnchorChange: this.handleStoryAnchorChange,
            onBeforeAnchor: this.handleStoryBeforeAnchor,
        };
        this.freshList = false;
        return (
            <div className="story-list">
                <SmartList {...smartListProps} />
                {this.renderNewStoryAlert()}
            </div>
        );
    }

    /**
     * Render alert indicating there're new stories hidden up top
     *
     * @return {ReactElement}
     */
    renderNewStoryAlert() {
        var t = this.props.locale.translate;
        var count = _.size(this.state.hiddenStoryIds);
        var params = {
            story: _.first(this.state.hiddenStoryIds)
        };
        var props = {
            hash: StoryList.getHash(params),
            route: this.props.route,
            onClick: this.handleNewStoryAlertClick,
        };
        return (
            <NewItemsAlert {...props}>
                {t('alert-$count-new-stories', count)}
            </NewItemsAlert>
        );
    }

    /**
     * Called when SmartList wants an item's id
     *
     * @param  {Object} evt
     *
     * @return {String}
     */
    handleStoryIdentity = (evt) => {
        if (evt.alternative && evt.item) {
            // look for temporary id
            var params = this.props.route.parameters;
            var location = { schema: params.schema, table: 'story' };
            var temporaryId = this.props.database.findTemporaryID(location, evt.item.id);
            if (temporaryId) {
                return `story-${temporaryId}`;
            }
        } else {
            if (this.props.acceptNewStory) {
                // use a fixed id for the first editor, so we don't lose focus
                // when the new story acquires an id after being saved automatically
                if (evt.currentIndex === 0) {
                    return 'story-top';
                }
            }
            return `story-${evt.item.id}`;
        }
    }

    /**
     * Called when SmartList wants to render an item
     *
     * @param  {Object} evt
     *
     * @return {ReactElement}
     */
    handleStoryRender = (evt) => {
        var story = evt.item;
        // see if it's being editted
        var isDraft = false;
        var highlighting = false;
        if (story) {
            if (this.props.access === 'read-write') {
                if (!story.published) {
                    isDraft = true;
                } else {
                    var tempCopy = _.find(this.props.draftStories, { published_version_id: story.id });
                    if (tempCopy) {
                        // edit the temporary copy
                        story = tempCopy;
                        isDraft = true;
                    }
                }
            }

            var hash = this.props.route.hash;
            var hashParams = StoryList.parseHash(hash);
            if (story.id === hashParams.story) {
                if (hashParams.highlighting) {
                    highlighting = true;
                    // suppress highlighting after a second
                    setTimeout(() => {
                        this.props.route.reanchor(_.toLower(hash));
                    }, 1000);
                }
            }
        } else {
            isDraft = true;
        }
        if (isDraft) {
            var authors = findAuthors(this.props.authors, story);
            var recommendations = findRecommendations(this.props.recommendations, story);
            var recipients = findRecipients(this.props.recipients, recommendations);
            if (!story) {
                authors = array(this.props.currentUser);
            }
            var editorProps = {
                highlighting,
                story,
                authors,
                recommendations,
                recipients,
                repos: this.props.repos,
                isStationary: evt.currentIndex === 0,
                currentUser: this.props.currentUser,
                database: this.props.database,
                payloads: this.props.payloads,
                route: this.props.route,
                locale: this.props.locale,
                theme: this.props.theme,
            };
            return <StoryEditor {...editorProps}/>
        } else {
            if (evt.needed) {
                var reactions = findReactions(this.props.reactions, story);
                var authors = findAuthors(this.props.authors, story);
                var respondents = findRespondents(this.props.respondents, reactions);
                var recommendations = findRecommendations(this.props.recommendations, story);
                var recipients = findRecipients(this.props.recipients, recommendations);
                var pending = !_.includes(this.props.stories, story);
                var storyProps = {
                    highlighting,
                    pending,
                    access: this.props.access,
                    story,
                    reactions,
                    authors,
                    respondents,
                    recommendations,
                    recipients,
                    repos: this.props.repos,
                    currentUser: this.props.currentUser,
                    database: this.props.database,
                    payloads: this.props.payloads,
                    route: this.props.route,
                    locale: this.props.locale,
                    theme: this.props.theme,
                    onBump: this.handleStoryBump,
                };
                return <StoryView {...storyProps} />
            } else {
                var height = evt.previousHeight || evt.estimatedHeight || 100;
                return <div className="story-view" style={{ height }} />
            }
        }
    }

    /**
     * Called when a different story is positioned at the top of the viewport
     *
     * @param  {Object} evt
     */
    handleStoryAnchorChange = (evt) => {
        var params = {
            story: _.get(evt.item, 'id')
        };
        var hash = StoryList.getHash(params);
        this.props.route.reanchor(hash);
    }

    /**
     * Called when SmartList notice new items were rendered off screen
     *
     * @param  {Object} evt
     */
    handleStoryBeforeAnchor = (evt) => {
        var hiddenStoryIds = _.map(evt.items, 'id');
        this.setState({ hiddenStoryIds });
    }

    /**
     * Called when user clicks on new story alert
     *
     * @param  {Event} evt
     */
    handleNewStoryAlertClick = (evt) => {
        this.setState({ hiddenStoryIds: [] });
    }

    /**
     * Scroll back to the top when a story is bumped
     *
     * @param  {Object} evt
     */
    handleStoryBump = (evt) => {
        this.components.list.releaseAnchor();
    }
}

var array = Memoize(function(object) {
    return [ object ];
});

var sortStories = Memoize(function(stories, pendingStories) {
    if (!_.isEmpty(pendingStories)) {
        stories = _.slice(stories);
        _.each(pendingStories, (story) => {
            if (!story.published_version_id) {
                stories.push(story);
            }
        });
    }
    return _.orderBy(stories, [ getStoryTime, 'id' ], [ 'desc', 'desc' ]);
});

var attachDrafts = Memoize(function(stories, drafts, currentUser) {
    // add new drafts (drafts includes published stories being edited)
    var newDrafts = _.filter(drafts, (story) => {
        return !story.published_version_id && !story.published;
    });

    // current user's own drafts are listed first
    var own = function(story) {
        return story.user_ids[0] === currentUser.id;
    };
    newDrafts = _.orderBy(newDrafts, [ own, 'id' ], [ 'desc', 'desc' ]);

    // see if the current user has a draft
    var currentUserDraft = _.find(newDrafts, (story) => {
        if (story.user_ids[0] === currentUser.id) {
            return true;
        }
    });
    if (!currentUserDraft) {
        // add a blank
        newDrafts.unshift(null);
    }
    return _.concat(newDrafts, stories);
}, [ null ]);

var getStoryTime = function(story) {
    return story.btime || story.ptime;
};

var findReactions = Memoize(function(reactions, story) {
    if (story) {
        var list = _.filter(reactions, { story_id: story.id });
        if (!_.isEmpty(list)) {
            return list;
        }
    }
    return Empty.array;
});

var findAuthors = Memoize(function(users, story) {
    if (story) {
        var hash = _.keyBy(users, 'id');
        var list = _.filter(_.map(story.user_ids, (userId) => {
            return hash[userId];
        }));
        if (!_.isEmpty(list)) {
            return list;
        }
    }
    return Empty.array;
});

var findRespondents = Memoize(function(users, reactions) {
    var respondentIds = _.uniq(_.map(reactions, 'user_id'));
    var hash = _.keyBy(users, 'id');
    var list = _.filter(_.map(respondentIds, (userId) => {
        return hash[userId];
    }));
    if (!_.isEmpty(list)) {
        return list;
    }
    return Empty.array;
});

var findRecommendations = Memoize(function(recommendations, story) {
    if (story) {
        var storyId = story.published_version_id || story.id;
        var list = _.filter(recommendations, { story_id: storyId });
        if (!_.isEmpty(list)) {
            return list;
        }
    }
    return Empty.array;
});

var findRecipients = Memoize(function(recipients, recommendations) {
    var list = _.filter(recipients, (recipient) => {
        return _.some(recommendations, { target_user_id: recipient.id });
    });
    if (!_.isEmpty(list)) {
        return list;
    }
    return Empty.array;
});

function getAuthorIds(stories) {
    var userIds = _.flatten(_.map(stories, 'user_ids'));
    return _.uniq(userIds);
}

StoryList.defaultProps = {
    acceptNewStory: false,
};

export {
    StoryList as default,
    StoryList,
    StoryListSync,
};

import Database from 'data/database';
import Payloads from 'transport/payloads';
import Route from 'routing/route';
import Locale from 'locale/locale';
import Theme from 'theme/theme';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    StoryList.propTypes = {
        access: PropTypes.oneOf([ 'read-only', 'read-comment', 'read-write' ]).isRequired,
        acceptNewStory: PropTypes.bool,
        stories: PropTypes.arrayOf(PropTypes.object),
        draftStories: PropTypes.arrayOf(PropTypes.object),
        pendingStories: PropTypes.arrayOf(PropTypes.object),
        currentUser: PropTypes.object,
        project: PropTypes.object,

        database: PropTypes.instanceOf(Database).isRequired,
        payloads: PropTypes.instanceOf(Payloads).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    };
    StoryListSync.propTypes = {
        access: PropTypes.oneOf([ 'read-only', 'read-comment', 'read-write' ]).isRequired,
        acceptNewStory: PropTypes.bool,
        stories: PropTypes.arrayOf(PropTypes.object),
        authors: PropTypes.arrayOf(PropTypes.object),
        draftStories: PropTypes.arrayOf(PropTypes.object),
        pendingStories: PropTypes.arrayOf(PropTypes.object),
        reactions: PropTypes.arrayOf(PropTypes.object),
        respondents: PropTypes.arrayOf(PropTypes.object),
        recommendations: PropTypes.arrayOf(PropTypes.object),
        recipients: PropTypes.arrayOf(PropTypes.object),
        currentUser: PropTypes.object,
        project: PropTypes.object,
        repos: PropTypes.arrayOf(PropTypes.object),

        database: PropTypes.instanceOf(Database).isRequired,
        payloads: PropTypes.instanceOf(Payloads).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    };
}
