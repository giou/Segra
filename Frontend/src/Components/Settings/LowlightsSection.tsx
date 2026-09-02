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

  return (
    <div className="p-4 bg-base-300 rounded-lg shadow-md border border-custom">
      <h2 className="text-xl font-semibold mb-4">Lowlights</h2>
      <div className="space-y-3">
        <div className="flex items-center">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="enableLowlights"
              checked={settings.enableLowlights}
              onChange={(e) => updateSettings({ enableLowlights: e.target.checked })}
              className="checkbox checkbox-primary checkbox-sm"
            />
            <span className="flex items-center gap-1 cursor-pointer">Enable Lowlights</span>
          </label>
        </div>
        <div className="flex items-center">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="autoGenerateLowlights"
              checked={settings.autoGenerateLowlights}
              onChange={(e) => updateSettings({ autoGenerateLowlights: e.target.checked })}
              className="checkbox checkbox-primary checkbox-sm"
              disabled={!settings.enableLowlights}
            />
            <span className="flex items-center gap-1 cursor-pointer">
              Auto-Generate Lowlights After Recording
            </span>
          </label>
        </div>

        <div className="pt-3 border-t border-custom">
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control w-full">
              <label
                htmlFor="lowlightPaddingBefore"
                className="label text-base-content px-0 !block mb-1"
              >
                <span className="label-text">Before Lowlight</span>
              </label>
              <div className="join w-full">
                <input
                  id="lowlightPaddingBefore"
                  type="number"
                  name="lowlightPaddingBefore"
                  value={localPaddingBefore}
                  onChange={(e) => setLocalPaddingBefore(e.target.value)}
                  onBlur={() => {
                    const parsed = Number(localPaddingBefore);
                    const value = Number.isFinite(parsed)
                      ? Math.min(60, Math.max(1, parsed))
                      : settings.lowlightPaddingBefore;
                    setLocalPaddingBefore(String(value));
                    updateSettings({ lowlightPaddingBefore: value });
                  }}
                  min={1}
                  max={60}
                  step={0.5}
                  className="input input-bordered bg-base-200 join-item flex-1 w-full outline-none focus:border-base-400"
                />
                <span className="join-item flex items-center px-3 bg-base-200 border border-base-400 text-sm opacity-70">
                  seconds
                </span>
              </div>
            </div>

            <div className="form-control w-full">
              <label
                htmlFor="lowlightPaddingAfter"
                className="label text-base-content px-0 !block mb-1"
              >
                <span className="label-text">After Lowlight</span>
              </label>
              <div className="join w-full">
                <input
                  id="lowlightPaddingAfter"
                  type="number"
                  name="lowlightPaddingAfter"
                  value={localPaddingAfter}
                  onChange={(e) => setLocalPaddingAfter(e.target.value)}
                  onBlur={() => {
                    const parsed = Number(localPaddingAfter);
                    const value = Number.isFinite(parsed)
                      ? Math.min(60, Math.max(1, parsed))
                      : settings.lowlightPaddingAfter;
                    setLocalPaddingAfter(String(value));
                    updateSettings({ lowlightPaddingAfter: value });
                  }}
                  min={1}
                  max={60}
                  step={0.5}
                  className="input input-bordered bg-base-200 join-item flex-1 w-full outline-none focus:border-base-400"
                />
                <span className="join-item flex items-center px-3 bg-base-200 border border-base-400 text-sm opacity-70">
                  seconds
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
