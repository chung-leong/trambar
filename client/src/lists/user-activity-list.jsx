import _ from 'lodash';
import React, { PureComponent } from 'react';
import Memoize from 'utils/memoize';
import * as DateTracker from 'utils/date-tracker';

import Route from 'routing/route';
import Environment from 'env/environment';

// mixins
import UpdateCheck from 'mixins/update-check';

// widgets
import ProfileImage from 'widgets/profile-image';
import Time from 'widgets/time';

import './user-activity-list.scss';

class UserActivityList extends PureComponent {
    static displayName = 'UserActivityList';

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        if (this.props.stories) {
            let stories = sortStories(this.props.stories);
            return (
                <div className="user-activity-list">
                {
                    _.map(stories, (story) => {
                        return this.renderActivity(story);
                    })
                }
                </div>
            );
        } else {
            let indices = _.range(0, this.props.storyCountEstimate);
            return (
                <div className="user-activity-list">
                {
                    _.map(indices, (index) => {
                        return this.renderActivityPlaceholder(index);
                    })
                }
                </div>
            );
        }
    }

    /**
     * Render a brief description about a story
     *
     * @param  {Story} story
     *
     * @return {ReactElement}
     */
    renderActivity(story) {
        let route = this.props.route;
        let components = [
            require('pages/people-page'),
            require('lists/story-list')
        ];
        let params = _.pick(route.parameters, 'schema', 'date', 'search');
        params.user = this.props.user.id;
        params.story = story.id;
        params.highlighting = true;
        let url = route.find(components, params);
        let text = this.renderText(story);
        let labelClass = 'label';
        let time = story.btime || story.ptime;
        if (time >= DateTracker.todayISO || time >= DateTracker.yesterdayISO) {
            labelClass += ' recent';
        }
        return (
            <div key={story.id} className="activity">
                <Time time={story.ptime} locale={this.props.locale} compact={true} />
                <div className={labelClass}>
                    <a href={url}>{text}</a>
                </div>
            </div>
        );
    }

    /**
     * Render a placeholder
     *
     * @param  {Number} index
     *
     * @return {ReactElement}
     */
    renderActivityPlaceholder(index) {
        return <div key={index} className="activity">{'\u00a0'}</div>;
    }

    /**
     * Return short summary about story
     *
     * @param  {Story} story
     *
     * @return {String}
     */
    renderText(story) {
        let t = this.props.locale.translate;
        let n = this.props.locale.name;
        let user = this.props.user;
        let name = n(_.get(user, 'details.name'), _.get(user, 'details.gender'));
        switch (story.type) {
            case 'push':
                return t(`user-activity-$name-pushed-code`, name);
            case 'merge':
                return t(`user-activity-$name-merged-code`, name);
            case 'branch':
                return t(`user-activity-$name-created-branch`, name);
            case 'tag':
                return t(`user-activity-$name-created-tag`, name);
            case 'issue':
                return t(`user-activity-$name-reported-issue`, name);
            case 'milestone':
                return t(`user-activity-$name-created-milestone`, name);
            case 'merge-request':
                return t(`user-activity-$name-created-merge-request`, name);
            case 'wiki':
                return t(`user-activity-$name-edited-wiki-page`, name);
            case 'member':
            case 'repo':
                let action = story.details.action;
                return t(`user-activity-$name-${action}-repo`, name);
            case 'post':
                let resources = story.details.resources;
                let counts = _.countBy(resources, 'type');
                if (counts.video > 0) {
                    return t(`user-activity-$name-posted-$count-video-clips`, name, counts.video);
                } else if (counts.image > 0) {
                    return t(`user-activity-$name-posted-$count-pictures`, name, counts.image);
                } else if (counts.audio > 0) {
                    return t(`user-activity-$name-posted-$count-audio-clips`, name, counts.audio);
                } else if (counts.website > 0) {
                    return t(`user-activity-$name-posted-$count-links`, name, counts.website);
                } else {
                    return t(`user-activity-$name-wrote-post`, name);
                }
            case 'survey':
                return t(`user-activity-$name-started-survey`, name);
            case 'task-list':
                return t(`user-activity-$name-started-task-list`, name);
            default:
                return story.type;
        }
    }
}

let sortStories = Memoize(function(stories) {
    stories = _.orderBy(stories, [ getStoryTime ], [ 'desc' ]);
    return stories;
});

let getStoryTime = function(story) {
    return story.btime || story.ptime;
};

export {
    UserActivityList as default,
    UserActivityList,
};

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    UserActivityList.propTypes = {
        user: PropTypes.object,
        stories: PropTypes.arrayOf(PropTypes.object),
        storyCountEstimate: PropTypes.number,
        route: PropTypes.instanceOf(Route).isRequired,
        env: PropTypes.instanceOf(Environment).isRequired,
    };
}
