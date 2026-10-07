<?php

namespace App\Services\Projects;

use App\Models\Project;
use App\Models\ProjectTimelineClip;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\Process\Process;

class TimelineExporter
{
    /**
     * Render the saved visual timeline into a downloadable video file.
     *
     * @param  array{file_type: string, quality: string}  $validated
     */
    public function render(Project $project, array $validated): RedirectResponse|BinaryFileResponse
    {
        @set_time_limit(300);
        ini_set('max_execution_time', '300');
        $clips = $project->timelineClips()
            ->with('media')
            ->orderBy('sort_order')
            ->get();
        $visualClips = $clips
            ->filter(fn ($clip) => in_array($clip->type, ['video', 'image'], true))
            ->values();
        $audioClips = $clips
            ->filter(fn ($clip) => $clip->type === 'audio')
            ->values();
        $textClips = $clips
            ->filter(fn ($clip) => $clip->type === 'text' && trim((string) $clip->name) !== '')
            ->values();

        if ($visualClips->isEmpty()) {
            return back()->withErrors([
                'export' => __('Add at least one video or image fragment before exporting.'),
            ]);
        }

        $ffmpegPath = $this->ffmpegPath();

        if ($ffmpegPath === '') {
            return back()->withErrors([
                'export' => __('FFmpeg is not installed. Install it on your Mac with: brew install ffmpeg'),
            ]);
        }

        $renderSize = $this->exportRenderSize($project->format, $validated['quality']);
        $temporaryDirectory = storage_path('app/exports');

        if (! is_dir($temporaryDirectory)) {
            mkdir($temporaryDirectory, 0755, true);
        }

        $extension = $validated['file_type'];
        $outputPath = $temporaryDirectory.'/project-'.$project->id.'-'.now()->format('YmdHis').'.'.$extension;
        $command = [$ffmpegPath, '-y'];
        $filters = [];
        $audioInputs = [];
        $textOverlayPaths = [];
        $timelineEnd = (float) $clips->max(fn ($clip) => $clip->start + $clip->duration);
        $visualRenderClips = $visualClips
            ->sortBy([
                ['track_index', 'asc'],
                ['start', 'asc'],
                ['sort_order', 'asc'],
            ])
            ->values();

        foreach ($visualRenderClips as $index => $clip) {
            $mediaPath = Storage::disk($clip->media->disk)->path($clip->media->path);

            if ($clip->type === 'image') {
                array_push(
                    $command,
                    '-loop',
                    '1',
                    '-t',
                    (string) $clip->duration,
                    '-i',
                    $mediaPath,
                );
            } else {
                $command[] = '-i';
                $command[] = $mediaPath;
            }

            $clipExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $scaledWidth = (int) round($renderSize['width'] * ((float) $clip->scale / 100));
            $scaledHeight = (int) round($renderSize['height'] * ((float) $clip->scale / 100));
            $positionX = (int) round((float) $clip->position_x * $clipExportScale);
            $positionY = (int) round((float) $clip->position_y * $clipExportScale);

            $effectFilters = $this->clipEffectFilters($clip);

            if ($clip->type === 'image') {
                $filters[] = sprintf(
                    '[%d:v]setpts=PTS-STARTPTS,scale=%d:%d:force_original_aspect_ratio=decrease,fps=60,setsar=1,format=rgba%s,setpts=PTS+%F/TB[clip%dscaled]',
                    $index,
                    $this->evenDimension($scaledWidth),
                    $this->evenDimension($scaledHeight),
                    $effectFilters,
                    (float) $clip->start,
                    $index,
                );
            } else {
                $filters[] = sprintf(
                    '[%d:v]trim=start=%F:duration=%F,setpts=PTS-STARTPTS,scale=%d:%d:force_original_aspect_ratio=decrease,fps=60,setsar=1,format=rgba%s,setpts=PTS+%F/TB[clip%dscaled]',
                    $index,
                    (float) $clip->source_start,
                    (float) $clip->duration,
                    $this->evenDimension($scaledWidth),
                    $this->evenDimension($scaledHeight),
                    $effectFilters,
                    (float) $clip->start,
                    $index,
                );
            }
        }

        $filters[] = sprintf(
            'color=c=black:s=%dx%d:d=%F:r=60,format=rgba[basev0]',
            $renderSize['width'],
            $renderSize['height'],
            $timelineEnd,
        );

        $videoOutputLabel = 'basev0';

        foreach ($visualRenderClips as $index => $clip) {
            $nextVideoOutputLabel = 'visualv'.$index;
            $clipExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $positionX = (int) round((float) $clip->position_x * $clipExportScale);
            $positionY = (int) round((float) $clip->position_y * $clipExportScale);

            // Visual timeline clips are overlaid onto one full-length canvas at their saved start/end times.
            // This keeps export timing aligned with the editor instead of concatenating clips sequentially.
            $filters[] = sprintf(
                '[%s][clip%dscaled]overlay=x=\'(W-w)/2%+d\':y=\'(H-h)/2%+d\':enable=\'between(t,%F,%F)\':eof_action=pass:shortest=0,format=rgba[%s]',
                $videoOutputLabel,
                $index,
                $positionX,
                $positionY,
                (float) $clip->start,
                (float) ($clip->start + $clip->duration),
                $nextVideoOutputLabel,
            );

            $videoOutputLabel = $nextVideoOutputLabel;
        }

        foreach ($audioClips as $index => $clip) {
            $inputIndex = $visualRenderClips->count() + $index;
            $mediaPath = Storage::disk($clip->media->disk)->path($clip->media->path);
            $audioLabel = 'a'.$index;
            $delayMilliseconds = (int) round($clip->start * 1000);

            array_push(
                $command,
                '-ss',
                (string) $clip->source_start,
                '-t',
                (string) $clip->duration,
                '-i',
                $mediaPath,
            );

            // Each timeline audio clip is trimmed from its source, delayed to its timeline position, then mixed into one export track.
            $filters[] = sprintf(
                '[%d:a]asetpts=PTS-STARTPTS,adelay=%d:all=1[%s]',
                $inputIndex,
                $delayMilliseconds,
                $audioLabel,
            );
            $audioInputs[] = '['.$audioLabel.']';
        }

        foreach ($textClips as $index => $clip) {
            $textExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $fontSize = (int) round(18 * $textExportScale * ((float) $clip->scale / 100));
            $textOverlayPath = $this->createTextOverlayImage(
                (string) $clip->name,
                max(12, min(180, $fontSize)),
                $temporaryDirectory,
                $index,
            );

            $textOverlayPaths[] = $textOverlayPath;

            array_push(
                $command,
                '-loop',
                '1',
                '-t',
                (string) $timelineEnd,
                '-i',
                $textOverlayPath,
            );
        }

        foreach ($textClips as $index => $clip) {
            $nextVideoOutputLabel = 'textv'.$index;
            $textInputIndex = $visualRenderClips->count() + $audioClips->count() + $index;
            $textOverlayLabel = 'textoverlay'.$index;
            $textExportScale = $this->previewExportScale($project->format, $renderSize, $clip);
            $positionX = (int) round((float) $clip->position_x * $textExportScale);
            $positionY = (int) round((float) $clip->position_y * $textExportScale);

            // Text clips are first rendered as transparent PNGs, then overlaid so the export works even without FFmpeg drawtext support.
            $filters[] = sprintf('[%d:v]format=rgba[%s]', $textInputIndex, $textOverlayLabel);
            $filters[] = sprintf(
                '[%s][%s]overlay=x=\'max(0\,min(W-w\,(W-w)/2%+d))\':y=\'max(0\,min(H-h\,(H-h)/2%+d))\':enable=\'between(t,%F,%F)\'[%s]',
                $videoOutputLabel,
                $textOverlayLabel,
                $positionX,
                $positionY,
                (float) $clip->start,
                (float) ($clip->start + $clip->duration),
                $nextVideoOutputLabel,
            );

            $videoOutputLabel = $nextVideoOutputLabel;
        }

        if ($videoOutputLabel !== 'outv') {
            $filters[] = sprintf('[%s]format=yuv420p[outv]', $videoOutputLabel);
        }

        if ($audioClips->isNotEmpty()) {
            $filters[] = sprintf(
                '%samix=inputs=%d:duration=longest:dropout_transition=0,atrim=0:%F,asetpts=PTS-STARTPTS[outa]',
                implode('', $audioInputs),
                $audioClips->count(),
                $timelineEnd,
            );
        }

        array_push(
            $command,
            '-filter_complex',
            implode(';', $filters),
            '-map',
            '[outv]',
        );

        if ($audioClips->isNotEmpty()) {
            array_push(
                $command,
                '-map',
                '[outa]',
                '-c:a',
                'aac',
                '-b:a',
                '192k',
            );
        } else {
            $command[] = '-an';
        }

        array_push(
            $command,
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '23',
            '-pix_fmt',
            'yuv420p',
            '-movflags',
            '+faststart',
            $outputPath,
        );

        $process = new Process($command);
        $process->setTimeout(300);
        $process->run();

        foreach ($textOverlayPaths as $textOverlayPath) {
            @unlink($textOverlayPath);
        }

        if (! $process->isSuccessful() || ! file_exists($outputPath)) {
            report(new \RuntimeException($process->getErrorOutput()));

            return back()->withErrors([
                'export' => __('Video export failed. Check that uploaded files are valid video or image files.'),
            ]);
        }

        return response()
            ->download($outputPath, str($project->name)->slug()->append('.'.$extension)->toString())
            ->deleteFileAfterSend();
    }

