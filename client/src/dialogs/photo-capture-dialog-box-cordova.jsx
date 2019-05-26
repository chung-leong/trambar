import _ from 'lodash';
import Promise from 'bluebird';
import React, { useEffect } from 'react';
import * as MediaLoader from 'common/media/media-loader.mjs';
import CordovaFile from 'common/transport/cordova-file.mjs';

/**
 * Non-visual component that uses the Camera Cordova plugin to take a photo.
 */
function PhotoCaptureDialogBoxCordova(props) {
    const { payloads, cameraDirection, show } = props;
    const { onClose, onCapture, onCapturePending, onCaptureError } = props;

    useEffect(() => {
        const handleSuccess = async (imageURL) => {
            const file = new CordovaFile(imageURL);
            if (onClose) {
                onClose({});
            }
            if (onCapturePending) {
                onCapturePending({ resourceType: 'image' });
            }
            try {
                await file.obtainMetadata();
                const meta = await MediaLoader.getImageMetadata(file);
                const payload = payloads.add('image').attachFile(file);
                const res = {
                    type: 'image',
                    payload_token: payload.id,
                    format: meta.format,
                    width: meta.width,
                    height: meta.height,
                };
                if (onCapture) {
                    onCapture({ resource });
                }
            } catch (err) {
                if (onCaptureError) {
                    onCaptureError({ error: err });
                }
            }
        }
        const handleFailure = (message) => {
            if (onClose) {
                onClose({});
            }
        };

        async function startCapture() {
            const camera = navigator.camera;
            if (camera) {
                let direction;
                if (cameraDirection === 'front') {
                    direction = Camera.Direction.FRONT;
                } else if (cameraDirection === 'back') {
                    direction = Camera.Direction.BACK;
                }
                const options = {
                    quality: 50,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    encodingType: Camera.EncodingType.JPEG,
                    mediaType: Camera.MediaType.PICTURE,
                    cameraDirection: direction,
                    allowEdit: false,
                };
                camera.getPicture(handleSuccess, handleFailure, options);
            }
        }

        if (show) {
            startCapture();
        }
    }, [ show ]);

    return null;
}

export {
    PhotoCaptureDialogBoxCordova as default,
    PhotoCaptureDialogBoxCordova,
};
