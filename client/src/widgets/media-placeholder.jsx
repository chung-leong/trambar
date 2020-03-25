import React from 'react';

import './media-placeholder.scss';

/**
 * Stateless component that fades advisory messages in and out for when
 * there aren't any attach media.
 */
export function MediaPlaceholder(props) {
  const { env, showHints } = props;
  const { t } = env.locale;
  let phraseIDs = [];
  if (env.pointingDevice === 'mouse') {
    if (showHints) {
      phraseIDs = [
        'story-drop-files-here',
        'story-paste-image-here',
      ]
    }
  }
  return (
    <div className="media-placeholder">
      {phraseIDs.map(renderMessage)}
    </div>
  );

  function renderMessage(phraseID, i) {
    const style = { animationDelay: `${10 * i}s` };
    return (
      <div key={i} className="message" style={style}>
        {t(phraseID)}
      </div>
    );
  }
}
