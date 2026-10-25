import { useState, useEffect, useMemo, KeyboardEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderInput } from 'lucide-react';
import { Settings as SettingsType } from '../../Models/types';
import { sendMessageToBackend } from '../../Utils/MessageUtils';
import { clampInt } from '../../Utils/NumberUtils';
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
  const [localClipLimit, setLocalClipLimit] = useState<string>(
    settings.clipStorageLimit != null ? String(settings.clipStorageLimit) : '10',
  );
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
    setLocalClipLimit(settings.clipStorageLimit != null ? String(settings.clipStorageLimit) : '10');
  }, [settings.clipStorageLimit]);

  const [localContentFolder, setLocalContentFolder] = useState(settings.contentFolder);
  const [localCacheFolder, setLocalCacheFolder] = useState(settings.cacheFolder);

  useEffect(() => {
    setLocalContentFolder(settings.contentFolder);
  }, [settings.contentFolder]);

  useEffect(() => {
    setLocalCacheFolder(settings.cacheFolder);
  }, [settings.cacheFolder]);

  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

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

  const clipUsageGb = useMemo(
    () =>
      appState.content
        .filter((c) => c.type === 'Clip')
        .reduce((sum, c) => sum + (c.fileSizeKb || 0), 0) /
      (1024 * 1024),
    [appState.content],
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

  // A limit below the current folder size makes the next cleanup delete older recordings
  const confirmLimit = (limitGb: number, onConfirm: () => void, onCancel?: () => void) => {
    const currentFolderSizeGb = appState.currentFolderSizeGb;
    if (limitGb >= currentFolderSizeGb) {
      onConfirm();
      return;
    }

    openModal(
      <ConfirmationModal
        title="Storage Limit Warning"
        description={`The storage limit (${limitGb} GB) is lower than your current folder size (${currentFolderSizeGb.toFixed(2)} GB).\n\nThis will cause older recordings to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
        confirmText="Apply Limit"
        cancelText="Cancel"
        onConfirm={() => {
          onConfirm();
          closeModal();
        }}
        onCancel={() => {
          onCancel?.();
          closeModal();
        }}
      />,
    );
  };

  const handleStorageLimitBlur = () => {
    const numericLimit = clampInt(localStorageLimit, 1, 2147483647, 1);
    setLocalStorageLimit(String(numericLimit));
    if (numericLimit === settings.storageLimit) return;

    confirmLimit(
      numericLimit,
      () => updateSettings({ storageLimit: numericLimit }),
      // Reset to the previous value
      () => setLocalStorageLimit(String(settings.storageLimit)),
    );
  };

  const handleUnlimitedChange = (unlimited: boolean) => {
    if (unlimited) {
      updateSettings({ unlimitedStorage: true });
    } else {
      confirmLimit(settings.storageLimit, () => updateSettings({ unlimitedStorage: false }));
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

  const handleClipToggle = (enabled: boolean) => {
    if (enabled) {
      const numeric = Number(localClipLimit) || 10;
      const clamped = Math.max(1, Math.min(1000, numeric));
      setLocalClipLimit(String(clamped));
      if (clamped < clipUsageGb) {
        openModal(
          <ConfirmationModal
            title="Clip Storage Limit Warning"
            description={`The clip limit you entered (${clamped} GB) is lower than your current clips size (${clipUsageGb.toFixed(2)} GB).\n\nThis will cause older clips to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
            confirmText="Apply Limit"
            cancelText="Cancel"
            onConfirm={() => {
              updateSettings({ clipStorageLimit: clamped });
              closeModal();
            }}
            onCancel={closeModal}
          />,
        );
      } else {
        updateSettings({ clipStorageLimit: clamped });
      }
    } else {
      updateSettings({ clipStorageLimit: null });
    }
  };

  const handleClipLimitBlur = () => {
    if (settings.clipStorageLimit == null) return;
    const numeric = Number(localClipLimit) || 10;
    const clamped = Math.max(1, Math.min(1000, numeric));
    setLocalClipLimit(String(clamped));
    if (clamped < clipUsageGb) {
      openModal(
        <ConfirmationModal
          title="Clip Storage Limit Warning"
          description={`The clip limit you entered (${clamped} GB) is lower than your current clips size (${clipUsageGb.toFixed(2)} GB).\n\nThis will cause older clips to be automatically deleted to free up space.\n\nAre you sure you want to continue?`}
          confirmText="Apply Limit"
          cancelText="Cancel"
          onConfirm={() => {
            updateSettings({ clipStorageLimit: clamped });
            closeModal();
          }}
          onCancel={() => {
            setLocalClipLimit(
              settings.clipStorageLimit != null ? String(settings.clipStorageLimit) : '10',
            );
            closeModal();
          }}
        />,
      );
    } else if (clamped !== settings.clipStorageLimit) {
      updateSettings({ clipStorageLimit: clamped });
    }
  };

  const clipEnabled = settings.clipStorageLimit != null;
  const highlightEnabled = settings.highlightStorageLimit != null;
  const lowlightEnabled = settings.lowlightStorageLimit != null;

  return (
    <div className="p-4 bg-base-300 rounded-lg shadow-md border border-base-400">
      <h2 className="text-xl font-semibold mb-4">Storage Settings</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text text-base-content">Recording Path</span>
          </label>
          <div className="flex space-x-2">
            <div className="join w-full">
              <input
                type="text"
                name="contentFolder"
                value={localContentFolder}
                onChange={(e) => setLocalContentFolder(e.target.value)}
                onBlur={() => {
                  if (localContentFolder !== settings.contentFolder) {
                    updateSettings({ contentFolder: localContentFolder });
                  }
                }}
                onKeyDown={blurOnEnter}
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
          <label className="label">
            <span className="label-text text-base-content">Cache Path</span>
          </label>
          <div className="flex space-x-2">
            <div className="join w-full">
              <input
                type="text"
                name="cacheFolder"
                value={localCacheFolder}
                onChange={(e) => setLocalCacheFolder(e.target.value)}
                onBlur={() => {
                  if (localCacheFolder !== settings.cacheFolder) {
                    updateSettings({ cacheFolder: localCacheFolder });
                  }
                }}
                onKeyDown={blurOnEnter}
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
          <label className="label block px-0">
            <span className="label-text text-base-content">Storage Limit</span>
          </label>

          <div className="join w-full">
            <div className="relative flex-1">
              <input
                type="number"
                name="storageLimit"
                value={settings.unlimitedStorage ? '' : localStorageLimit}
                onChange={(e) => setLocalStorageLimit(e.target.value)}
                onBlur={handleStorageLimitBlur}
                disabled={settings.unlimitedStorage}
                placeholder={settings.unlimitedStorage ? 'No limit' : 'Set maximum storage in GB'}
                min="1"
                className="input input-bordered join-item bg-base-200 w-full block pr-12 outline-none focus:border-base-400 disabled:bg-base-200 disabled:border-base-400 disabled:placeholder:opacity-100 disabled:placeholder:text-base-content/50"
              />
              {!settings.unlimitedStorage && (
                <span className="absolute inset-y-0 right-3 flex items-center text-sm opacity-60 pointer-events-none">
                  GB
                </span>
              )}
            </div>
            {/* Positioned like the input, so its left border paints over the input's edge */}
            <label className="btn btn-secondary bg-base-200 hover:bg-base-300 border-base-400 hover:border-base-400 font-semibold join-item gap-2 relative">
              <input
                type="checkbox"
                name="unlimitedStorage"
                checked={settings.unlimitedStorage}
                onChange={(e) => handleUnlimitedChange(e.target.checked)}
                className="checkbox checkbox-primary checkbox-sm"
              />
              Unlimited
            </label>
          </div>
          <div className="mt-1 px-1 text-xs opacity-70 leading-snug">
            {settings.unlimitedStorage
              ? 'Sessions and replay buffers are never auto-deleted. Recording stops when the drive is almost full. Per-type limits below still apply.'
              : 'Older sessions and replay buffers are deleted to stay under the limit. Per-type limits below apply separately.'}
          </div>
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
              ? `Highlights auto-delete when exceeded. Currently ${highlightUsageGb.toFixed(2)} GB.`
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
              ? `Lowlights auto-delete when exceeded. Currently ${lowlightUsageGb.toFixed(2)} GB.`
              : 'Lowlights are never auto-deleted. Edit the value then enable to set a cap.'}
          </span>
        </div>

        <div className="form-control col-span-2 sm:col-span-1">
          <label className="label pb-1 flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm checkbox-primary"
              checked={clipEnabled}
              onChange={(e) => handleClipToggle(e.target.checked)}
            />
            <span className="label-text text-base-content">Clip Storage Limit (GB)</span>
            {!clipEnabled && <span className="text-xs text-base-content/50">— Unlimited</span>}
          </label>
          <input
            type="number"
            name="clipStorageLimit"
            value={localClipLimit}
            onChange={(e) => setLocalClipLimit(e.target.value)}
            onBlur={handleClipLimitBlur}
            placeholder="Unlimited"
            min="1"
            max="1000"
            className={`input input-bordered bg-base-200 w-full block outline-none focus:border-base-400 ${!clipEnabled ? 'opacity-60' : ''}`}
          />
          <span className="text-xs text-base-content/60 mt-1">
            {clipEnabled
              ? `Clips auto-delete when exceeded. Currently ${clipUsageGb.toFixed(2)} GB.`
              : 'Clips are never auto-deleted. Edit the value then enable to set a cap.'}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <StorageUsageMeter
          content={appState.content}
          contentFolder={settings.contentFolder}
          storageLimitGb={settings.storageLimit}
          unlimited={settings.unlimitedStorage}
          usedGb={appState.currentFolderSizeGb}
          driveUsedGb={driveUsedGb}
          driveFreeGb={driveFreeGb}
        />
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-base-200 rounded-lg border border-base-400">
          <input
            type="checkbox"
            name="removeOriginalAfterCompression"
            checked={settings.removeOriginalAfterCompression}
            onChange={(e) => updateSettings({ removeOriginalAfterCompression: e.target.checked })}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <div>
            <div className="font-semibold">Delete Original After Compression</div>
            <div className="text-sm opacity-70 mt-0.5">
              Removes the full-size video once its compressed copy is saved.
            </div>
          </div>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-base-200 rounded-lg border border-base-400">
          <input
            type="checkbox"
            name="discardSessionsWithoutBookmarks"
            checked={settings.discardSessionsWithoutBookmarks}
            onChange={(e) => updateSettings({ discardSessionsWithoutBookmarks: e.target.checked })}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <div>
            <div className="font-semibold">Discard Sessions Without Bookmarks</div>
            <div className="text-sm opacity-70 mt-0.5">
              Deletes a session recording when it ends unless you added a bookmark with the hotkey.
              Kills and other automatic bookmarks don&apos;t count.
            </div>
          </div>
        </label>
      </div>

      {/* Migrate content stored outside the recording path */}
      <AnimatePresence initial={false}>
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
            <div className="mt-4 flex flex-col gap-3 rounded-lg border border-base-400 bg-base-200 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-base-content font-medium">
                  {outsideCount} video{outsideCount === 1 ? '' : 's'} ({outsideSizeGb.toFixed(2)}{' '}
                  GB) stored outside your recording path
                </p>
                <p className="text-sm opacity-70">
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
