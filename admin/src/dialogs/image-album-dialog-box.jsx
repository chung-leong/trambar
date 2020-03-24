import React, { useState } from 'react';
import { useProgress, useListener, useErrorCatcher } from 'relaks';
import { memoizeWeak } from 'common/utils/memoize.js';
import { findPictures } from 'common/objects/finders/picture-finder.js';
import { uploadPictures, removePictures } from 'common/objects/savers/picture-saver.js';
import { toggle, orderBy } from 'common/utils/array-utils.js';

// widgets
import { Overlay } from 'common/widgets/overlay.jsx';
import { PushButton } from '../widgets/push-button.jsx';
import { ResourceView } from 'common/widgets/resource-view.jsx';

import './image-album-dialog-box.scss';

export const ImageAlbumDialogBox = Overlay.create(async (props) => {
  const { database, env, payloads, image, purpose } = props;
  const { onSelect, onCancel } = props;
  const { t } = env.locale;
  const [ show ] = useProgress();
  const [ managingImages, setManagingImages ] = useState(false);
  const [ selectedPictureID, setSelectedPictureID ] = useState(0);
  const [ deletionCandidateIDs, setDeletionCandidateIDs ] = useState([]);
  const [ isDropTarget, setIsDropTarget ] = useState(false);
  const [ error, run ] = useErrorCatcher();

  const handleManageClick = useListener((evt) => {
    setManagingImages(true);
  });
  const handleDoneClick = useListener((evt) => {
    setManagingImages(false);
    setDeletionCandidateIDs([]);
  });
  const handleCancelClick = useListener((evt) => {
    if (onCancel) {
      onCancel({});
    }
  });
  const handleSelectClick = useListener((evt) => {
    const selectedPicture = pictures.find(p => p.id === selectedPictureID);
    if (onSelect && selectedPicture) {
      onSelect({ image: selectedPicture.details });
    }
  });
  const handleUploadChange = useListener((evt) => {
    // make copy of array since it'll disappear when event handler exits
    run(async () => {
      await uploadPictures(database, payloads, evt.target.files);
    });
  });
  const handleDragEnter = useListener((evt) => {
    setIsDropTarget(true);
  });
  const handleDragLeave = useListener((evt) => {
    setIsDropTarget(false);
  });
  const handleDragOver = useListener((evt) => {
    // allow drop
    evt.preventDefault();
  });
  const handleDrop = useListener((evt) => {
    run(async () => {
      evt.preventDefault();
      await uploadPictures(database, payloads, evt.dataTransfer.files);
    });
    setIsDropTarget(false);
  });
  const handleRemoveClick = useListener((evt) => {
    run(async () => {
      const removal = pictures.filter((picture) => {
        return deletionCandidateIDs.includes(picture.id);
      });
      await removePictures(database, removal);
      setDeletionCandidateIDs([]);
    });
  });
  const handleImageClick = useListener((evt) => {
    let pictureID = parseInt(evt.currentTarget.getAttribute('data-picture-id'));
    if (managingImages) {
      const newList = toggle(deletionCandidateIDs, pictureID);
      setDeletionCandidateIDs(newList);
    } else {
      const picture = pictures.find(p => p.id === pictureID);
      if (!picture || image?.url === picture.details.url) {
        setSelectedPictureID(0);
      } else {
        setSelectedPictureID(pictureID);
      }
    }
  });

  render();
  const pictures = await findPictures(database, purpose);
  render();

  function render() {
    show(
      <div className="image-album-dialog-box" onDragEnter={handleDragEnter}>
        {renderPictures()}
        {renderButtons()}
        {renderDropIndicator()}
      </div>
    );
  }

  function renderPictures() {
    const storedPictures = sortPictures(pictures);
    return (
      <div className="scrollable">
        {storedPictures?.map(renderPicture)}
      </div>
    );
  }

  function renderPicture(picture, i) {
    const classNames = [ 'picture' ];
    if (managingImages) {
      if (deletionCandidateIDs.includes(picture.id)) {
        classNames.push('deleting');
      }
    } else {
      if (selectedPictureID) {
        if (selectedPictureID === picture.id) {
          classNames.push('selected');
        }
      } else if (image) {
        if (image.url === picture.details.url) {
          classNames.push('selected');
        }
      }
    }
    const props = {
      className: classNames.join(' '),
      onClick: handleImageClick,
      'data-picture-id': picture.id,
    };
    return (
      <div key={picture.id} { ...props}>
        <ResourceView resource={picture.details} height={120} env={env} />
      </div>
    );
  }

  function renderButtons() {
    if (managingImages) {
      const inputProps = {
        type: 'file',
        value: '',
        accept: 'image/*',
        multiple: true,
        onChange: handleUploadChange,
      };
      const removeProps = {
        className: 'remove',
        disabled: (deletionCandidateIDs.length === 0),
        onClick: handleRemoveClick,
      };
      const doneProps = {
        className: 'done',
        onClick: handleDoneClick,
      };
      return (
        <div key="manage" className="buttons">
          <div className="left">
            <PushButton {...removeProps}>{t('image-album-remove')}</PushButton>
            {' '}
            <label className="push-button">
              {t('image-album-upload')}
              <input {...inputProps} />
            </label>
          </div>
          <div className="right">
            <PushButton {...doneProps}>{t('image-album-done')}</PushButton>
          </div>
        </div>
      );
    } else {
      const manageProps = {
        className: 'manage',
        onClick: handleManageClick,
      };
      const cancelProps = {
        className: 'cancel',
        onClick: handleCancelClick,
      };
      const selectProps = {
        className: 'select',
        disabled: !selectedPictureID,
        onClick: handleSelectClick,
      };
      return (
        <div key="select" className="buttons">
          <div className="left">
            <PushButton {...manageProps}>{t('image-album-manage')}</PushButton>
          </div>
          <div className="right">
            <PushButton {...cancelProps}>{t('image-album-cancel')}</PushButton>
            {' '}
            <PushButton {...selectProps}>{t('image-album-select')}</PushButton>
          </div>
        </div>
      );
    }
  }

  function renderDropIndicator() {
    if (!isDropTarget) {
      return null;
    }
    let props = {
      className: 'drop-target',
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    };
    return <div {...props} />;
  }
});

const sortPictures = memoizeWeak(null, (pictures) => {
  return orderBy(pictures, 'mtime', 'desc');
});
