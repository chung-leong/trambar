import _ from 'lodash';
import Statistics from '../accessors/statistics.mjs';

import ReactionTypeRatings from './ratings/reaction-type-ratings.mjs';

class ByPopularity {
    constructor() {
        this.type = 'by-popularity';
        this.calculation = 'immediate';
        this.columns = [ 'id' ];
        this.monitoring = [ 'statistics' ];
        this.statisticsCache = [];
    }

    /**
     * Load data needed to rate the given stories
     *
     * @param  {Database} db
     * @param  {Schema} schema
     * @param  {Array<Story>} stories
     * @param  {Listing} listing
     *
     * @return {Promise<Object>}
     */
    async prepareContext(db, schema, stories, listing) {
        const popularity = {};
        for (let story of stories) {
            let statistics = this.findCachedStatistics(schema, story.id)
            if (!statistics) {
                statistics = await this.loadStatistics(db, schema, story.id);
            }
            popularity[story.id] = (statistics) ? statistics.details : {};
        }
        return({ popularity });
    }

    /**
     * Give a numeric score to a story
     *
     * @param  {Object} context
     * @param  {Story} story
     *
     * @return {Number}
     */
    calculateRating(context, story) {
        const details = context.popularity[story.id];
        const rating = _.reduce(details, (total, count, type) => {
            const reactionRating = ReactionTypeRatings[type] || 0;
            return total + (reactionRating * count);
        }, 0);
        return rating;
    }

    /**
     * Handle database change events
     *
     * @param  {Object} evt
     */
    handleEvent(evt) {
        if (evt.table === 'statistics') {
            if (evt.diff.details) {
                this.clearCachedStatistics(evt.schema, evt.id);
            }
        }
    }

    /**
     * Load statistics from database, saving it to cache
     *
     * @param  {Database} db
     * @param  {String} schema
     * @param  {Number} storyID
     *
     * @return {Object|null}
     */
    async loadStatistics(db, schema, storyID) {
        const criteria = {
            type: 'story-popularity',
            filters: {
                story_id: storyID
            },
            deleted: false,
        };
        const row = await Statistics.findOne(db, schema, criteria, 'id, details');
        if (row) {
            this.cacheStatistics(schema, storyID, row);
        }
        return row;
    }

    /**
     * Save statistics to cache
     *
     * @param  {String} schema
     * @param  {Number} storyID
     * @param  {Object} statistics
     */
    cacheStatistics(schema, storyID, statistics) {
        const entry = { schema, storyID, statistics };
        this.statisticsCache.unshift(entry);
        if (this.statisticsCache.length > 5000) {
            this.statisticsCache.splice(5000);
        }
    }

    /**
     * Find cached statistics
     *
     * @param  {String} schema
     * @param  {Number} storyID
     *
     * @return {Object|null}
     */
    findCachedStatistics(schema, storyID) {
        const index = _.findIndex(this.statisticsCache, { schema, storyID });
        if (index === -1) {
            return null;
        }
        const entry = this.statisticsCache[index];
        this.statisticsCache.splice(index, 1);
        this.statisticsCache.unshift(entry);
        return entry.statistics;
    }

    /**
     * Remove an entry from cache
     *
     * @param  {String} schema
     * @param  {Number} id
     */
    clearCachedStatistics(schema, id) {
        const index = _.findIndex(this.statisticsCache, (entry) => {
            if (entry.schema === schema) {
                if (entry.statistics.id === id) {
                    return true;
                }
            }
        });
        if (index === -1) {
            return;
        }
        this.statisticsCache.splice(index, 1);
    }
}

const instance = new ByPopularity;

export {
    instance as default,
    ByPopularity,
};
