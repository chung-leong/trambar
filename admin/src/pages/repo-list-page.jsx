import React, { useMemo } from 'react';
import { useProgress, useListener, useErrorCatcher } from 'relaks';
import { findProject } from 'common/objects/finders/project-finder.js';
import { associateRepos } from 'common/objects/savers/project-saver.js';
import { findExistingRepos } from 'common/objects/finders/repo-finder.js';
import { getRepoName } from 'common/objects/utils/repo-utils.js';
import { findRepoServers } from 'common/objects/finders/server-finder.js';
import { getServerName, getServerIconClass } from 'common/objects/utils/server-utils.js';
import { findDailyActivitiesOfRepos } from 'common/objects/finders/statistics-finder.js';
import { findLink } from 'common/objects/utils/external-data-utils.js';
import { findByIds, orderBy } from 'common/utils/array-utils.js';

// widgets
import { PushButton } from '../widgets/push-button.jsx';
import { SortableTable, TH } from '../widgets/sortable-table.jsx';
import { ActivityTooltip } from '../tooltips/activity-tooltip.jsx';
import { ModifiedTimeTooltip } from '../tooltips/modified-time-tooltip.jsx'
import { ActionBadge } from '../widgets/action-badge.jsx';
import { ActionConfirmation } from '../widgets/action-confirmation.jsx';
import { UnexpectedError } from '../widgets/unexpected-error.jsx';

// custom hooks
import {
  useSelectionBuffer,
  useSortHandler,
  useRowToggle,
  useConfirmation,
  useDataLossWarning,
} from '../hooks.js';

import './repo-list-page.scss';

export default async function RepoListPage(props) {
  const { database, projectID } = props;
  const [ show ] = useProgress();

  render();
  const currentUserID = await database.start();
  const project = await findProject(database, projectID);
  const repos = await findExistingRepos(database);
  render();
  const servers = await findRepoServers(database, repos);
  render();
  const linkedRepos = findByIds(repos, project.repo_ids);
  const statistics = await findDailyActivitiesOfRepos(database, project, linkedRepos);
  render();

  function render() {
    const sprops = { project, repos, servers, statistics };
    show(<RepoListPageSync {...sprops} {...props} />);
  }
}

