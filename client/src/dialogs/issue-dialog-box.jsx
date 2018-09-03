import _ from 'lodash';
import Promise from 'bluebird';
import React, { PureComponent } from 'react';
import ComponentRefs from 'utils/component-refs';
import TagScanner from 'utils/tag-scanner';


// widgets
import Overlay from 'widgets/overlay';
import PushButton from 'widgets/push-button';
import TextField from 'widgets/text-field';

import './issue-dialog-box.scss';

class IssueDialogBox extends PureComponent {
    static displayName = 'IssueDialogBox';

    constructor(props) {
        super(props);
        this.components = ComponentRefs({
            textField: TextField
        });
        this.state = {
            issue: this.props.issue ? null : this.getDefaultIssue(),
        };
    }

    /**
     * Return the current issue details
     *
     * @param  {String} path
     *
     * @return {*}
     */
    getIssueProperty(path) {
        var issue = this.state.issue || this.props.issue || {};
        return _.get(issue, path);
    }

    /**
     * Set a property of the issue object
     *
     * @param  {String} path
     * @param  {*} value
     */
    setIssueProperty(path, value) {
        var issue = this.state.issue || this.props.issue || {};
        issue = _.decoupleSet(issue, path, value);
        if (path === 'repo_id') {
            lastSelectedRepoId = value;
            window.localStorage.last_selected_repo_id = value;
        }
        this.setState({ issue });
    }

    /**
     * Derive issue details from story
     *
     * @return {Object|null}
     */
    getDefaultIssue() {
        // look for a title in the text
        var t = this.props.locale.translate;
        var text = t(this.props.story.details.text);
        var paragraphs = _.split(_.trim(text), /[\r\n]+/);
        var first = TagScanner.removeTags(paragraphs[0]);
        // use first paragraph as title only if it isn't very long
        var title = '';
        if (first.length < 100) {
            title = first;
        }

        // look for tags that match labels
        var allLabels = _.uniq(_.flatten(_.map(this.props.repos, 'details.labels')));
        var labels = _.filter(allLabels, (label) => {
            var tag = `#${_.replace(label, /\s+/g, '-')}`;
            return _.includes(this.props.story.tags, tag);
        });

        if (!title && _.isEmpty(labels)) {
            return null;
        }
        return { title, labels };
    }

    /**
     * Return the selected repo
     *
     * @return {Repo}
     */
    getSelectedRepo() {
        var repoId = this.getIssueProperty('repo_id');
        var repos = this.getAvailableRepos();
        var repo = _.find(this.props.repos, { id: repoId });
        if (!repo) {
            repo = _.find(this.props.repos, { id: lastSelectedRepoId });
        }
        if (!repo) {
            // find one with labels--if a repo has no labels, then its
            // issue tracker probably isn't being used
            repo = _.last(_.sortBy(this.props.repos, (repo) => {
                return _.size(repo.details.labels);
            }));
        }
        if (!repo) {
            repo = _.first(repos);
        }
        return repo || null;
    }

    /**
     * Return repos that have issue-trackers
     *
     * @return {Array<Object>}
     */
    getAvailableRepos() {
        var p = this.props.locale.pick;
        var repos = this.props.repos;
        repos = _.filter(repos, (repo) => {
            return repo.details.issues_enabled;
        });
        repos = _.sortBy(repos, (repo) => {
            return _.toLower(p(repo.details.title) || repo.name);
        });
        return repos;
    }

