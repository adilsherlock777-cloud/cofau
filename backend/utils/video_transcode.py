"""
Video Transcoding Utility

Converts videos to optimized 720p H.264 MP4 format and generates thumbnails.
Optimizes high-quality iPhone videos for faster loading and better performance.
"""

import os
import subprocess
import asyncio
from typing import Optional, Tuple


async def transcode_video_to_mp4(input_path: str, output_path: Optional[str] = None, target_height: int = 720) -> str:
    """
    Transcode video to optimized 720p MP4 format (H.264 codec)
    
    Args:
        input_path: Path to the input video file (e.g., .mov)
        output_path: Optional path for output file. If None, replaces extension with .mp4
        target_height: Target video height in pixels (default: 720p)
        
    Returns:
        Path to the transcoded video file
        
    Raises:
        Exception: If transcoding fails
    """
    
    # Generate output path if not provided
    if output_path is None:
        base_path = os.path.splitext(input_path)[0]
        output_path = f"{base_path}.mp4"
    
    # Check if input file exists
    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input video file not found: {input_path}")
    
    print(f"🎬 Starting video transcoding to 720p: {input_path} -> {output_path}")
    
    try:
        # FFmpeg command to transcode to optimized 720p web-compatible format
        # -i: input file
        # -vf scale=-2:720: scale to 720p height, maintain aspect ratio (width auto-calculated, divisible by 2)
        # -c:v libx264: use H.264 video codec (universally supported)
        # -preset medium: good balance between speed and compression
        # -crf 23: constant rate factor (quality, 18-28 range, 23 is good)
        # -maxrate 2M: maximum bitrate for 720p
        # -bufsize 4M: buffer size for rate control
        # -c:a aac: use AAC audio codec (universally supported)
        # -b:a 128k: audio bitrate
        # -movflags +faststart: optimize for web streaming (moov atom at start)
        # -pix_fmt yuv420p: ensure compatibility with all players
        # -y: overwrite output file if exists
        
        cmd = [
            'ffmpeg',
            '-i', input_path,                      # Input file
            '-vf', f'scale=-2:{target_height}',    # Scale to 720p (width auto, maintain aspect ratio)
            '-c:v', 'libx264',                     # Video codec: H.264
            '-preset', 'medium',                   # Encoding speed/quality balance
            '-crf', '23',                          # Quality (lower = better, 18-28 range)
            '-maxrate', '2M',                      # Max bitrate for 720p
            '-bufsize', '4M',                      # Buffer size
            '-c:a', 'aac',                         # Audio codec: AAC
            '-b:a', '128k',                        # Audio bitrate
            '-movflags', '+faststart',             # Web optimization
            '-pix_fmt', 'yuv420p',                 # Pixel format compatibility
            '-y',                                  # Overwrite output
            output_path
        ]
        
        # Run ffmpeg in subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
            print(f"❌ FFmpeg transcoding failed: {error_msg}")
            raise Exception(f"FFmpeg transcoding failed: {error_msg}")
        
        # Verify output file was created
        if not os.path.exists(output_path):
            raise Exception(f"Transcoded file was not created: {output_path}")
        
        output_size = os.path.getsize(output_path)
        input_size = os.path.getsize(input_path)
        compression_ratio = (1 - output_size / input_size) * 100 if input_size > 0 else 0
        print(f"✅ Video transcoded to 720p successfully!")
        print(f"   Input:  {input_path} ({input_size:,} bytes)")
        print(f"   Output: {output_path} ({output_size:,} bytes)")
        print(f"   Compression: {compression_ratio:.1f}% size reduction")
        
        # Delete original file to save space
        try:
            os.remove(input_path)
            print(f"🗑️  Deleted original file: {input_path}")
        except Exception as e:
            print(f"⚠️  Failed to delete original file: {e}")
        
        return output_path
        
    except Exception as e:
        print(f"❌ Error during video transcoding: {str(e)}")
        # Clean up failed output file if it exists
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except:
                pass
        raise


