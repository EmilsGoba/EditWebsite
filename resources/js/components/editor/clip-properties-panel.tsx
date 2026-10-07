import { RotateCcw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { maxClipScale } from '@/lib/editor-timeline';
import type { TimelineClip } from '@/lib/editor-timeline';

type ClipTransformProperty = 'scale' | 'positionX' | 'positionY' | 'rotation';

type ClipPropertiesPanelProps = {
    onResetResizeControls: () => void;
    onResetTextControls: () => void;
    onUpdateSelectedClipProperty: (
        property: ClipTransformProperty,
        value: number,
    ) => void;
    onUpdateSelectedTextClipName: (name: string) => void;
    onUpdateSelectedTextClipProperty: (
        property: ClipTransformProperty,
        value: number,
    ) => void;
    selectedClipPositionX: number;
    selectedClipPositionY: number;
    selectedClipRotation: number;
    selectedClipScale: number;
    selectedTextClip: TimelineClip | null;
    selectedVisualClip: TimelineClip | null;
};

type TransformControlProps = {
    disabled?: boolean;
    label: string;
    max: number;
    min: number;
    onChange: (value: number) => void;
    onReset: () => void;
    resetTitle: string;
    unit: string;
    value: number;
};

function TransformControl({
    disabled = false,
    label,
    max,
    min,
    onChange,
    onReset,
    resetTitle,
    unit,
    value,
}: TransformControlProps) {
    return (
        <label className="block text-xs text-zinc-400">
            <span className="flex items-center justify-between gap-3">
                {label}
                <span className="flex items-center gap-1">
                    <input
                        className="h-8 w-20 rounded border border-zinc-700 bg-zinc-950 px-2 font-mono text-xs text-zinc-100 outline-none focus:border-cyan-500 disabled:opacity-50"
                        disabled={disabled}
                        max={max}
                        min={min}
                        onChange={(event) =>
                            onChange(Number(event.target.value))
                        }
                        type="number"
                        value={value}
                    />
                    <span className="text-zinc-500">{unit}</span>
                    <button
                        className="ml-1 flex size-8 items-center justify-center rounded border border-zinc-700 bg-zinc-950 text-zinc-400 transition hover:border-cyan-500 hover:text-white disabled:opacity-50"
                        disabled={disabled}
                        onClick={onReset}
                        title={resetTitle}
                        type="button"
                    >
                        <RotateCcw className="size-3.5" />
                    </button>
                </span>
            </span>
            <input
                className="mt-2 w-full accent-cyan-500 disabled:opacity-50"
                disabled={disabled}
                max={max}
                min={min}
                onChange={(event) => onChange(Number(event.target.value))}
                type="range"
                value={value}
            />
        </label>
    );
}

export function ClipPropertiesPanel({
    onResetResizeControls,
    onResetTextControls,
    onUpdateSelectedClipProperty,
    onUpdateSelectedTextClipName,
    onUpdateSelectedTextClipProperty,
    selectedClipPositionX,
    selectedClipPositionY,
    selectedClipRotation,
    selectedClipScale,
    selectedTextClip,
    selectedVisualClip,
}: ClipPropertiesPanelProps) {
    return (
        <aside className="border-b border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">
                        {selectedTextClip ? 'Text' : 'Resize'}
                    </h2>
                    <p className="mt-1 text-xs text-zinc-500">
                        {selectedTextClip
                            ? 'Text clip settings'
                            : selectedVisualClip
                              ? selectedVisualClip.name
                              : 'Select a video, image, or text clip'}
                    </p>
                </div>
                {selectedTextClip ? (
                    <Button
                        className="h-8 gap-2 border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                        onClick={onResetTextControls}
                        type="button"
                        variant="outline"
                    >
                        <RotateCcw className="size-3.5" />
                        Reset
                    </Button>
                ) : (
                    <Button
                        className="h-8 gap-2 border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
                        disabled={!selectedVisualClip}
                        onClick={onResetResizeControls}
                        type="button"
                        variant="outline"
                    >
                        <RotateCcw className="size-3.5" />
                        Reset
                    </Button>
                )}
            </div>

            {selectedTextClip ? (
                <div className="mt-4 space-y-4">
                    <label className="block text-xs text-zinc-400">
                        Text content
                        <textarea
                            className="mt-2 min-h-28 w-full resize-none rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 transition outline-none focus:border-cyan-500"
                            onChange={(event) =>
                                onUpdateSelectedTextClipName(event.target.value)
                            }
                            placeholder="Write your text..."
                            value={selectedTextClip.name}
                        />
                    </label>

                    <TransformControl
                        label="Size"
                        max={maxClipScale}
                        min={40}
                        onChange={(value) =>
                            onUpdateSelectedTextClipProperty('scale', value)
                        }
                        onReset={() =>
                            onUpdateSelectedTextClipProperty('scale', 100)
                        }
                        resetTitle="Reset size"
                        unit="%"
                        value={selectedTextClip.scale}
                    />
                    <TransformControl
                        label="Position X"
                        max={1000}
                        min={-1000}
                        onChange={(value) =>
                            onUpdateSelectedTextClipProperty('positionX', value)
                        }
                        onReset={() =>
                            onUpdateSelectedTextClipProperty('positionX', 0)
                        }
                        resetTitle="Reset position X"
                        unit="px"
                        value={selectedTextClip.positionX}
                    />
                    <TransformControl
                        label="Position Y"
                        max={1000}
                        min={-1000}
                        onChange={(value) =>
                            onUpdateSelectedTextClipProperty('positionY', value)
                        }
                        onReset={() =>
                            onUpdateSelectedTextClipProperty('positionY', 0)
                        }
                        resetTitle="Reset position Y"
                        unit="px"
                        value={selectedTextClip.positionY}
                    />
                    <TransformControl
                        label="Rotation"
                        max={180}
                        min={-180}
                        onChange={(value) =>
                            onUpdateSelectedTextClipProperty('rotation', value)
                        }
                        onReset={() =>
                            onUpdateSelectedTextClipProperty('rotation', 0)
                        }
                        resetTitle="Reset rotation"
                        unit="deg"
                        value={selectedTextClip.rotation}
                    />
                </div>
            ) : (
                <div className="mt-4 space-y-4">
                    <TransformControl
                        disabled={!selectedVisualClip}
                        label="Scale"
                        max={160}
                        min={40}
                        onChange={(value) =>
                            onUpdateSelectedClipProperty('scale', value)
                        }
                        onReset={() =>
                            onUpdateSelectedClipProperty('scale', 100)
                        }
                        resetTitle="Reset scale"
                        unit="%"
                        value={selectedClipScale}
                    />
                    <TransformControl
                        disabled={!selectedVisualClip}
                        label="Position X"
                        max={100}
                        min={-100}
                        onChange={(value) =>
                            onUpdateSelectedClipProperty('positionX', value)
                        }
                        onReset={() =>
                            onUpdateSelectedClipProperty('positionX', 0)
                        }
                        resetTitle="Reset position X"
                        unit="px"
                        value={selectedClipPositionX}
                    />
                    <TransformControl
                        disabled={!selectedVisualClip}
                        label="Position Y"
                        max={100}
                        min={-100}
                        onChange={(value) =>
                            onUpdateSelectedClipProperty('positionY', value)
                        }
                        onReset={() =>
                            onUpdateSelectedClipProperty('positionY', 0)
                        }
                        resetTitle="Reset position Y"
                        unit="px"
                        value={selectedClipPositionY}
                    />
                    <TransformControl
                        disabled={!selectedVisualClip}
                        label="Rotation"
                        max={180}
                        min={-180}
                        onChange={(value) =>
                            onUpdateSelectedClipProperty('rotation', value)
                        }
                        onReset={() =>
                            onUpdateSelectedClipProperty('rotation', 0)
                        }
                        resetTitle="Reset rotation"
                        unit="deg"
                        value={selectedClipRotation}
                    />
                </div>
            )}
        </aside>
    );
}
