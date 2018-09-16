import _ from 'lodash';
import React, { PureComponent } from 'react';

// widgets
import SettingsPanel from 'widgets/settings-panel';
import PushButton from 'widgets/push-button';
import ConfirmationDialogBox from 'dialogs/confirmation-dialog-box';

require('./device-panel.scss');

class DevicePanel extends PureComponent {
    static displayName = 'DevicePanel';

    constructor(props) {
        super(props);
        this.state = {
            renderingDialog: null,
            showingDialog: false,
            selectedDeviceId: null,
        };
    }

    /**
     * Render component
     *
     * @return {ReactElement|null}
     */
    render() {
        let t = this.props.locale.translate;
        let title;
        if (_.size(this.props.devices) === 1) {
            title = t('settings-device');
        } else {
            title = t('settings-devices');
        }
        return (
            <SettingsPanel className="device">
                <header>
                    <i className="fa fa-tablet" /> {title}
                </header>
                <body>
                    {this.renderDevices()}
                    {this.renderDialogBox()}
                </body>
            </SettingsPanel>
        );
    }

    /**
     * Render list of projects
     *
     * @return {Array<ReactElement>}
     */
    renderDevices() {
        return _.map(this.props.devices, (device) => {
            return this.renderDevice(device);
        });
    }

    /**
     * Render a project option, with additional links if it's the current project
     *
     * @param  {Device} link
     *
     * @return {ReactElement}
     */
    renderDevice(device) {
        let t = this.props.locale.translate;
        let deviceName = formatDeviceName(device);
        return (
            <div key={device.id} className="device-option-button selected">
                <div className="icon">
                    <DeviceIcon type={device.type} />
                </div>
                <div className="text">
                    <span className="name">{deviceName}</span>
                    <div data-device-id={device.id} className="revoke" onClick={this.handleRevokeClick}>
                        <i className="fa fa-ban" />
                        {' '}
                        <span>{t('mobile-device-revoke')}</span>
                    </div>
                </div>
            </div>
        );
    }

    /**
     * Render sign out dialog box
     *
     * @return {ReactElement|null}
     */
    renderDialogBox() {
        if (this.state.renderingDialog !== 'revoke') {
            return null;
        }
        let t = this.props.locale.translate;
        let props = {
            show: this.state.showingDialog,
            locale: this.props.locale,
            onClose: this.handleDialogClose,
            onConfirm: this.handleRevokeConfirm,
        };
        return (
            <ConfirmationDialogBox {...props}>
                {t('mobile-device-revoke-are-you-sure')}
            </ConfirmationDialogBox>
        );
    }

    /**
     * Called when user clicks revoke button
     *
     * @param  {Event} evt
     */
    handleRevokeClick = (evt) => {
        let deviceId = parseInt(evt.currentTarget.getAttribute('data-device-id'));
        this.setState({
            renderingDialog: 'revoke',
            showingDialog: true,
            selectedDeviceId: deviceId
        });
    }

    /**
     * Called when user confirm his intention to remove authorization
     *
     * @param  {Object} evt
     */
    handleRevokeConfirm = (evt) => {
        let device = _.find(this.props.devices, { id: this.state.selectedDeviceId });
        let db = this.props.database.use({ schema: 'global', by: this });
        db.removeOne({ table: 'device' }, device).then(() => {
            return db.endMobileSession(device.session_handle);
        }).finally(() => {
            this.handleDialogClose();
        });
    }

    /**
     * Called when user closes dialog box
     *
     * @param  {Object} evt
     */
    handleDialogClose = (evt) => {
        this.setState({ showingDialog: false }, () => {
            setTimeout(() => {
                this.setState({ renderingDialog: false });
            }, 500);
        });
    }
}

function DeviceIcon(props) {
    let icon;
    switch (props.type) {
        case 'ios':
        case 'osx': icon = 'apple'; break;
        default: icon = props.type;
    }
    return (
        <div className="device-icon">
            <i className="fa fa-tablet background" />
            <i className={`fa fa-${icon} icon-overlay`} />
        </div>
    );
}

function formatDeviceName(device) {
    let manufacturer = device.details.manufacturer;
    let name = device.details.display_name || device.details.name;
    if (!_.includes(_.toLower(name), _.toLower(manufacturer))) {
        name = `${manufacturer} ${name}`;
    }
    return name;
}

export {
    DevicePanel as default,
    DevicePanel,
};

import Database from 'data/database';
import Route from 'routing/route';
import Environment from 'env/environment';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    DevicePanel.propTypes = {
        devices: PropTypes.arrayOf(PropTypes.object),

        database: PropTypes.instanceOf(Database).isRequired,
        route: PropTypes.instanceOf(Route).isRequired,
        env: PropTypes.instanceOf(Environment).isRequired,
    };
}
