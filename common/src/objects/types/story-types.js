module.exports = exports = [
    'push',
    'merge',
    'branch',
    'issue',
    'milestone',
    'merge-request',
    'wiki',
    'member',
    'repo',
    'post',
    'survey',
    'task-list',
];

exports.editable = [
    'post',
    'task-list',
    'survey',
];

exports.trackable = [
    'post',
];

exports.git = [
    'push',
    'merge',
    'branch',
    'issue',
    'milestone',
    'merge-request',
    'wiki',
    'member',
    'repo',
];

var isNodeJs = Object.prototype.toString.call(typeof process !== 'undefined' ? process : 0) === '[object process]';
if (!isNodeJs) {
    exports.icons = {
        'push': require('octicons/build/svg/repo-push.svg'),
        'merge': require('octicons/build/svg/git-merge.svg'),
        'branch': require('octicons/build/svg/git-branch.svg'),
        'issue': require('octicons/build/svg/issue-opened.svg'),
        'issue.opened': require('octicons/build/svg/issue-opened.svg'),
        'issue.closed': require('octicons/build/svg/issue-closed.svg'),
        'issue.reopened': require('octicons/build/svg/issue-reopened.svg'),
        'milestone': require('octicons/build/svg/milestone.svg'),
        'merge-request': require('octicons/build/svg/git-pull-request.svg'),
        'wiki': require('octicons/build/svg/file-text.svg'),
        'member': require('octicons/build/svg/person.svg'),
        'repo': require('octicons/build/svg/repo.svg'),
        'post': require('octicons/build/svg/note.svg'),
        'survey': require('octicons/build/svg/list-unordered.svg'),
        'task-list': require('octicons/build/svg/list-ordered.svg'),
    };
}
