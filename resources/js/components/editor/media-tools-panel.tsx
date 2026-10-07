import type { ChangeEvent, DragEvent, RefObject } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkles, Trash2, Type, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    acceptedMediaTypes,
    clipEffects,
    uploadLimits,
} from '@/lib/editor-timeline';
import type { ClipEffectId, ProjectMedia } from '@/lib/editor-timeline';

type MediaToolsPanelProps = {
    fileInputRef: RefObject<HTMLInputElement | null>;
    formatFileSize: (bytes: number) => string;
    formatShortDuration: (seconds: number) => string;
    getMediaIcon: (type: ProjectMedia['type']) => LucideIcon;
    isDeletingMedia: boolean;
    isUploading: boolean;
    media: ProjectMedia[];
    mediaDurations: Record<number, number>;
    onDeleteSelectedMedia: () => void;
    onMediaDrag: (event: DragEvent<HTMLButtonElement>) => void;
    onMediaDragEnd: () => void;
    onMediaDragStart: (
        event: DragEvent<HTMLButtonElement>,
        item: ProjectMedia,
    ) => void;
    onOpenMediaPicker: () => void;
    onTextDrag: (event: DragEvent<HTMLButtonElement>) => void;
    onTextDragEnd: () => void;
    onTextDragStart: (event: DragEvent<HTMLButtonElement>) => void;
    onToggleDeleteMediaMode: () => void;
    onToggleSelectedMedia: (mediaId: number) => void;
    onUploadMedia: (event: ChangeEvent<HTMLInputElement>) => void;
    onVfxDrag: (event: DragEvent<HTMLButtonElement>) => void;
    onVfxDragEnd: () => void;
    onVfxDragStart: (
        event: DragEvent<HTMLButtonElement>,
        effect: ClipEffectId,
    ) => void;
    rememberMediaDuration: (mediaId: number, duration: number) => void;
    selectedMediaIds: number[];
    uploadError: string | null;
};

