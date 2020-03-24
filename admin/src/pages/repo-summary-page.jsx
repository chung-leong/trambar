import React, { useState } from 'react';
import { useProgress, useListener, useErrorCatcher } from 'relaks';
import { findProject } from 'common/objects/finders/project-finder.js';
import { findRepo } from 'common/objects/finders/repo-finder.js';
import { saveRepo } from 'common/objects/savers/repo-saver.js';
import { getRepoName } from 'common/objects/utils/repo-utils.js';
import { findDailyActivitiesOfRepo } from 'common/objects/finders/statistics-finder.js';
import { findSystem } from 'common/objects/finders/system-finder.js';

// widgets
import { PushButton } from '../widgets/push-button.jsx';
import { ComboButton } from '../widgets/combo-button.jsx';
import { InstructionBlock } from '../widgets/instruction-block.jsx';
import { TextField } from '../widgets/text-field.jsx';
import { URLLink } from '../widgets/url-link.jsx';
import { MultilingualTextField } from '../widgets/multilingual-text-field.jsx';
import { ActivityChart } from '../widgets/activity-chart.jsx';
import { ActionConfirmation } from '../widgets/action-confirmation.jsx';
import { UnexpectedError } from '../widgets/unexpected-error.jsx';
import { ErrorBoundary } from 'common/widgets/error-boundary.jsx';

// custom hooks
import {
  useDraftBuffer,
  useValidation,
  useConfirmation,
  useDataLossWarning,
} from '../hooks.js';

import './repo-summary-page.scss';

export default async function RepoSummaryPage(props) {
  const { database, projectID, repoID } = props;
  const [ show ] = useProgress();

  render();
  const currentUserID = await database.start()
  const system = await findSystem(database);
  const repo = await findRepo(database, repoID);
  render();
  const project = await findProject(database, projectID);
  render();
  const statistics = await findDailyActivitiesOfRepo(database, project, repo);
  render();

  function render() {
    const sprops = { system, repo, project, statistics };
    show(<RepoSummaryPageSync key={repoID} {...sprops} {...props} />);
  }
}

function RepoSummaryPageSync(props) {
  const { system, repo, project, statistics } = props;
  const { database, route, env, editing } = props;
  const { t, p } = env.locale;
  const availableLanguageCodes = system?.settings?.input_languages ?? [];
  const readOnly = !editing;
  const draft = useDraftBuffer({
    original: repo,
    reset: readOnly,
  });
  const [ error, run ] = useErrorCatcher();
  const [ problems, reportProblems ] = useValidation(!readOnly);
  const [ confirmationRef, confirm ] = useConfirmation();
  const warnDataLoss = useDataLossWarning(route, env, confirm);
  const baseURL = repo?.details?.web_url;

  const handleEditClick = useListener((evt) => {
    route.push({ editing: true });
  });
  const handleCancelClick = useListener((evt) => {
    route.push({ editing: undefined });
  });
  const handleReturnClick = useListener((evt) => {
    route.push('repo-list-page', { projectID: project.id });
  });
  const handleRemoveClick = useListener((evt) => {
    run(async () => {
      await confirm(t('repo-summary-confirm-remove'));
      await ProjectSaver.removeFromRepoList(database, project, repo.id);
    });
  });
  const handleRestoreClick = useListener((evt) => {
    run(async () => {
      await confirm(t('repo-summary-confirm-restore'));
      await ProjectSaver.addToRepoList(database, project, repo.id);
    });
  });
  const handleSaveClick = useListener((evt) => {
    run(async () => {
      await saveRepo(database, draft.current);
      warnDataLoss(false);
      handleCancelClick();
    });
  });
  const handleTitleChange = useListener((evt) => {
    const title = evt.target.value;
    draft.set('details.title', title);
  });

  warnDataLoss(draft.changed);

  const { changed } = draft;
  const title = getRepoName(repo, env);
  return (
    <div className="repo-summary-page">
      {renderButtons()}
      <h2>{t('repo-summary-$title', title)}</h2>
      <UnexpectedError error={error} />
      {renderForm()}
      {renderInstructions()}
      {renderChart()}
      <ActionConfirmation ref={confirmationRef} env={env} />
    </div>
  );

  function renderButtons() {
    if (readOnly) {
      const active = (project && repo) ? project.repo_ids.includes(repo.id) : true;
      const preselected = (!active) ? 'restore' : undefined;
      return (
        <div key="view" className="buttons">
          <ComboButton preselected={preselected}>
            <option name="return" onClick={handleReturnClick}>
              {t('repo-summary-return')}
            </option>
            <option name="remove" disabled={!active} onClick={handleRemoveClick}>
              {t('repo-summary-remove')}
            </option>
            <option name="restore" hidden={active} onClick={handleRestoreClick}>
              {t('repo-summary-restore')}
            </option>
          </ComboButton>
          {' '}
          <PushButton className="emphasis" onClick={handleEditClick}>
            {t('repo-summary-edit')}
          </PushButton>
        </div>
      );
    } else {
      return (
        <div key="edit" className="buttons">
          <PushButton onClick={handleCancelClick}>
            {t('repo-summary-cancel')}
          </PushButton>
          {' '}
          <PushButton className="emphasis" disabled={!changed} onClick={handleSaveClick}>
            {t('repo-summary-save')}
          </PushButton>
        </div>
      );
    }
  }

  function renderForm() {
    return (
      <div className="form">
        {renderTitleInput()}
        {renderNameInput()}
        {renderIssueTrackingStatus()}
      </div>
    );
  }

  function renderTitleInput() {
    const props = {
      id: 'title',
      value: draft.get('details.title', {}),
      availableLanguageCodes,
      readOnly,
      env,
      onChange: handleTitleChange,
    };
    return (
      <MultilingualTextField {...props}>
        {t('repo-summary-title')}
      </MultilingualTextField>
    );
  }

  function renderNameInput() {
    const props = {
      id: 'name',
      value: draft.get('name', ''),
      readOnly: true,
      env,
    };
    return (
      <TextField {...props}>
        {t('repo-summary-gitlab-name')}
        {' '}
        <URLLink url={baseURL} />
      </TextField>
    );
  }

  function renderIssueTrackingStatus() {
    const status = draft.get('details.issues_enabled') ? 'enabled' : 'disabled';
    const props = {
      id: 'issue-tracker',
      value: t(`repo-summary-issue-tracker-${status}`),
      readOnly: true,
      env,
    };
    return (
      <TextField {...props}>
        {t('repo-summary-issue-tracker')}
      </TextField>
    );
  }

  function renderInstructions() {
    const instructionProps = {
      folder: 'repo',
      topic: 'repo-summary',
      hidden: !editing,
      env,
    };
    return (
      <div className="instructions">
        <InstructionBlock {...instructionProps} />
      </div>
    );
  }

  function renderChart() {
    const chartProps = { statistics, env };
    return (
      <div className="statistics">
        <ErrorBoundary env={env}>
          <ActivityChart {...chartProps}>
            {t('repo-summary-statistics')}
          </ActivityChart>
        </ErrorBoundary>
      </div>
    );
  }
}
