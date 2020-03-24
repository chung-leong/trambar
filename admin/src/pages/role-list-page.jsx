import React, { useMemo } from 'react';
import { useProgress, useListener, useErrorCatcher } from 'relaks';
import { findAllRoles } from 'common/objects/finders/role-finder.js';
import { disableRoles, restoreRoles } from 'common/objects/savers/role-saver.js';
import { getRoleName } from 'common/objects/utils/role-utils.js';
import { findUsersWithRoles } from 'common/objects/finders/user-finder.js';
import { orderBy } from 'common/utils/array-utils.js';

// widgets
import { PushButton } from '../widgets/push-button.jsx';
import { ComboButton } from '../widgets/combo-button.jsx';
import { SortableTable, TH } from '../widgets/sortable-table.jsx';
import { UserTooltip } from '../tooltips/user-tooltip.jsx';
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

import './role-list-page.scss';

export default async function RoleListPage(props) {
  const { database } = props;
  const [ show ] = useProgress();

  render();
  const currentUserID = await database.start();
  const roles = await findAllRoles(database);
  render();
  const users = await findUsersWithRoles(database, roles);
  render();

  function render() {
    const sprops = { roles, users };
    show(<RoleListPageSync {...sprops} {...props} />);
  }
}

function RoleListPageSync(props) {
  const { roles, users } = props;
  const { database, route, env, editing } = props;
  const { t, p, f } = env.locale;
  const readOnly = !editing;
  const activeRoles = filterRoles(roles);
  const selection = useSelectionBuffer({
    original: activeRoles,
    reset: readOnly,
  });
  const [ sort, handleSort ] = useSortHandler();
  const visibleRoles = useMemo(() => {
    const visible = (selection.shown) ? roles : activeRoles;
    return sortRoles(visible, users, env, sort);
  }, [ selection.shown, users, env, sort ]);
  const [ error, run ] = useErrorCatcher();
  const [ confirmationRef, confirm ] = useConfirmation();
  const warnDataLoss = useDataLossWarning(route, env, confirm);

  const handleRowClick = useRowToggle(selection, roles);
  const handleEditClick = useListener((evt) => {
    route.replace({ editing: true });
  });
  const handleCancelClick = useListener((evt) => {
    route.replace({ editing: undefined });
  });
  const handleAddClick = useListener((evt) => {
    route.push('role-summary-page', { roleID: 'new' });
  });
  const handleSaveClick = useListener((evt) => {
    run(async () => {
      const removing = selection.removing();
      if (removing.length > 0) {
        await confirm(t('role-list-confirm-disable-$count', removing.length));
      }
      const adding = selection.adding();
      if (adding.length > 0) {
        await confirm(t('role-list-confirm-reactivate-$count', adding.length));
      }
      await disableRoles(database, removing);
      await restoreRoles(database, adding);
      warnDataLoss(false);
      handleCancelClick();
    });
  });

  warnDataLoss(selection.changed);

  return (
    <div className="role-list-page">
      {renderButtons()}
      <h2>{t('role-list-title')}</h2>
      <UnexpectedError error={error} />
      {renderTable()}
      <ActionConfirmation ref={confirmationRef} env={env} />
    </div>
  );

  function renderButtons() {
    if (readOnly) {
      const preselected = 'add';
      const empty = !roles?.length;
      return (
        <div className="buttons">
          <ComboButton preselected={preselected}>
            <option name="add" onClick={handleAddClick}>
              {t('role-list-add')}
            </option>
          </ComboButton>
          {' '}
          <PushButton className="emphasis" disabled={empty} onClick={handleEditClick}>
            {t('role-list-edit')}
          </PushButton>
        </div>
      );
    } else {
      const { changed } = selection;
      return (
        <div className="buttons">
          <PushButton onClick={handleCancelClick}>
            {t('role-list-cancel')}
          </PushButton>
          {' '}
          <PushButton className="emphasis" disabled={!changed} onClick={handleSaveClick}>
            {t('role-list-save')}
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
      tableProps.expanded = !!editing;
      tableProps.onClick = handleRowClick;
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
        {renderUsersColumn()}
        {renderModifiedTimeColumn()}
      </tr>
    );
  }

  function renderRows() {
    return visibleRoles.map(renderRow);
  }

  function renderRow(role) {
    const classNames = [];
    let onClick, title;
    if (role.deleted) {
      classNames.push('deleted');
      title = t('role-list-status-deleted');
    } else if (role.disabled) {
      classNames.push('disabled');
      title = t('role-list-status-disabled');
    }
    if (selection.shown) {
      if (selection.isExisting(role)) {
        classNames.push('fixed');
      }
      if (selection.isKeeping(role)) {
        classNames.push('selected');
      }
      onClick = handleRowClick;
    }
    const props = {
      className: classNames.join(' '),
      'data-id': role.id,
      title,
      onClick,
    };
    return (
      <tr key={role.id} {...props}>
        {renderTitleColumn(role)}
        {renderUsersColumn(role)}
        {renderModifiedTimeColumn(role)}
      </tr>
    );
  }

  function renderTitleColumn(role) {
    if (!role) {
      return <TH id="title">{t('role-list-column-title')}</TH>;
    } else {
      const title = getRoleName(role, env) || '-';
      let url, badge;
      if (selection.shown) {
        // add a badge next to the name if we're disabling or
        // restoring a role
        if (selection.isAdding(role)) {
          badge = <ActionBadge type="reactivate" env={env} />;
        } else if (selection.isRemoving(role)) {
          badge = <ActionBadge type="disable" env={env} />;
        }
      } else {
        const params = { roleID: role.id };
        url = route.find('role-summary-page', params);
      }
      return (
        <td>
          <a href={url}>{title}</a> {badge}
        </td>
      );
    }
  }

  function renderUsersColumn(role) {
    if (!env.isWiderThan('narrow')) {
      return null;
    }
    if (!role) {
      return <TH id="users">{t('role-list-column-users')}</TH>;
    } else {
      const props = {
        users: findUsers(users, role),
        disabled: selection.shown,
        route,
        env,
      };
      return <td><UserTooltip {...props} /></td>;
    }
  }

  function renderModifiedTimeColumn(role) {
    if (!env.isWiderThan('standard')) {
      return null;
    }
    if (!role) {
      return <TH id="mtime">{t('role-list-column-last-modified')}</TH>
    } else {
      const props = {
        time: role.mtime,
        disabled: selection.shown,
        env,
      };
      return <td><ModifiedTimeTooltip {...props} /></td>;
    }
  }
}

function filterRoles(roles) {
  return roles.filter((role) => {
    return !role.deleted && !role.disabled;
  });
}

function sortRoles(roles, users, env, sort) {
  if (!roles) {
    return [];
  }
  const columns = sort.columns.map((column) => {
    switch (column) {
      case 'title':
        return (role) => {
          return getRoleName(role, env).toLowerCase();
        };
      case 'users':
        return (role) => {
          return findUsers(users, role)?.length || 0;
        };
      default:
        return column;
    }
  });
  return orderBy(roles, columns, sort.directions);
}

function findUsers(users, role) {
  return users.filter((user) => {
    return (user.role_ids.includes(role.id));
  });
}
