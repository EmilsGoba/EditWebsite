export type Project = {
    id: number;
    name: string;
    format: string;
    status: string;
    created_at: string;
};

export type EditorProps = {
    project: Project;
    media: ProjectMedia[];
    timelineClips: SavedTimelineClip[];
};

export type ProjectMedia = {
    id: number;
    type: 'video' | 'image' | 'audio';
    name: string;
    mime_type: string | null;
    size: number;
    url: string;
    created_at: string;
};

export type TimelineClipType = ProjectMedia['type'] | 'text';
export type ClipEffectId = 'blur' | 'glow' | 'invert-color';

export type ClipEffect = {
    id: ClipEffectId;
    start: number;
    duration: number;
};

export type TimelineClip = {
    id: number;
    mediaId: number | null;
    name: string;
    type: TimelineClipType;
    trackIndex: number;
    start: number;
    duration: number;
    sourceStart: number;
    scale: number;
    positionX: number;
    positionY: number;
    rotation: number;
    previewWidth?: number | null;
    previewHeight?: number | null;
    effects: ClipEffect[];
    color: string;
    url: string | null;
};

export type MediaDimensions = {
    width: number;
    height: number;
};

export type SavedTimelineClip = Omit<
    TimelineClip,
    'color' | 'effects' | 'positionX' | 'positionY' | 'rotation' | 'scale'
> &
    Partial<
        Pick<TimelineClip, 'positionX' | 'positionY' | 'rotation' | 'scale'>
    > & {
        effects?: (ClipEffect | ClipEffectId)[] | null;
    };

export type ClipTrimState = {
    clipId: number;
    edge: 'left' | 'right';
    linkedClipIds: number[];
    startingClips: TimelineClip[];
    trackLeft: number;
};

export type EffectTrimState = {
    clipId: number;
    effectIndex: number;
    edge: 'left' | 'right';
    startingClips: TimelineClip[];
    trackLeft: number;
};

export type SelectedEffect = {
    clipId: number;
    effectIndex: number;
};

export type PlayheadDragState = {
    trackLeft: number;
};

export type TimelineDropPreview = {
    track: TimelineTrack;
    name: string;
    type: TimelineClipType;
    trackIndex: number;
    start: number;
    duration: number;
    canPlace: boolean;
};

export type TimelineTrack = 'video' | 'audio' | 'text';

export type TimelineClipMovePreview = {
    clipId: number;
    linkedClipIds: number[];
    originalStart: number;
    previewStart: number;
    trackIndex: number;
    canPlace: boolean;
    offsetPixels: number;
};

export type CutPreview = {
    clipId: number;
    time: number;
};

export type TextPreviewDragState = {
    clipId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    startingClips: TimelineClip[];
};

export type VisualPreviewDragState = {
    action: 'move' | 'scale';
    clipId: number;
    startClientX: number;
    startClientY: number;
    startPositionX: number;
    startPositionY: number;
    startScale: number;
    startRotation: number;
    mediaBounds: PreviewMediaBounds | null;
    startingClips: TimelineClip[];
};

export type PreviewMediaBounds = {
    width: number;
    height: number;
    left: number;
    top: number;
};

export const uploadLimits =
    'Allowed files: MP4, MOV, JPG, JPEG, PNG, MP3. Videos up to 500 MB, images up to 10 MB, audio up to 50 MB.';
export const acceptedMediaTypes = '.mp4,.mov,.jpg,.jpeg,.png,.mp3';
export const timelineBaseWidth = 1100;
export const defaultTimelineSeconds = 70;
export const timelinePaddingSeconds = 10;
export const timelineMajorIntervalSeconds = 10;
export const timelineFramesPerSecond = 60;
export const timelineFrameDurationSeconds = 1 / timelineFramesPerSecond;
export const timelinePlaybackIntervalMs = 1000 / timelineFramesPerSecond;
export const visibleTimelineIntervalSeconds = 0.1;
export const timelineOverlapGapSeconds = timelineFrameDurationSeconds;
export const maxClipScale = 1000;
export const fixedAudioTrackCount = 2;
export const vfxMinimumWidthPixels = 18;
export const pageDragScrollEdgePixels = 120;
export const pageDragScrollMinStepPixels = 3;
export const pageDragScrollMaxStepPixels = 12;
export const mediaDragType = 'application/x-video-editor-media';
export const clipDragType = 'application/x-video-editor-clip';
export const textDragType = 'application/x-video-editor-text';
export const clipEffects: { id: ClipEffectId; label: string }[] = [
    {
        id: 'invert-color',
        label: 'Invert color',
    },
    {
        id: 'blur',
        label: 'Blur',
    },
    {
        id: 'glow',
        label: 'Glow',
    },
];
export const vfxDragType = 'application/x-video-editor-vfx';

export function snapToTimelineStep(seconds: number) {
    // The editor timeline snaps to 60 FPS, so clips and the playhead always land on real frame boundaries.
    const frame = Math.round(seconds * timelineFramesPerSecond);

    return Number((frame / timelineFramesPerSecond).toFixed(6));
}

export function getTextClipContent(name: string) {
    return name.replace(/(?: cut)+$/i, '');
}

export function getClipEffectLabel(effect: ClipEffectId) {
    return (
        clipEffects.find((clipEffect) => clipEffect.id === effect)?.label ??
        effect
    );
}

export function normalizeClipEffects(
    effects: (ClipEffect | ClipEffectId)[] | null | undefined,
    clipDuration: number,
): ClipEffect[] {
    return (effects ?? [])
        .map((effect) => {
            if (typeof effect === 'string') {
                return {
                    id: effect,
                    start: 0,
                    duration: clipDuration,
                };
            }

            return {
                id: effect.id,
                start: snapToTimelineStep(Math.max(0, effect.start)),
                duration: snapToTimelineStep(
                    Math.max(timelineFrameDurationSeconds, effect.duration),
                ),
            };
        })
        .filter(
            (effect): effect is ClipEffect =>
                clipEffects.some((clipEffect) => clipEffect.id === effect.id) &&
                effect.start < clipDuration,
        )
        .map((effect) => ({
            ...effect,
            duration: Math.min(effect.duration, clipDuration - effect.start),
        }));
}

export function getClipTrack(clip: Pick<TimelineClip, 'type'>): TimelineTrack {
    if (clip.type === 'audio') {
        return 'audio';
    }

    if (clip.type === 'text') {
        return 'text';
    }

    return 'video';
}

export function getAllowedTimelineTrackIndex(
    type: TimelineClipType,
    trackIndex: number,
) {
    if (type === 'video' || type === 'image') {
        return 1;
    }

    return Math.min(2, Math.max(1, trackIndex));
}

export const defaultClipProperties = {
    scale: 100,
    positionX: 0,
    positionY: 0,
    rotation: 0,
};

export function getTemporaryClipDuration(type: TimelineClipType) {
    if (type === 'text') {
        return 5;
    }

    if (type === 'image') {
        return 5;
    }

    if (type === 'audio') {
        return 12;
    }

    return 10;
}

export function getTimelineColor(type: TimelineClipType) {
    if (type === 'text') {
        return 'bg-violet-600';
    }

    if (type === 'audio') {
        return 'bg-emerald-700/80';
    }

    if (type === 'image') {
        return 'bg-cyan-500';
    }

    return 'bg-orange-500';
}
