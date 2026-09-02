import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput } from 'lucide-react';
import { Settings as SettingsType } from '../../Models/types';
import { sendMessageToBackend } from '../../Utils/MessageUtils';
import { useModal } from '../../Context/ModalContext';
import ConfirmationModal from '../ConfirmationModal';
import Button from '../Button';
import MigrationFlow from '../MigrationFlow';
import { useAppState } from '../../Context/AppStateContext';
import { useContentMigration } from '../../Context/ContentMigrationContext';
import StorageUsageMeter from './StorageUsageMeter';

const normalizePath = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '');

const TYPE_FOLDERS = ['Full Sessions', 'Replay Buffers', 'Clips', 'Highlights'];

const deriveSourceRoot = (filePath: string) => {
  const p = normalizePath(filePath);
  const lower = p.toLowerCase();
  for (const folder of TYPE_FOLDERS) {
    const idx = lower.lastIndexOf('/' + folder.toLowerCase() + '/');
    if (idx >= 0) return p.slice(0, idx);
  }
  const lastSlash = p.lastIndexOf('/');
  return lastSlash > 0 ? p.slice(0, lastSlash) : p;
};

interface StorageSettingsSectionProps {
  settings: SettingsType;
  updateSettings: (updates: Partial<SettingsType>) => void;
}