export function MediaToolsPanel({
    fileInputRef,
    formatFileSize,
    formatShortDuration,
    getMediaIcon,
    isDeletingMedia,
    isUploading,
    media,
    mediaDurations,
    onDeleteSelectedMedia,
    onMediaDrag,
    onMediaDragEnd,
    onMediaDragStart,
    onOpenMediaPicker,
    onTextDrag,
    onTextDragEnd,
    onTextDragStart,
    onToggleDeleteMediaMode,
    onToggleSelectedMedia,
    onUploadMedia,
    onVfxDrag,
    onVfxDragEnd,
    onVfxDragStart,
    rememberMediaDuration,
    selectedMediaIds,
    uploadError,
}: MediaToolsPanelProps) {
    return (
        <aside className="grid border-b border-zinc-800 bg-zinc-900/70 lg:row-span-2 lg:grid-rows-[minmax(0,1fr)_auto] lg:border-r lg:border-b-0">
            <section className="min-h-0 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            Media Pool
                        </h2>
                        <p className="text-xs text-zinc-500">Project files</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {isDeletingMedia && (
                            <Button
                                className="h-9 border-red-500/40 bg-red-500/10 px-3 text-xs text-red-100 hover:bg-red-500/20"
                                disabled={selectedMediaIds.length === 0}
                                onClick={onDeleteSelectedMedia}
                                type="button"
                                variant="outline"
                            >
                                Delete
                            </Button>
                        )}
                        <Button
                            size="icon"
                            variant="outline"
                            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                            disabled={media.length === 0}
                            onClick={onToggleDeleteMediaMode}
                            title="Select media to delete"
                            type="button"
                        >
                            <Trash2 className="size-4" />
                            <span className="sr-only">
                                Select media to delete
                            </span>
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            className="border-zinc-700 bg-zinc-950 text-zinc-200 hover:bg-zinc-800"
                            disabled={isUploading}
                            onClick={onOpenMediaPicker}
                            title={uploadLimits}
                            type="button"
                        >
                            <Upload className="size-4" />
                            <span className="sr-only">Upload media</span>
                        </Button>
                    </div>
                    <input
                        ref={fileInputRef}
                        accept={acceptedMediaTypes}
                        className="hidden"
                        onChange={onUploadMedia}
                        type="file"
                    />
                </div>

                {uploadError && (
                    <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {uploadError}
                    </p>
                )}

                {media.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {media.map((item) => {
                            const MediaIcon = getMediaIcon(item.type);

                            return (
                                <button
                                    className={`group relative cursor-grab overflow-hidden rounded-lg border bg-zinc-950 text-left transition hover:border-cyan-500 active:cursor-grabbing ${
                                        selectedMediaIds.includes(item.id)
                                            ? 'border-cyan-500'
                                            : 'border-zinc-800'
                                    }`}
                                    draggable={!isDeletingMedia}
                                    key={item.id}
                                    onClick={() => {
                                        if (isDeletingMedia) {
                                            onToggleSelectedMedia(item.id);
                                        }
                                    }}
                                    onDrag={onMediaDrag}
                                    onDragEnd={onMediaDragEnd}
                                    onDragStart={(event) =>
                                        onMediaDragStart(event, item)
                                    }
                                    title="Drag to the timeline"
                                    type="button"
                                >
                                    {isDeletingMedia && (
                                        <span className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded border border-zinc-600 bg-zinc-950/90">
                                            <input
                                                checked={selectedMediaIds.includes(
                                                    item.id,
                                                )}
                                                className="size-3.5 accent-cyan-500"
                                                onChange={() =>
                                                    onToggleSelectedMedia(
                                                        item.id,
                                                    )
                                                }
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                type="checkbox"
                                            />
                                        </span>
                                    )}
                                    <span className="flex aspect-video items-center justify-center overflow-hidden bg-zinc-800">
                                        {item.type === 'image' ? (
                                            <img
                                                alt={item.name}
                                                className="size-full object-cover transition group-hover:scale-105"
                                                src={item.url}
                                            />
                                        ) : item.type === 'video' ? (
                                            <video
                                                className="size-full object-cover transition group-hover:scale-105"
                                                muted
                                                onLoadedMetadata={(event) =>
                                                    rememberMediaDuration(
                                                        item.id,
                                                        event.currentTarget
                                                            .duration,
                                                    )
                                                }
                                                playsInline
                                                preload="metadata"
                                                src={item.url}
                                            >
                                                <track kind="captions" />
                                            </video>
                                        ) : (
                                            <>
                                                <MediaIcon className="size-6 text-zinc-400 group-hover:text-cyan-400" />
                                                <audio
                                                    className="hidden"
                                                    onLoadedMetadata={(event) =>
                                                        rememberMediaDuration(
                                                            item.id,
                                                            event.currentTarget
                                                                .duration,
                                                        )
                                                    }
                                                    preload="metadata"
                                                    src={item.url}
                                                />
                                            </>
                                        )}
                                    </span>
                                    <span className="block min-w-0 p-2">
                                        <span className="block truncate text-xs font-medium text-zinc-200">
                                            {item.name}
                                        </span>
                                        <span className="flex items-center justify-between gap-2 text-xs text-zinc-500">
                                            <span className="capitalize">
                                                {item.type}
                                            </span>
                                            <span>
                                                {mediaDurations[item.id]
                                                    ? formatShortDuration(
                                                          mediaDurations[
                                                              item.id
                                                          ],
                                                      )
                                                    : formatFileSize(item.size)}
                                            </span>
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950 px-4 py-8 text-center">
                        <Upload className="mx-auto mb-3 size-6 text-zinc-500" />
                        <p className="text-sm font-medium text-zinc-300">
                            No media uploaded yet
                        </p>
                        <p className="mt-1 text-xs leading-5 text-zinc-500">
                            {uploadLimits}
                        </p>
                    </div>
                )}
            </section>

            <section className="border-t border-zinc-800 p-4">
                <div className="mb-4 flex items-center gap-2">
                    <Type className="size-4 text-cyan-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            Text
                        </h2>
                        <p className="text-xs text-zinc-500">
                            Temporary text tools
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    <button
                        className="flex w-full items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-cyan-500 hover:text-white"
                        draggable
                        onDrag={onTextDrag}
                        onDragEnd={onTextDragEnd}
                        onDragStart={onTextDragStart}
                        type="button"
                    >
                        <span>Text</span>
                        <span className="text-xs text-zinc-600">TXT</span>
                    </button>
                </div>
            </section>

            <section className="border-t border-zinc-800 p-4">
                <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="size-4 text-cyan-400" />
                    <div>
                        <h2 className="text-sm font-semibold text-white">
                            VFX
                        </h2>
                        <p className="text-xs text-zinc-500">
                            Temporary clip effects
                        </p>
                    </div>
                </div>

                <div className="space-y-2">
                    {clipEffects.map((effect) => (
                        <button
                            className="flex w-full cursor-grab items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-left text-sm text-zinc-300 transition hover:border-cyan-500 hover:text-white active:cursor-grabbing"
                            draggable
                            key={effect.id}
                            onDrag={onVfxDrag}
                            onDragEnd={onVfxDragEnd}
                            onDragStart={(event) =>
                                onVfxDragStart(event, effect.id)
                            }
                            type="button"
                        >
                            <span>{effect.label}</span>
                            <span className="text-xs text-zinc-600">FX</span>
                        </button>
                    ))}
                </div>
            </section>
        </aside>
    );
}
