import React from 'react';

import './unexpected-error.scss';

/**
 * Stateless component that renders an error message returned by the server.
 */
function UnexpectedError(props) {
    let { children, type } = props;
    if (!children) {
        return null;
    }
    let className = 'unexpected-error';
    let icon = 'exclamation-circle';
    if (type === 'warning') {
        className += ' warning';
        icon = 'exclamation-triangle';
    }
    return (
        <div className={className}>
            <i className={`fa fa-${icon}`} />
            {' '}
            {props.children}
        </div>
    )
}

export {
    UnexpectedError as default,
    UnexpectedError,
};

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    UnexpectedError.propTypes = {
        type: PropTypes.oneOf([ 'error', 'warning' ]),
    };
}