export default function StorageSettingsSection({
  settings,
  updateSettings,
}: StorageSettingsSectionProps) {
  const appState = useAppState();
  const { isMigrating } = useContentMigration();
  const [localStorageLimit, setLocalStorageLimit] = useState<string>(String(settings.storageLimit));
  const [localHighlightLimit, setLocalHighlightLimit] = useState<string>(
    settings.highlightStorageLimit != null ? String(settings.highlightStorageLimit) : '20',
  );
  const [localLowlightLimit, setLocalLowlightLimit] = useState<string>(
    settings.lowlightStorageLimit != null ? String(settings.lowlightStorageLimit) : '10',
  );
  const { openModal, closeModal } = useModal();
  const driveUsedGb = appState.recordingDriveUsedGb;
  const driveFreeGb = appState.recordingDriveFreeGb;

  useEffect(() => {
    setLocalStorageLimit(String(settings.storageLimit));
  }, [settings.storageLimit]);

  useEffect(() => {
    setLocalHighlightLimit(
      settings.highlightStorageLimit != null ? String(settings.highlightStorageLimit) : '20',
    );
  }, [settings.highlightStorageLimit]);

  useEffect(() => {
    setLocalLowlightLimit(
      settings.lowlightStorageLimit != null ? String(settings.lowlightStorageLimit) : '10',
    );
  }, [settings.lowlightStorageLimit]);

  useEffect(() => {
    sendMessageToBackend('RefreshStorageStats');
  }, []);

  const outsideContent = useMemo(() => {
    const root = normalizePath((settings.contentFolder || '').trim());
    if (!root) return [];
    const rootPrefix = root.toLowerCase() + '/';
    return appState.content.filter((c) => {
      const filePath = normalizePath(c.filePath || '');
      if (!filePath) return false;
      return !filePath.toLowerCase().startsWith(rootPrefix);
    });
  }, [appState.content, settings.contentFolder]);

  const outsideCount = outsideContent.length;
  const outsideSizeGb = useMemo(
    () => outsideContent.reduce((sum, c) => sum + (c.fileSizeKb || 0), 0) / (1024 * 1024),
    [outsideContent],
  );
  const fromPaths = useMemo(
    () =>
      Array.from(new Set(outsideContent.map((c) => deriveSourceRoot(c.filePath || '')))).filter(
        Boolean,
      ),
    [outsideContent],
  );

  const highlightUsageGb = useMemo(
    () =>
      appState.content
        .filter((c) => c.type === 'Highlight')
        .reduce((sum, c) => sum + (c.fileSizeKb || 0), 0) /
      (1024 * 1024),
    [appState.content],
  );

  const lowlightUsageGb = useMemo(
    () =>
      appState.content
        .filter((c) => c.type === 'Lowlight')
        .reduce((sum, c) => sum + (c.fileSizeKb || 0), 0) /
      (1024 * 1024),
    [appState.content],
  );

  const handleBrowseClick = () => {
    sendMessageToBackend('SetVideoLocation');
  };

  const handleMigrateClick = () => {
    openModal(
      <ConfirmationModal
        title="Move videos to recording path"
        description={
          <MigrationFlow
            fromPaths={fromPaths}
            toPath={settings.contentFolder}
            count={outsideCount}
            sizeGb={outsideSizeGb}
          />
        }
        confirmText="Move Videos"
        cancelText="Cancel"
        onConfirm={() => {
          sendMessageToBackend('MigrateContent');
          closeModal();
        }}
        onCancel={closeModal}
      />,
      { size: 'xl' },
    );
  };

  const handleCacheBrowseClick = () => {
    sendMessageToBackend('SetCacheLocation');
  };

  const handleStorageLimitBlur = () => {
    const currentFolderSizeGb = appState.currentFolderSizeGb;
    const numericLimit = Number(localStorageLimit) || 1;
    if (!localStorageLimit || isNaN(Number(localStorageLimit))) {
      setLocalStorageLimit('1');
    }
    if (numericLimit < currentFolderSizeGb) {
      openModal(
        <ConfirmationModal
          title="Storage Limit Warning"
          description={`The storage limit you entered (${numericLimit} GB) is lower than your current folder size (${currentFolderSizeGb.toFixed(2)} GB).\n\nThis will cause older recordings to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
          confirmText="Apply Limit"
          cancelText="Cancel"
          onConfirm={() => {
            updateSettings({ storageLimit: numericLimit });
            closeModal();
          }}
          onCancel={() => {
            setLocalStorageLimit(String(settings.storageLimit));
            closeModal();
          }}
        />,
      );
    } else {
      updateSettings({ storageLimit: numericLimit });
    }
  };

  const handleHighlightToggle = (enabled: boolean) => {
    if (enabled) {
      const numeric = Number(localHighlightLimit) || 20;
      const clamped = Math.max(1, Math.min(1000, numeric));
      setLocalHighlightLimit(String(clamped));
      if (clamped < highlightUsageGb) {
        openModal(
          <ConfirmationModal
            title="Highlight Storage Limit Warning"
            description={`The highlight limit you entered (${clamped} GB) is lower than your current highlights size (${highlightUsageGb.toFixed(2)} GB).\n\nThis will cause older highlights to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
            confirmText="Apply Limit"
            cancelText="Cancel"
            onConfirm={() => {
              updateSettings({ highlightStorageLimit: clamped });
              closeModal();
            }}
            onCancel={closeModal}
          />,
        );
      } else {
        updateSettings({ highlightStorageLimit: clamped });
      }
    } else {
      updateSettings({ highlightStorageLimit: null });
    }
  };

  const handleLowlightToggle = (enabled: boolean) => {
    if (enabled) {
      const numeric = Number(localLowlightLimit) || 10;
      const clamped = Math.max(1, Math.min(1000, numeric));
      setLocalLowlightLimit(String(clamped));
      if (clamped < lowlightUsageGb) {
        openModal(
          <ConfirmationModal
            title="Lowlight Storage Limit Warning"
            description={`The lowlight limit you entered (${clamped} GB) is lower than your current lowlights size (${lowlightUsageGb.toFixed(2)} GB).\n\nThis will cause older lowlights to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
            confirmText="Apply Limit"
            cancelText="Cancel"
            onConfirm={() => {
              updateSettings({ lowlightStorageLimit: clamped });
              closeModal();
            }}
            onCancel={closeModal}
          />,
        );
      } else {
        updateSettings({ lowlightStorageLimit: clamped });
      }
    } else {
      updateSettings({ lowlightStorageLimit: null });
    }
  };

  const handleHighlightLimitBlur = () => {
    if (settings.highlightStorageLimit == null) return;
    const numeric = Number(localHighlightLimit) || 20;
    const clamped = Math.max(1, Math.min(1000, numeric));
    if (!localHighlightLimit || isNaN(Number(localHighlightLimit))) {
      setLocalHighlightLimit(String(clamped));
    } else {
      setLocalHighlightLimit(String(clamped));
    }
    if (clamped < highlightUsageGb) {
      openModal(
        <ConfirmationModal
          title="Highlight Storage Limit Warning"
          description={`The highlight limit you entered (${clamped} GB) is lower than your current highlights size (${highlightUsageGb.toFixed(2)} GB).\n\nThis will cause older highlights to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
          confirmText="Apply Limit"
          cancelText="Cancel"
          onConfirm={() => {
            updateSettings({ highlightStorageLimit: clamped });
            closeModal();
          }}
          onCancel={() => {
            setLocalHighlightLimit(
              settings.highlightStorageLimit != null
                ? String(settings.highlightStorageLimit)
                : '20',
            );
            closeModal();
          }}
        />,
      );
    } else if (clamped !== settings.highlightStorageLimit) {
      updateSettings({ highlightStorageLimit: clamped });
    }
  };

  const handleLowlightLimitBlur = () => {
    if (settings.lowlightStorageLimit == null) return;
    const numeric = Number(localLowlightLimit) || 10;
    const clamped = Math.max(1, Math.min(1000, numeric));
    if (!localLowlightLimit || isNaN(Number(localLowlightLimit))) {
      setLocalLowlightLimit(String(clamped));
    } else {
      setLocalLowlightLimit(String(clamped));
    }
    if (clamped < lowlightUsageGb) {
      openModal(
        <ConfirmationModal
          title="Lowlight Storage Limit Warning"
          description={`The lowlight limit you entered (${clamped} GB) is lower than your current lowlights size (${lowlightUsageGb.toFixed(2)} GB).\n\nThis will cause older lowlights to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
          confirmText="Apply Limit"
          cancelText="Cancel"
          onConfirm={() => {
            updateSettings({ lowlightStorageLimit: clamped });
            closeModal();
          }}
          onCancel={() => {
            setLocalLowlightLimit(
              settings.lowlightStorageLimit != null ? String(settings.lowlightStorageLimit) : '10',
            );
            closeModal();
          }}
        />,
      );
    } else if (clamped !== settings.lowlightStorageLimit) {
      updateSettings({ lowlightStorageLimit: clamped });
    }
  };

  const highlightEnabled = settings.highlightStorageLimit != null;
  const lowlightEnabled = settings.lowlightStorageLimit != null;

  return (
    <div className="p-4 bg-base-300 rounded-lg shadow-md border border-custom">
      <div className="grid grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text text-base-content">Recording Path</span>
          </label>
          <div className="flex space-x-2">
            <div className="join w-full">
              <input
                type="text"
                name="contentFolder"
                value={settings.contentFolder}
                onChange={(e) => updateSettings({ contentFolder: e.target.value })}
                placeholder="Enter or select folder path"
                className="input input-bordered flex-1 bg-base-200 join-item"
              />
              <button
                onClick={handleBrowseClick}
                className="btn btn-secondary bg-base-200 hover:bg-base-300 border-base-400 hover:border-base-400 font-semibold join-item"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label pb-1">
            <span className="label-text text-base-content">Cache Path</span>
          </label>
          <div className="flex space-x-2">
            <div className="join w-full">
              <input
                type="text"
                name="cacheFolder"
                value={settings.cacheFolder}
                onChange={(e) => updateSettings({ cacheFolder: e.target.value })}
                placeholder="Enter or select folder for metadata"
                className="input input-bordered flex-1 bg-base-200 join-item"
              />
              <button
                onClick={handleCacheBrowseClick}
                className="btn btn-secondary bg-base-200 hover:bg-base-300 border-base-400 hover:border-base-400 font-semibold join-item"
              >
                Browse
              </button>
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label block px-0 pb-1">
            <span className="label-text text-base-content">Storage Limit (GB)</span>
          </label>
          <input
            type="number"
            name="storageLimit"
            value={localStorageLimit}
            onChange={(e) => setLocalStorageLimit(e.target.value)}
            onBlur={handleStorageLimitBlur}
            placeholder="Set maximum storage in GB"
            min="1"
            className="input input-bordered bg-base-200 w-full block outline-none focus:border-base-400"
          />
          <span className="text-xs text-base-content/60 mt-1">
            Sessions and Replay Buffers auto-delete when exceeded.
          </span>
        </div>

        <div className="form-control">
          <label className="label pb-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={highlightEnabled}
              onChange={(e) => handleHighlightToggle(e.target.checked)}
            />
            <span className="label-text text-base-content">Highlight Storage Limit (GB)</span>
            {!highlightEnabled && <span className="text-xs text-base-content/50">— Unlimited</span>}
          </label>
          <input
            type="number"
            name="highlightStorageLimit"
            value={localHighlightLimit}
            onChange={(e) => setLocalHighlightLimit(e.target.value)}
            onBlur={handleHighlightLimitBlur}
            placeholder="Unlimited"
            min="1"
            max="1000"
            className={`input input-bordered bg-base-200 w-full block outline-none focus:border-base-400 ${!highlightEnabled ? 'opacity-60' : ''}`}
          />
          <span className="text-xs text-base-content/60 mt-1">
            {highlightEnabled
              ? `Oldest highlights auto-delete when highlights exceed limit. Currently ${highlightUsageGb.toFixed(2)} GB.`
              : 'Highlights are never auto-deleted. Edit the value then enable to set a cap.'}
          </span>
        </div>

        <div className="form-control col-span-2 sm:col-span-1">
          <label className="label pb-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={lowlightEnabled}
              onChange={(e) => handleLowlightToggle(e.target.checked)}
            />
            <span className="label-text text-base-content">Lowlight Storage Limit (GB)</span>
            {!lowlightEnabled && <span className="text-xs text-base-content/50">— Unlimited</span>}
          </label>
          <input
            type="number"
            name="lowlightStorageLimit"
            value={localLowlightLimit}
            onChange={(e) => setLocalLowlightLimit(e.target.value)}
            onBlur={handleLowlightLimitBlur}
            placeholder="Unlimited"
            min="1"
            max="1000"
            className={`input input-bordered bg-base-200 w-full block outline-none focus:border-base-400 ${!lowlightEnabled ? 'opacity-60' : ''}`}
          />
          <span className="text-xs text-base-content/60 mt-1">
            {lowlightEnabled
              ? `Oldest lowlights auto-delete when lowlights exceed limit. Currently ${lowlightUsageGb.toFixed(2)} GB.`
              : 'Lowlights are never auto-deleted. Edit the value then enable to set a cap.'}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <StorageUsageMeter
          content={appState.content}
          contentFolder={settings.contentFolder}
          storageLimitGb={settings.storageLimit}
          usedGb={appState.currentFolderSizeGb}
          driveUsedGb={driveUsedGb}
          driveFreeGb={driveFreeGb}
        />
      </div>

      <AnimatePresence>
        {outsideCount > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{
              opacity: 1,
              height: 'fit-content',
              transition: {
                duration: 0.3,
                height: { type: 'spring', stiffness: 300, damping: 30 },
              },
            }}
            exit={{
              opacity: 0,
              height: 0,
              transition: {
                duration: 0.2,
              },
            }}
            style={{ overflow: 'hidden' }}
          >
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-base-400 bg-base-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base-content font-medium">
                  {outsideCount} video{outsideCount === 1 ? '' : 's'} ({outsideSizeGb.toFixed(2)}{' '}
                  GB) stored outside your recording path
                </p>
                <p className="text-sm text-base-content text-opacity-60">
                  Move them into your recording path to keep all your content in one place.
                </p>
              </div>
              <Button
                variant="primary"
                className="gap-2 shrink-0"
                onClick={handleMigrateClick}
                loading={isMigrating}
              >
                {!isMigrating && <FolderInput size={16} className="shrink-0" />}
                <span className="inline-block">
                  {isMigrating ? 'Moving...' : 'Move to Recording Path'}
                </span>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
