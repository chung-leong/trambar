import _ from 'lodash';
import React, { PureComponent } from 'react';
import UserUtils from 'objects/utils/user-utils';

// widgets
import Overlay from 'widgets/overlay';
import PushButton from 'widgets/push-button';
import Scrollable from 'widgets/scrollable';
import ProfileImage from 'widgets/profile-image';

import './multiple-user-names.scss';

class MultipleUserNames extends PureComponent {
    static displayName = 'MultipleUserNames';

    constructor(props) {
        super(props);
        this.state = {
            showingPopUp: false,
            showingDialogBox: false,
            renderingDialogBox: false,
        };
    }

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        var className = 'multiple-user-names';
        if (this.props.className) {
            className += ` ${this.props.className}`;
        }
        var containerProps = {
            className: className,
            onMouseEnter: this.handleMouseEnter,
            onMouseLeave: this.handleMouseLeave,
        };
        var labelProps = {
            className: 'label',
            onClick: this.handleClick,
        };
        return (
            <span {...containerProps}>
                <span {...labelProps}>{this.props.label}</span>
                {this.renderPopUp()}
                {this.renderDialogBox()}
            </span>
        )
    }

    /**
     * Render mouse rollover popup
     *
     * @return {ReactElement|null}
     */
    renderPopUp() {
        if (!this.state.showingPopUp) {
            return null;
        }
        return (
            <div className="popup-container">
                <div className="popup">
                    {this.renderUserList(this.props.popupLimit)}
                </div>
            </div>
        );
    }

    /**
     * Render overlay that appears when user clicks on the label
     *
     * @return {ReactElement|null}
     */
    renderDialogBox() {
        if (!this.state.renderingDialogBox) {
            return null;
        }
        var overlayProps = {
            show: this.state.showingDialogBox,
            onBackgroundClick: this.handleDialogBoxClose,
        };
        var buttonProps = {
            label: 'OK',
            emphasized: true,
            onClick: this.handleDialogBoxClose,
        };
        return (
            <Overlay {...overlayProps}>
                <div className="multiple-user-names-dialog-box">
                    <Scrollable>
                        <div className="list">
                            {this.renderUserList()}
                        </div>
                    </Scrollable>
                    <div className="buttons">
                        <PushButton {...buttonProps} />
                    </div>
                </div>
            </Overlay>
        );
    }

    /**
     * Render user list
     *
     * @param  {Number} limit
     *
     * @return {Array<ReactElement>}
     */
    renderUserList(limit) {
        var p = this.props.locale.pick;
        var users = _.sortBy(this.props.users, (user) => {
            return p(user.details.name);
        });
        if (users.length > limit) {
            var t = this.props.locale.translate;
            var chunk = _.slice(users, limit);
            var elements = _.map(chunk, this.renderUser);
            elements.push(
                <div key={0} className="more">
                    {t('list-$count-more', users.length - chunk.length)}
                </div>
            );
            return elements;
        } else {
            return _.map(users, this.renderUser);
        }
    }

    /**
     * Render user profile image and name
     *
     * @param  {User} user
     * @param  {Number} index
     *
     * @return {ReactELement}
     */
    renderUser(user, index) {
        var userProps = {
            user,
            theme: this.props.theme,
            locale: this.props.locale,
        };
        return <User key={user.id} {...userProps} />;
    }

    /**
     * Called when mouse cursor enters the label
     *
     * @param  {Event} evt
     */
    handleMouseEnter = (evt) => {
        this.setState({ showingPopUp: true });
    }

    /**
     * Called when mouse cursor exits the label
     *
     * @param  {Event} evt
     */
    handleMouseLeave = (evt) => {
        this.setState({ showingPopUp: false });
    }

    /**
     * Called when user clicks on label
     *
     * @param  {Event} evt
     */
    handleClick = (evt) => {
        this.setState({
            showingPopUp: false,
            showingDialogBox: true,
            renderingDialogBox: true
        });
    }

    /**
     * Called when user clicks the OK button or outside the dialog box
     *
     * @param  {Event} evt
     */
    handleDialogBoxClose = (evt) => {
        this.setState({ showingDialogBox: false }, () => {
            setTimeout(() => {
                this.setState({ renderingDialogBox: false });
            }, 1000)
        });
    }
}

function User(props) {
    var classNames = [ 'user' ];
    var imageProps = {
        user: props.user,
        theme: props.theme,
        size: 'small',
    };
    var name = UserUtils.getDisplayName(props.user, props.locale);
    return (
        <div className={classNames.join(' ')}>
            <ProfileImage {...imageProps} />
            <span className="name">{name}</span>
        </div>
    );
}

MultipleUserNames.defaultProps = {
    popupLimit: 8
};

export {
    MultipleUserNames as default,
    MultipleUserNames,
};

import Locale from 'locale/locale';
import Theme from 'theme/theme';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    MultipleUserNames.propTypes = {
        label: PropTypes.string,
        title: PropTypes.string,
        users: PropTypes.arrayOf(PropTypes.object).isRequired,
        popupLimit: PropTypes.number,

        locale: PropTypes.instanceOf(Locale).isRequired,
        theme: PropTypes.instanceOf(Theme).isRequired,
    };
}