    /**
     * Update start when props change
     *
     * @param  {Object} nextProps
     */
    componentWillReceiveProps(nextProps) {
        if (this.props.show !== nextProps.show) {
            if (nextProps.show) {
                var issue;
                if (!nextProps.issue) {
                    issue = this.getDefaultIssue();
                }
                this.setState({ issue });
            }
        }
    }

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        var overlayProps = {
            show: this.props.show,
            onBackgroundClick: this.props.onClose,
        };
        return (
            <Overlay {...overlayProps}>
                <div className="issue-dialog-box">
                    {this.renderForm()}
                    <div className="controls">
                        {this.renderButtons()}
                    </div>
                </div>
            </Overlay>
        );
    }

    /**
     * Render issue form
     *
     * @return {ReactElement}
     */
    renderForm() {
        return (
            <div className="container">
                <div className="top">
                    {this.renderTitleInput()}
                    {this.renderRepoSelector()}
                </div>
                {this.renderLabelSelector()}
            </div>
        );
    }

    /**
     * Render input for issue title
     *
     * @return {ReactElement}
     */
    renderTitleInput() {
        var t = this.props.locale.translate;
        var setters = this.components.setters;
        var props = {
            id: 'title',
            ref: setters.textField,
            value: this.getIssueProperty('title'),
            locale: this.props.locale,
            onChange: this.handleTitleChange,
        };
        return <TextField {...props}>{t('issue-title')}</TextField>;
    }

    /**
     * Render select control for repo if there're more than one
     *
     * @return {[type]}
     */
    renderRepoSelector() {
        var t = this.props.locale.translate;
        var p = this.props.locale.pick;
        var repos = this.getAvailableRepos();
        if (repos.length <= 1) {
            return null;
        }
        var repo = this.getSelectedRepo();
        var options = _.map(repos, (repo, index) => {
            var title = p(repo.details.title) || repo.name;
            return <option key={index} value={repo.id}>{title}</option>;
        });
        return (
            <div className="select-field">
                <label>{t('issue-repo')}</label>
                <select value={repo.id} onChange={this.handleRepoChange}>
                    {options}
                </select>
            </div>
        );
    }

    /**
     * Render tag selector
     *
     * @return {ReactElement}
     */
    renderLabelSelector() {
        var repo = this.getSelectedRepo();
        if (!repo) {
            return null;
        }
        var selectedLabels = this.getIssueProperty('labels') || [];
        var labels = repo.details.labels;
        var labelColors = repo.details.label_colors;
        var tags = _.map(labels, (label, index) => {
            var props = {
                className: 'tag',
                style: {
                    backgroundColor: labelColors[index],
                },
                'data-label': label,
                onClick: this.handleTagClick,
            };
            if (_.includes(selectedLabels, label)) {
                props.className += ' selected';
            }
            return <span key={index} {...props}>{label}</span>;
        });
        for (var i = 1; i < tags.length; i += 2) {
            tags.splice(i, 0, ' ');
        }
        return  <div className="tags">{tags}</div>;
    }

    /**
     * Render buttons
     *
     * @return {ReactElement}
     */
    renderButtons() {
        var t = this.props.locale.translate;
        var repo = this.getSelectedRepo();
        var text = this.getIssueProperty('title');
        var changed = !!_.trim(text);
        var canDelete = false;
        if (this.props.issue) {
            if (this.state.issue) {
                changed = !_.isEqual(this.state.issue, this.props.issue);
            } else {
                changed = false;
            }
            if (this.props.issue && this.props.issue.id) {
                canDelete = true;
            }
        }
        if (!this.props.allowDeletion) {
            canDelete = false;
        }
        var deleteProps = {
            label: t('issue-delete'),
            emphasized: false,
            hidden: !canDelete,
            onClick: this.handleDeleteClick,
        };
        var cancelProps = {
            label: t('issue-cancel'),
            emphasized: false,
            onClick: this.handleCancelClick,
        };
        var confirmProps = {
            label: t('issue-ok'),
            emphasized: true,
            disabled: !changed || !repo,
            onClick: this.handleOKClick,
        };
        return (
            <div className="buttons">
                <div className="left">
                    <PushButton {...deleteProps} />
                </div>
                <div className="right">
                    <PushButton {...cancelProps} />
                    <PushButton {...confirmProps} />
                </div>
            </div>
        );
    }

    /**
     * Focus text field on mount
     */
    componentDidMount() {
        // only if the title is currently empty
        if (!this.getIssueProperty('title')) {
            this.components.textField.focus();
        }
    }

    /**
     * Called when user clicks the delete button
     *
     * @param  {Event} evt
     */
    handleDeleteClick = (evt) => {
        if (this.props.onConfirm) {
            this.props.onConfirm({
                type: 'confirm',
                target: this,
                issue: null,
            });
        }
    }

    /**
     * Called when user clicks the cancel button
     *
     * @param  {Event} evt
     */
    handleCancelClick = (evt) => {
        if (this.props.onCancel) {
            this.props.onCancel({
                type: 'cancel',
                target: this,
            });
        }
    }

    /**
     * Called when user clicks the open button
     *
     * @param  {Event} evt
     */
    handleOKClick = (evt) => {
        var story = this.props.story;
        var issue = _.clone(this.state.issue);
        var repo = this.getSelectedRepo();
        // make sure id is set
        issue.repo_id = repo.id;
        // make use the selected labels exist in the selected repo only
        issue.labels = _.intersection(issue.labels, repo.details.labels);
        if (this.props.onConfirm) {
            this.props.onConfirm({
                type: 'close',
                target: this,
                issue
            });
        }
    }

    /**
     * Called when user changes the title
     *
     * @param  {Event} evt
     */
    handleTitleChange = (evt) => {
        var text = evt.target.value;
        this.setIssueProperty('title', text);
    }

    /**
     * Called when user selects a repo
     *
     * @param  {Event} evt
     */
    handleRepoChange = (evt) => {
        var repoId = parseInt(evt.target.value);
        this.setIssueProperty('repo_id', repoId);
    }

    /**
     * Called when user clicks a tag
     *
     * @param  {[type]} evt
     *
     * @return {[type]}
     */
    handleTagClick = (evt) => {
        var label = evt.target.getAttribute('data-label');
        var labels = this.getIssueProperty('labels') || [];
        if (_.includes(labels, label)) {
            labels = _.difference(labels, [ label ]);
        } else {
            labels = _.union(labels, [ label ]);
        }
        this.setIssueProperty('labels', labels);
    }
}

var lastSelectedRepoId = parseInt(window.localStorage.last_selected_repo_id) || undefined;

export {
    IssueDialogBox as default,
    IssueDialogBox,
};

import Locale from 'locale/locale';
import Theme from 'theme/theme';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    IssueDialogBox.propTypes = {
        show: PropTypes.bool,
        allowDeletion: PropTypes.bool.isRequired,
        story: PropTypes.object.isRequired,
        repos: PropTypes.arrayOf(PropTypes.object),
        issue: PropTypes.object,

        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,

        onConfirm: PropTypes.func,
        onClose: PropTypes.func,
    };
}
