import {
    MousePointer2,
    Minus,
    Pause,
    Play,
    Plus,
    Redo2,
    Scissors,
    Trash2,
    Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

type TimelineToolbarProps = {
    canRedo: boolean;
    canUndo: boolean;
    canDeleteSelection: boolean;
    isPlaying: boolean;
    onChangeZoom: (amount: number) => void;
    onDeleteSelection: () => void;
    onRedo: () => void;
    onSelectTool: (tool: 'select' | 'cut') => void;
    onSetZoom: (zoom: number) => void;
    onTogglePlayback: () => void;
    onUndo: () => void;
    playheadLabel: string;
    selectedTool: 'select' | 'cut';
    selectionDeleteTitle: string;
    timelineZoom: number;
};

export function TimelineToolbar({
    canRedo,
    canUndo,
    canDeleteSelection,
    isPlaying,
    onChangeZoom,
    onDeleteSelection,
    onRedo,
    onSelectTool,
    onSetZoom,
    onTogglePlayback,
    onUndo,
    playheadLabel,
    selectedTool,
    selectionDeleteTitle,
    timelineZoom,
}: TimelineToolbarProps) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
                <Button size="icon" onClick={onTogglePlayback} type="button">
                    {isPlaying ? (
                        <Pause className="size-4" />
                    ) : (
                        <Play className="size-4" />
                    )}
                    <span className="sr-only">Toggle playback</span>
                </Button>
                <span className="font-mono text-sm text-zinc-400">
                    {playheadLabel}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    size="icon"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    disabled={!canUndo}
                    onClick={onUndo}
                    title="Undo"
                    type="button"
                >
                    <Undo2 className="size-4" />
                    <span className="sr-only">Undo</span>
                </Button>
                <Button
                    size="icon"
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    disabled={!canRedo}
                    onClick={onRedo}
                    title="Redo"
                    type="button"
                >
                    <Redo2 className="size-4" />
                    <span className="sr-only">Redo</span>
                </Button>
                <Button
                    variant={selectedTool === 'select' ? 'default' : 'outline'}
                    onClick={() => onSelectTool('select')}
                >
                    <MousePointer2 className="size-4" />
                    Select
                </Button>
                <Button
                    variant={selectedTool === 'cut' ? 'default' : 'outline'}
                    onClick={() => onSelectTool('cut')}
                >
                    <Scissors className="size-4" />
                    Cut
                </Button>
                <Button
                    variant="outline"
                    className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    disabled={!canDeleteSelection}
                    onClick={onDeleteSelection}
                    title={selectionDeleteTitle}
                    type="button"
                >
                    <Trash2 className="size-4" />
                    Delete
                </Button>
            </div>

            <label className="flex items-center gap-2">
                <span className="sr-only">Timeline zoom</span>
                <Button
                    size="icon"
                    variant="outline"
                    className="size-8 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => onChangeZoom(-50)}
                    title="Zoom out"
                    type="button"
                >
                    <Minus className="size-4" />
                    <span className="sr-only">Zoom out</span>
                </Button>
                <input
                    className="w-32 accent-cyan-500"
                    max="1000"
                    min="0"
                    onChange={(event) => onSetZoom(Number(event.target.value))}
                    step="10"
                    type="range"
                    value={timelineZoom}
                />
                <Button
                    size="icon"
                    variant="outline"
                    className="size-8 border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                    onClick={() => onChangeZoom(50)}
                    title="Zoom in"
                    type="button"
                >
                    <Plus className="size-4" />
                    <span className="sr-only">Zoom in</span>
                </Button>
            </label>
        </div>
    );
}
