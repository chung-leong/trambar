import _ from 'lodash';
import React from 'react';

import { Environment } from 'common/env/environment.js';

import { StoryTypes, StoryIcons } from 'common/objects/types/story-types.js';

// widgets
import { Tooltip } from '../widgets/tooltip.jsx';

import './activity-tooltip.scss';

/**
 * Tooltip listing the number of activities by type.
 */
export function ActivityTooltip(props) {
  const { env, statistics, disabled } = props;
  const { t } = env.locale;
  if (!statistics) {
    return null;
  }
  if (statistics.total === 0 && statistics.dirty) {
    // don't show 0 when stats are in the process of being generated
    return null;
  }
  let label = t('activity-tooltip-$count', statistics.total);
  if (statistics.total === undefined) {
    label = '-';
  }
  const list = [];
  for (let type of StoryTypes) {
    const count = statistics[type];
    if (count) {
      const Icon = StoryIcons[type];
      list.push(
        <div className="item" key={type}>
          <Icon className="icon" />
          {' '}
          {t(`activity-tooltip-$count-${type}`, count)}
        </div>
      );
    }
  }
  return (
    <Tooltip className="activity" disabled={disabled}>
      <inline>{label}</inline>
      <window>
        {list}
      </window>
    </Tooltip>
  );
}
