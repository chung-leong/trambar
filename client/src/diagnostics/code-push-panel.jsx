import _ from 'lodash';
import React, { Component } from 'react';

// widgets
import SettingsPanel from 'widgets/settings-panel';
import DiagnosticsSection from 'widgets/diagnostics-section';

import './code-push-panel.scss';

/**
 * Diagnostic panel displaying state of RemoteDataSource
 *
 * @extends Component
 */
class CodePushPanel extends Component {
    static displayName = 'CodePushPanel';

    /**
     * Render diagnostics
     *
     * @return {ReactElement}
     */
    render() {
        let { codePush } = this.props;
        let {
            lastSyncTime,
            lastSyncStatus,
            currentPackage,
            pendingPackage,
        } = codePush;
        return (
            <SettingsPanel className="code-push">
                <header>
                    <i className="fa fa-gear" /> Code Push
                </header>
                <body>
                    <DiagnosticsSection label="Update check">
                        <div>Last check: {lastSyncTime}</div>
                        <div>Result: {lastSyncStatus}</div>
                    </DiagnosticsSection>
                    <CodePushPackageDiagnostics label="Current package" package={currentPackage} />
                    <CodePushPackageDiagnostics label="Pending package" package={pendingPackage} />
                </body>
            </SettingsPanel>
        );
    }
}

function CodePushPackageDiagnostics(props) {
    if (!props.package) {
        return null;
    }
    let pkg = props.package;
    return (
        <DiagnosticsSection label={props.label}>
            <div>Label: {pkg.label}</div>
            <div>Description: {pkg.description}</div>
            <div>First run: {pkg.isFristRun ? 'yes' : 'no'}</div>
            <div>Mandatory: {pkg.isMandatory ? 'yes' : 'no'}</div>
            <div>Package hash: {_.truncate(pkg.packageHash, { length: 15 })}</div>
            <div>Package size: {pkg.packageSize}</div>
        </DiagnosticsSection>
    );
}

export {
    CodePushPanel as default,
    CodePushPanel,
};

import CodePush from 'transport/code-push';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    CodePushPanel.propTypes = {
        codePush: PropTypes.instanceOf(CodePush),
    };
}