    /**
     * Render a text clip to a transparent image that FFmpeg can overlay on the video.
     */
    private function createTextOverlayImage(string $text, int $fontSize, string $directory, int $index): string
    {
        $text = trim(str_replace(["\n", "\r"], ' ', $text));
        $fontPath = $this->textRenderFontPath();
        $padding = max(12, (int) round($fontSize * 0.35));

        $box = $fontPath !== null ? imagettfbbox($fontSize, 0, $fontPath, $text) : false;

        if ($box !== false) {
            $minX = min($box[0], $box[2], $box[4], $box[6]);
            $maxX = max($box[0], $box[2], $box[4], $box[6]);
            $minY = min($box[1], $box[3], $box[5], $box[7]);
            $maxY = max($box[1], $box[3], $box[5], $box[7]);
            $width = (int) max(1, $maxX - $minX + $padding * 2);
            $height = (int) max(1, $maxY - $minY + $padding * 2);
            $textX = $padding - $minX;
            $textY = $padding - $minY;
        } else {
            $width = max(1, imagefontwidth(5) * strlen($text) + $padding * 2);
            $height = max(1, imagefontheight(5) + $padding * 2);
            $textX = $padding;
            $textY = $padding;
        }

        if ($width < 1) {
            $width = 1;
        }

        if ($height < 1) {
            $height = 1;
        }

        $image = imagecreatetruecolor($width, $height);
        imagesavealpha($image, true);
        $transparent = imagecolorallocatealpha($image, 0, 0, 0, 127) ?: 0;
        imagefill($image, 0, 0, $transparent);

        $white = imagecolorallocate($image, 255, 255, 255) ?: 0;
        $shadow = imagecolorallocatealpha($image, 0, 0, 0, 25) ?: 0;

        if ($fontPath !== null) {
            imagettftext($image, $fontSize, 0, $textX + 2, $textY + 2, $shadow, $fontPath, $text);
            imagettftext($image, $fontSize, 0, $textX, $textY, $white, $fontPath, $text);
        } else {
            imagestring($image, 5, $textX + 2, $textY + 2, $text, $shadow);
            imagestring($image, 5, $textX, $textY, $text, $white);
        }

        $path = $directory.'/text-overlay-'.now()->format('YmdHis').'-'.$index.'.png';
        imagepng($image, $path);
        imagedestroy($image);

        return $path;
    }

