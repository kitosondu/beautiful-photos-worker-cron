// photos.data_json structure
export interface PhotoData {
    photo_id: string;
    raw_path: string;
    small_path: string;
    full_path: string;
    photo_url: string;
    user_fullname: string;
    user_profile: string;
    user_profile_image: string;
    photo_location: string;
    download_tracking_url: string;
    exif: any;
    photo_width: number;
    photo_height: number;
    blur_hash: string;
    created_at: string;
}
