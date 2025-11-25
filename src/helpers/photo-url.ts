/**
 * Generate optimized Unsplash photo URL from raw_path
 *
 * @param rawPath - Raw path from photo data
 * (e.g., https://images.unsplash.com/photo-1543858246-3195baf1e323?ixid=M3w3MjI0NjV8MHwxfHJhbmRvbXx8fHx8fHx8fDE3NDIyNDg3Mzl8&ixlib=rb-4.0.3)
 * @param width - Target width in pixels (default: 600)
 * @param quality - JPEG quality 1-100 (default: 80)
 * @returns Full Unsplash image URL
 */
export function generatePhotoUrl(
    rawPath: string,
    width: number = 600,
    quality: number = 80
): string {
    return `${rawPath}?w=${width}&q=${quality}`;
}