async def generate_video_thumbnail(video_path: str, thumbnail_path: Optional[str] = None, time_offset: str = "00:00:01") -> str:
    """
    Generate a thumbnail image from a video
    
    Args:
        video_path: Path to the video file
        thumbnail_path: Optional path for thumbnail. If None, adds _thumb.jpg to video name
        time_offset: Time offset to capture thumbnail (default: 1 second)
        
    Returns:
        Path to the generated thumbnail
        
    Raises:
        Exception: If thumbnail generation fails
    """
    
    # Generate thumbnail path if not provided
    if thumbnail_path is None:
        base_path = os.path.splitext(video_path)[0]
        thumbnail_path = f"{base_path}_thumb.jpg"
    
    # Check if video file exists
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")
    
    print(f"📸 Generating thumbnail: {video_path} -> {thumbnail_path}")
    
    try:
        # FFmpeg command to extract a frame as thumbnail
        # -ss: time offset to seek to
        # -i: input video file
        # -vframes 1: extract only one frame
        # -vf scale=-2:360: scale to 360p for thumbnail (smaller size)
        # -q:v 2: quality (1-31, lower is better, 2-5 is good for thumbnails)
        # -y: overwrite output
        
        cmd = [
            'ffmpeg',
            '-ss', time_offset,          # Seek to time offset
            '-i', video_path,            # Input video
            '-vframes', '1',             # Extract 1 frame
            '-vf', 'scale=-2:360',       # Scale to 360p for thumbnail
            '-q:v', '2',                 # Quality (2 = high quality)
            '-y',                        # Overwrite output
            thumbnail_path
        ]
        
        # Run ffmpeg in subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            error_msg = stderr.decode('utf-8') if stderr else "Unknown error"
            print(f"❌ FFmpeg thumbnail generation failed: {error_msg}")
            raise Exception(f"FFmpeg thumbnail generation failed: {error_msg}")
        
        # Verify thumbnail was created
        if not os.path.exists(thumbnail_path):
            raise Exception(f"Thumbnail was not created: {thumbnail_path}")
        
        thumb_size = os.path.getsize(thumbnail_path)
        print(f"✅ Thumbnail generated successfully!")
        print(f"   Thumbnail: {thumbnail_path} ({thumb_size:,} bytes)")
        
        return thumbnail_path
        
    except Exception as e:
        print(f"❌ Error generating thumbnail: {str(e)}")
        # Clean up failed thumbnail if it exists
        if os.path.exists(thumbnail_path):
            try:
                os.remove(thumbnail_path)
            except:
                pass
        raise


async def optimize_video_with_thumbnail(input_path: str) -> Tuple[str, str]:
    """
    Optimize video to 720p and generate thumbnail
    
    Args:
        input_path: Path to the input video file
        
    Returns:
        Tuple of (optimized_video_path, thumbnail_path)
        
    Raises:
        Exception: If optimization fails
    """
    
    print(f"🎬 Optimizing video with thumbnail generation: {input_path}")
    
    # Transcode video to 720p
    video_path = await transcode_video_to_mp4(input_path, target_height=720)
    
    # Generate thumbnail
    thumbnail_path = await generate_video_thumbnail(video_path)
    
    print(f"✅ Video optimization complete!")
    print(f"   Video: {video_path}")
    print(f"   Thumbnail: {thumbnail_path}")
    
    return video_path, thumbnail_path


def should_transcode_video(filename: str) -> bool:
    """
    Check if a video file should be transcoded
    
    Args:
        filename: Name of the video file
        
    Returns:
        True if the file should be transcoded, False otherwise
    """
    ext = filename.split(".")[-1].lower()
    
    # Transcode ALL video formats to ensure 720p optimization
    # This includes iPhone videos (.mov) and already-compressed formats (.mp4)
    return ext in ["mov", "m4v", "avi", "mkv", "flv", "wmv", "3gp", "mp4"]


def get_transcoded_filename(original_filename: str) -> str:
    """
    Get the transcoded filename (replaces extension with .mp4)
    
    Args:
        original_filename: Original filename
        
    Returns:
        Filename with .mp4 extension
    """
    base_name = os.path.splitext(original_filename)[0]
    return f"{base_name}.mp4"