function RepoListPageSync(props) {
  const { project, repos, servers, statistics } = props;
  const { database, route, env, editing } = props;
  const { t, p, f } = env.locale;
  const readOnly = !editing;
  const linkedRepos = useMemo(() => {
    if (!project) {
      return [];
    }
    return findByIds(repos, project.repo_ids);
  }, [ project ]);
  const selection = useSelectionBuffer({
    original: linkedRepos,
    save: (base, ours) => {
    },
    reset: readOnly,
  });
  const [ sort, handleSort ] = useSortHandler();
  const visibleRepos = useMemo(() => {
    const visible = (selection.shown) ? repos : linkedRepos;
    return sortRepos(visible, servers, statistics, env, sort);
  }, [ selection.shown, repos, servers, statistics, env, sort ]);
  const [ error, run ] = useErrorCatcher();
  const [ confirmationRef, confirm ]  = useConfirmation();
  const warnDataLoss = useDataLossWarning(route, env, confirm);

  const handleRowClick = useRowToggle(selection, repos);
  const handleEditClick = useListener((evt) => {
    route.replace({ editing: true });
  });
  const handleCancelClick  = useListener((evt) => {
    route.replace({ editing: undefined });
  });
  const handleSaveClick = useListener((evt) => {
    run(async () => {
      const removing = selection.removing();
      if (removing.length > 0) {
        await confirm(t('repo-list-confirm-remove-$count', removing.length));
      }
      await associateRepos(database, project, selection.current);
      warnDataLoss(false);
      handleCancelClick();
    });
  });

  warnDataLoss(selection.changed);

  return (
    <div className="repo-list-page">
      {renderButtons()}
      <h2>{t('repo-list-title')}</h2>
      <UnexpectedError error={error} />
      {renderTable()}
      <ActionConfirmation ref={confirmationRef} env={env} />
    </div>
  );

  function renderButtons() {
    if (readOnly) {
      const empty = !repos?.length;
      return (
        <div className="buttons">
          <PushButton className="emphasis" disabled={empty} onClick={handleEditClick}>
            {t('repo-list-edit')}
          </PushButton>
        </div>
      );
    } else {
      const { changed } = selection;
      return (
        <div className="buttons">
          <PushButton onClick={handleCancelClick}>
            {t('repo-list-cancel')}
          </PushButton>
          {' '}
          <PushButton className="emphasis" disabled={!changed} onClick={handleSaveClick}>
            {t('repo-list-save')}
          </PushButton>
        </div>
      );
    }
  }

  function renderTable() {
    const tableProps = {
      sortColumns: sort.columns,
      sortDirections: sort.directions,
      onSort: handleSort,
    };
    if (selection.shown) {
      tableProps.expandable = true;
      tableProps.selectable = true;
      tableProps.expanded = !readOnly;
    }
    return (
      <SortableTable {...tableProps}>
        <thead>{renderHeadings()}</thead>
        <tbody>{renderRows()}</tbody>
      </SortableTable>
    );
  }

  function renderHeadings() {
    return (
      <tr>
        {renderTitleColumn()}
        {renderServerColumn()}
        {renderIssueTrackerColumn()}
        {renderDateRangeColumn()}
        {renderLastMonthColumn()}
        {renderThisMonthColumn()}
        {renderToDateColumn()}
        {renderModifiedTimeColumn()}
      </tr>
    );
  }

  function renderRows() {
    return visibleRepos.map(renderRow);
  }

  function renderRow(repo, i) {
    const classNames = [];
    let onClick;
    if (selection.shown) {
      if (selection.isExisting(repo)) {
        classNames.push('fixed');
      }
      if (selection.isKeeping(repo)) {
        classNames.push('selected');
      }
      onClick = handleRowClick;
    }
    const props = {
      className: classNames.join(' '),
      'data-id': repo.id,
      onClick,
    };
    return (
      <tr key={repo.id} {...props}>
        {renderTitleColumn(repo)}
        {renderServerColumn(repo)}
        {renderIssueTrackerColumn(repo)}
        {renderDateRangeColumn(repo)}
        {renderLastMonthColumn(repo)}
        {renderThisMonthColumn(repo)}
        {renderToDateColumn(repo)}
        {renderModifiedTimeColumn(repo)}
      </tr>
    );
  }

  function renderTitleColumn(repo) {
    if (!repo) {
      return <TH id="title">{t('repo-list-column-title')}</TH>;
    } else {
      const title = p(repo.details.title) || repo.name;
      let url, badge;
      if (selection.shown) {
        if (selection.isAdding(repo)) {
          badge = <ActionBadge type="add" env={env} />;
        } else if (selection.isRemoving(repo)) {
          badge = <ActionBadge type="remove" env={env} />;
        }
      } else {
        // don't create the link when we're editing the list
        const params = { ...route.params, repoID: repo.id };
        url = route.find('repo-summary-page', params);
      }
      return (
        <td>
          <a href={url}>{title}</a>{badge}
        </td>
      );
    }
  }

  function renderServerColumn(repo) {
    if (!repo) {
      return <TH id="server">{t('repo-list-column-server')}</TH>
    } else {
      const server = servers?.find(server => findLink(repo, server));
      let contents;
      if (server) {
        const title = getServerName(server, env);
        const iconClass = getServerIconClass(server);
        let url;
        if (!selection.shown) {
          url = route.find('server-summary-page', {
            serverID: server.id
          });
        }
        contents = (
          <a href={url}>
            <i className={`${iconClass} fa-fw`} />
            {' '}
            {title}
          </a>
        );
      }
      return <td>{contents}</td>;
    }
  }

  function renderIssueTrackerColumn(repo) {
    if (!env.isWiderThan('ultra-wide')) {
      return null;
    }
    if (!repo) {
      return <TH id="issue_tracker">{t('repo-list-column-issue-tracker')}</TH>
    } else {
      const enabled = !!repo.details.issues_enabled;
      return <td>{t(`repo-list-issue-tracker-enabled-${enabled}`)}</td>;
    }
  }

  function renderDateRangeColumn(repo) {
    if (!env.isWiderThan('wide')) {
      return null;
    }
    if (!repo) {
      return <TH id="range">{t('repo-list-column-date-range')}</TH>
    } else {
      const range = statistics?.[repo.id]?.range;
      const start = f(range?.start);
      const end = f(range?.end);
      return <td>{t('date-range-$start-$end', start, end)}</td>;
    }
  }

  function renderLastMonthColumn(repo) {
    if (!env.isWiderThan('super-wide')) {
      return null;
    }
    if (!repo) {
      return <TH id="last_month">{t('repo-list-column-last-month')}</TH>
    } else {
      const props = {
        statistics: statistics?.[repo.id]?.last_month,
        disabled: selection.shown,
        env,
      };
      return <td><ActivityTooltip {...props} /></td>;
    }
  }

  function renderThisMonthColumn(repo) {
    if (!env.isWiderThan('super-wide')) {
      return null;
    }
    if (!repo) {
      return <TH id="this_month">{t('repo-list-column-this-month')}</TH>
    } else {
      const props = {
        statistics: statistics?.[repo.id]?.this_month,
        disabled: selection.shown,
        env,
      };
      return <td><ActivityTooltip {...props} /></td>;
    }
  }

  function renderToDateColumn(repo) {
    if (!env.isWiderThan('super-wide')) {
      return null;
    }
    if (!repo) {
      return <TH id="to_date">{t('repo-list-column-to-date')}</TH>
    } else {
      const props = {
        statistics: statistics?.[repo.id]?.to_date,
        env,
      };
      return <td><ActivityTooltip {...props} /></td>;
    }
  }

  function renderModifiedTimeColumn(repo) {
    if (!env.isWiderThan('standard')) {
      return null;
    }
    if (!repo) {
      return <TH id="mtime">{t('repo-list-column-last-modified')}</TH>
    } else {
      const props = {
        time: repo.mtime,
        disabled: selection.shown,
        env,
      };
      return <td><ModifiedTimeTooltip {...props} /></td>;
    }
  }
}

function sortRepos(repos, servers, statistics, env, sort) {
  if (!repos) {
    return [];
  }
  const columns = sort.columns.map((column) => {
    switch (column) {
      case 'title':
        return (repo) => {
          return getRepoName(repo, env).toLowerCase();
        };
      case 'server':
        return (repo) => {
          let server = findServer(servers, repo);
          return getServerName(server, env).toLowerCase();
        };
      case 'issue_tracker':
        return 'details.issues_enabled';
      case 'range':
        return (repo) => {
          return statistics?.[repo.id]?.range?.start || '';
        };
      case 'last_month':
        return (repo) => {
          return statistics?.[repo.id]?.last_month?.total || 0;
        };
      case 'this_month':
        return (repo) => {
          return statistics?.[repo.id]?.this_month?.total || 0;
        };
      case 'to_date':
        return (repo) => {
          return statistics?.[repo.id]?.to_date?.total || 0;
        };
      default:
        return column;
    }
  });
  return orderBy(repos, columns, sort.directions);
}
