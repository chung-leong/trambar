var _ = require('lodash');
var Promise = require('bluebird');
var Async = require('async-do-while');

var CommitImporter = require('gitlab-adapter/commit-importer');

exports.reconstructPush = reconstructPush;

/**
 * Reconstruct a push
 *
 * @param  {Database} db
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {String} branch
 * @param  {String} headId
 * @param  {String} tailId
 * @param  {Number} count
 *
 * @return {Promise<Object>}
 */
function reconstructPush(db, server, repo, branch, headId, tailId, count) {
    return importCommits(db, server, repo, branch, headId, count).then((commits) => {
        // obtain a linear list of commits--ignoring branching within the push
        var chain = getCommitChain(commits, headId);
        var forkId;
        if (!tailId) {
            // a new branch, find the fork
            var firstCommit = _.last(chain);
            var firstCommitParentIds = getParentIds(firstCommit);
            if (firstCommitParentIds.length === 1) {
                forkId = firstCommitParentIds[0];
            }
        }

        // merge changes of commits
        var lines = mergeLineChanges(chain);
        var files = mergeFileChanges(chain);

        // see if the commits were initially pushed into a different branch
        var fromBranches = _.transform(commits, (list, commit) => {
            if (commit.initial_branch !== branch) {
                if (!_.includes(list, commit.initial_branch)) {
                    list.push(commit.initial_branch);
                }
            }
        }, []);

        var commitIds = _.keys(commits);
        return { headId, tailId, forkId, commitIds, lines, files, branch, fromBranches };
    });
}

/**
 * Import a certain number of commits, starting from the head moving backward
 *
 * @param  {Database} db
 * @param  {Server} server
 * @param  {Repo} repo
 * @param  {String} branch
 * @param  {String} headId
 * @param  {Number} count
 *
 * @return {Promise<Object<Commits>>}
 */
function importCommits(db, server, repo, branch, headId, count) {
    var queue = [ headId ];
    var commits = {};
    Async.do(() => {
        var commitId = queue.shift();
        if (commits[commitId]) {
            return;
        }
        return CommitImporter.importCommit(db, server, repo, branch, commitId).then((commit) => {
            commits[commitId] = commit;

            // add parents to queue
            var parentIds = getParentIds(commit);
            _.each(parentIds, (parentId) => {
                queue.push(parentId);
            });
        });
    });
    Async.while(() => {
        if (!_.isEmpty(queue)) {
            if (_.size(commits) < count) {
                return true;
            }
        }
        return false;
    });
    Async.return(() => {
        return commits;
    });
    return Async.end();
}

function mergeLineChanges(chain) {
    var pl = {
        added: 0,
        deleted: 0,
    };
    _.each(chain, (commit) => {
        var cl = commit.details.lines;
        if (cl) {
            pl.added += cl.added;
            pl.deleted += cl.deleted;
        }
    });
    return pl;
}

function mergeFileChanges(chain) {
    var pf = {
        added: [],
        deleted: [],
        modified: [],
        renamed: [],
    };
    _.each(chain, (commit) => {
        var cf = commit.details.files;
        if (cf) {
            _.each(cf.added, (path) => {
                if (!_.includes(pf.added, path)) {
                    pf.added.push(path);
                }
            });
            _.each(cf.deleted, (path) => {
                // if the file was deleted within this push, ignore it
                if (_.includes(pf.added, path)) {
                    _.pull(pf.added, path);
                } else {
                    pf.added.push(path);
                }
            });
            _.each(cf.renamed, (path) => {
                // if the file was renamed within this push, treat it
                // as an addition under the new name
                if (_.includes(pf.added, path.before)) {
                    _.pull(pf.added, path.before);
                    pf.added.push(path.after);
                } else {
                    // if the file was renamed previously within this push,
                    // don't count the previous action
                    _.remove(pf.renamed, { after: path.before });
                    pf.renamed.push(path);
                }
            });
            _.each(cf.modified, (path) => {
                // if the file was added by this push, don't treat it
                // as a modification
                if (!_.includes(pf.added, path)) {
                    pf.modified.push(path);
                }
            });
        }
    });
    return pf;
}

/**
 * Return the parent ids of a commit (which, for the sake of consistency,
 * are stored in a link object in external, alongside the commit id)
 *
 * @param  {Commit} commit
 *
 * @return {Array<String>}
 */
function getParentIds(commit) {
    var commitLink = _.find(commit.external, { type: 'gitlab' });
    var commitId = commitLink.commit.id;
    var parentIds = commitLink.commit.parent_ids;
    // sanity check
    if (_.includes(parentIds, commitId)) {
        parentIds = _.without(parentIds, commitId);
    }
    return parentIds;
}

/**
 * Get a linear list of commits, choosing the first parent when a fork is encountered
 *
 * @param  {Object<Commit>} commits
 * @param  {String} headId
 *
 * @return {Array<Commit>}
 */
function getCommitChain(commits, headId) {
    var chain = [];
    var id = headId;
    do {
        var commit = commits[id];
        if (commit) {
            var parentIds = getParentIds(commit);
            id = parentIds[0];
            chain.push(commit);
        } else {
            id = null;
        }
    } while(id);
    return chain;
}