    private function textRenderFontPath(): ?string
    {
        $fonts = [
            '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
            '/System/Library/Fonts/Supplemental/Arial.ttf',
            '/Library/Fonts/Arial.ttf',
        ];

        foreach ($fonts as $font) {
            if (is_file($font)) {
                return $font;
            }
        }

        return null;
    }

    /**
     * Convert saved clip effects into FFmpeg filters.
     */
    private function clipEffectFilters(ProjectTimelineClip $clip): string
    {
        $effects = $clip->effects ?? [];
        $filters = '';

        foreach ($effects as $effect) {
            if (is_string($effect) && $effect === 'invert-color') {
                $filters .= ',negate';

                continue;
            }

            if (is_string($effect) && $effect === 'blur') {
                $filters .= ',boxblur=6';

                continue;
            }

            if (is_string($effect) && $effect === 'glow') {
                $filters .= ',eq=brightness=0.08:saturation=1.35:contrast=1.08';

                continue;
            }

            $effectId = is_array($effect) ? ($effect['id'] ?? null) : null;

            if (! in_array($effectId, ['blur', 'glow', 'invert-color'], true)) {
                continue;
            }
            $start = max(0, (float) ($effect['start'] ?? 0));
            $end = min(
                (float) $clip->duration,
                $start + max(0.01, (float) ($effect['duration'] ?? 0)),
            );

            if ($start >= $end) {
                continue;
            }

            if ($effectId === 'invert-color') {
                $filters .= sprintf(",negate=enable='between(t\\,%F\\,%F)'", $start, $end);
            }

            if ($effectId === 'blur') {
                $filters .= sprintf(",boxblur=6:enable='between(t\\,%F\\,%F)'", $start, $end);
            }

            if ($effectId === 'glow') {
                $filters .= sprintf(",eq=brightness=0.08:saturation=1.35:contrast=1.08:enable='between(t\\,%F\\,%F)'", $start, $end);
            }
        }

        return $filters;
    }

