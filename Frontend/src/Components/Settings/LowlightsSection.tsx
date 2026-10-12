import { useState } from 'react';
import { Settings as SettingsType } from '../../Models/types';

interface LowlightsSectionProps {
  settings: SettingsType;
  updateSettings: (updates: Partial<SettingsType>) => void;
}

export default function LowlightsSection({ settings, updateSettings }: LowlightsSectionProps) {
  const [localPaddingBefore, setLocalPaddingBefore] = useState<string>(
    String(settings.lowlightPaddingBefore),
  );
  const [localPaddingAfter, setLocalPaddingAfter] = useState<string>(
    String(settings.lowlightPaddingAfter),
  );

  const commitPadding = (
    local: string,
    setLocal: (value: string) => void,
    key: 'lowlightPaddingBefore' | 'lowlightPaddingAfter',
  ) => {
    const parsed = Number(local);
    const value = Number.isFinite(parsed) ? Math.min(60, Math.max(1, parsed)) : settings[key];
    setLocal(String(value));
    updateSettings({ [key]: value });
  };

  return (
    <div className="p-4 bg-base-300 rounded-lg shadow-md border border-base-400">
      <h2 className="text-xl font-semibold mb-4">Lowlights</h2>
      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer p-3 bg-base-200 rounded-lg border border-base-400">
          <input
            type="checkbox"
            name="enableLowlights"
            checked={settings.enableLowlights}
            onChange={(e) => updateSettings({ enableLowlights: e.target.checked })}
            className="checkbox checkbox-primary checkbox-sm"
          />
          <div>
            <div className="font-semibold">Enable Lowlights</div>
            <div className="text-sm opacity-70 mt-0.5">
              Adds Create Lowlight to full sessions, which joins your deaths into one video.
            </div>
          </div>
        </label>
        <label
          className={`flex items-center gap-3 p-3 bg-base-200 rounded-lg border border-base-400 ${settings.enableLowlights ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
        >
          <input
            type="checkbox"
            name="autoGenerateLowlights"
            checked={settings.autoGenerateLowlights}
            onChange={(e) => updateSettings({ autoGenerateLowlights: e.target.checked })}
            className="checkbox checkbox-primary checkbox-sm"
            disabled={!settings.enableLowlights}
          />
          <div>
            <div className="font-semibold">Auto-Generate Lowlights After Recording</div>
            <div className="text-sm opacity-70 mt-0.5">
              Creates the lowlight automatically when a recording with deaths ends.
            </div>
          </div>
        </label>

        <div>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control w-full">
              <label
                htmlFor="lowlightPaddingBefore"
                className="label text-base-content px-0 !block"
              >
                <span className="label-text">Before Lowlight</span>
              </label>
              <div className="relative w-full">
                <input
                  id="lowlightPaddingBefore"
                  type="number"
                  name="lowlightPaddingBefore"
                  value={localPaddingBefore}
                  onChange={(e) => setLocalPaddingBefore(e.target.value)}
                  onBlur={() =>
                    commitPadding(
                      localPaddingBefore,
                      setLocalPaddingBefore,
                      'lowlightPaddingBefore',
                    )
                  }
                  min={1}
                  max={60}
                  step={0.5}
                  className="input input-bordered bg-base-200 w-full pr-12 outline-none focus:border-base-400"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-sm opacity-60 pointer-events-none">
                  sec
                </span>
              </div>
            </div>

            <div className="form-control w-full">
              <label htmlFor="lowlightPaddingAfter" className="label text-base-content px-0 !block">
                <span className="label-text">After Lowlight</span>
              </label>
              <div className="relative w-full">
                <input
                  id="lowlightPaddingAfter"
                  type="number"
                  name="lowlightPaddingAfter"
                  value={localPaddingAfter}
                  onChange={(e) => setLocalPaddingAfter(e.target.value)}
                  onBlur={() =>
                    commitPadding(localPaddingAfter, setLocalPaddingAfter, 'lowlightPaddingAfter')
                  }
                  min={1}
                  max={60}
                  step={0.5}
                  className="input input-bordered bg-base-200 w-full pr-12 outline-none focus:border-base-400"
                />
                <span className="absolute inset-y-0 right-3 flex items-center text-sm opacity-60 pointer-events-none">
                  sec
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
