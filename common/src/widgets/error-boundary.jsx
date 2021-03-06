import _ from 'lodash';
import React, { Component } from 'react';

require('./error-boundary.scss');

/**
 * Component for trapping JavaScript exeception encountered during rendering
 * cycles.
 *
 * @extends {Component}
 */
class ErrorBoundary extends Component {
    static displayName = 'ErrorBoundary';

    constructor(props) {
        super(props);
        this.state = { error: null, errorChildren: null };
    }

    static getDerivedStateFromProps(props, state) {
        let { children } = props;
        let { errorChildren } = state;
        if (errorChildren) {
            if (!compareChildren(children, errorChildren)) {
                return { error: null, errorChildren: null };
            }
        }
        return null;
    }

    render() {
        let { children, showError } = this.props;
        let { error } = this.state;
        if (error) {
            let expectedErrors = [ 401, 403, 404 ];
            // don't render 401, 403, and 404 errors since we handle those by redirecting
            if (showError && !_.includes(expectedErrors, error.statusCode)) {
                return <div className="error-boundary">{error.message}</div>;
            } else {
                return null;
            }
        }
        return children || null;
    }

    componentDidCatch(error, info) {
        let { env, children } = this.props;
        this.setState({ error, errorChildren: children });
        env.logError(error, info);
    }
}

ErrorBoundary.defaultProps = {
    showError: true,
};

function compareChildren(c1, c2) {
    if (c1 === c2) {
        return true;
    }
    c1 = React.Children.toArray(c1);
    c2 = React.Children.toArray(c2);
    if (c1.length !== c2.length) {
        return false;
    }
    for (let i = 0; i < c1.length; i++) {
        if (!compareElements(c1[i], c2[i])) {
            return false;
        }
    }
    return true;
}

function compareElements(e1, e2) {
    if (e1.type !== e2.type) {
        return false;
    }
    let diff = _.shallowDiff(e1.props, e2.props);
    return _.isEmpty(diff);
}

export {
    ErrorBoundary as default,
    ErrorBoundary,
};

import Environment from 'env/environment';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    ErrorBoundary.propTypes = {
        env: PropTypes.instanceOf(Environment).isRequired,
        showError: PropTypes.bool,
    };
}