    /**
     * Convert editor-preview pixels to export pixels for text and visual clip transforms.
     *
     * @param  array{width: int, height: int}  $renderSize
     */
    private function previewExportScale(string $format, array $renderSize, ProjectTimelineClip $clip): float
    {
        $previewSize = [
            'width' => $clip->preview_width ?: null,
            'height' => $clip->preview_height ?: null,
        ];

        if (! $previewSize['width'] || ! $previewSize['height']) {
            $previewSize = match ($format) {
                '9:16' => ['width' => 405, 'height' => 720],
                '1:1' => ['width' => 540, 'height' => 540],
                default => ['width' => 740, 'height' => 416],
            };
        }

        return min(
            $renderSize['width'] / $previewSize['width'],
            $renderSize['height'] / $previewSize['height'],
        );
    }

    private function evenDimension(int $value): int
    {
        $value = max(2, $value);

        return $value % 2 === 0 ? $value : $value + 1;
    }

    /**
     * Pick the server render size from project format and export quality.
     *
     * @return array{width: int, height: int}
     */
    private function exportRenderSize(string $format, string $quality): array
    {
        if ($format === '9:16') {
            return $quality === '720p'
                ? ['width' => 720, 'height' => 1280]
                : ['width' => 1080, 'height' => 1920];
        }

        if ($format === '1:1') {
            return $quality === '720p'
                ? ['width' => 720, 'height' => 720]
                : ['width' => 1080, 'height' => 1080];
        }

        return $quality === '720p'
            ? ['width' => 1280, 'height' => 720]
            : ['width' => 1920, 'height' => 1080];
    }

    /**
     * MAMP/PHP may not inherit the terminal PATH, so also check Homebrew's usual FFmpeg locations.
     */
    private function ffmpegPath(): string
    {
        $paths = [
            trim((string) shell_exec('command -v ffmpeg 2>/dev/null')),
            '/opt/homebrew/bin/ffmpeg',
            '/usr/local/bin/ffmpeg',
        ];

        foreach ($paths as $path) {
            if ($path !== '' && is_file($path) && is_executable($path)) {
                return $path;
            }
        }

        return '';
    }
}
