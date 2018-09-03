import _ from 'lodash';
import React, { PureComponent } from 'react';
import DeviceManager from 'media/device-manager';

// widgets
import HeaderButton from 'widgets/header-button';
import PhotoCaptureDialogBox from 'dialogs/photo-capture-dialog-box';
import VideoCaptureDialogBox from 'dialogs/video-capture-dialog-box';
import AudioCaptureDialogBox from 'dialogs/audio-capture-dialog-box';

import './media-toolbar.scss';

class MediaToolbar extends PureComponent {
    static displayName = 'MediaToolbar';

    constructor(props) {
        super(props);
        this.state = {
            hasCamera: DeviceManager.hasDevice('videoinput'),
            hasMicrophone: DeviceManager.hasDevice('audioinput'),
        };
    }

    /**
     * Count the type of resources attached to story
     *
     * @return {Object}
     */
    getResourceCounts() {
        var counts = {
            photo: 0,
            video: 0,
            audio: 0,
            file: 0,
        };
        var resources = _.get(this.props.story, 'details.resources');
        _.each(resources, (res) => {
            if (res.imported) {
                counts.file++;
            } else {
                switch (res.type) {
                    case 'image': counts.photo++; break;
                    case 'video': counts.video++; break;
                    case 'audio': counts.audio++; break;
                }
            }
        });
        return counts;
    }

    /**
     * Render component
     *
     * @return {ReactElement}
     */
    render() {
        var t = this.props.locale.translate;
        var counts = this.getResourceCounts();
        var canCaptureStaticImage = this.state.hasCamera && PhotoCaptureDialogBox.isAvailable();
        var canCaptureVideo = this.state.hasCamera && VideoCaptureDialogBox.isAvailable();
        var canCaptureAudio = this.state.hasMicrophone && AudioCaptureDialogBox.isAvailable();
        var photoButtonProps = {
            label: t('story-photo'),
            icon: 'camera',
            hidden: !counts.photo && !canCaptureStaticImage,
            disabled: !canCaptureStaticImage,
            highlighted: (counts.photo > 0 || this.props.capturing === 'image'),
            onClick: this.handlePhotoClick,
        };
        var videoButtonProps = {
            label: t('story-video'),
            icon: 'video-camera',
            hidden: !counts.video && !canCaptureVideo,
            disabled: !canCaptureVideo,
            highlighted: (counts.video > 0 || this.props.capturing === 'video'),
            onClick: this.handleVideoClick,
        };
        var audioButtonProps = {
            label: t('story-audio'),
            icon: 'microphone',
            hidden: !counts.audio && !canCaptureAudio,
            disabled: !canCaptureAudio,
            highlighted: (counts.audio > 0 || this.props.capturing === 'audio'),
            onClick: this.handleAudioClick,
        };
        var selectButtonProps = {
            label: t('story-file'),
            icon: 'file-photo-o',
            multiple: true,
            highlighted: (counts.file > 0),
            onChange: this.handleFileSelect,
        }
        return (
            <div className="media-toolbar">
                <HeaderButton {...photoButtonProps} />
                <HeaderButton {...videoButtonProps} />
                <HeaderButton {...audioButtonProps} />
                <HeaderButton.File {...selectButtonProps} />
            </div>
        );
    }

    /**
     * Add event listener on mount
     */
    componentDidMount() {
        DeviceManager.addEventListener('change', this.handleDeviceChange);
    }

    /**
     * Remove handlers on unmount
     */
    componentWillUnmount() {
        DeviceManager.removeEventListener('change', this.handleDeviceChange);
    }

    /**
     * Inform parent component that certain action should occur
     *
     * @param  {String} action
     * @param  {Object|undefined} props
     */
    triggerActionEvent(action, props) {
        if (this.props.onAction) {
            this.props.onAction(_.extend({
                type: 'action',
                target: this,
                action,
            }, props));
        }
    }

    /**
     * Called when user click on photo button
     *
     * @param  {Event} evt
     */
    handlePhotoClick = (evt) => {
        this.triggerActionEvent('photo-capture');
    }

    /**
     * Called when user click on video button
     *
     * @param  {Event} evt
     */
    handleVideoClick = (evt) => {
        this.triggerActionEvent('video-capture');
    }

    /**
     * Called when user click on audio button
     *
     * @param  {Event} evt
     */
    handleAudioClick = (evt) => {
        this.triggerActionEvent('audio-capture');
    }

    /**
     * Called after user has selected a file
     *
     * @param  {Event} evt
     */
    handleFileSelect = (evt) => {
        var files = evt.target.files;
        if (!_.isEmpty(files)) {
            this.triggerActionEvent('file-import', { files });
        }
    }

    /**
     * Called when the list of media devices changes
     *
     * @param  {Object} evt
     */
    handleDeviceChange = (evt) => {
        this.setState({
            hasCamera: DeviceManager.hasDevice('videoinput'),
            hasMicrophone: DeviceManager.hasDevice('audioinput'),
        });
    }
}

export {
    MediaToolbar as default,
    MediaToolbar,
};

import Locale from 'locale/locale';

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');

    MediaToolbar.propTypes = {
        story: PropTypes.object.isRequired,
        capturing: PropTypes.oneOf([ 'image', 'video', 'audio' ]),
        locale: PropTypes.instanceOf(Locale).isRequired,
        onAction: PropTypes.func,
    };
}
