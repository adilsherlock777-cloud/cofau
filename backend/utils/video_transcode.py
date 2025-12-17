"""
Video Transcoding Utility

Converts iPhone videos (.mov with HEVC/H.265) to web-compatible MP4 (H.264)
to ensure videos play correctly on all devices and browsers.
"""

import os
import subprocess
import asyncio
from typing import Optional


async def transcode_video_to_mp4(input_path: str, output_path: Optional[str] = None) -> str:
    """
    Transcode video to web-compatible MP4 format (H.264 codec)
    
    Args:
        input_path: Path to the input video file (e.g., .mov)
        output_path: Optional path for output file. If None, replaces extension with .mp4
        
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
    
    print(f"🎬 Starting video transcoding: {input_path} -> {output_path}")
    
    try:
        # FFmpeg command to transcode to web-compatible format
        # -i: input file
        # -c:v libx264: use H.264 video codec (universally supported)
        # -preset fast: balance between speed and compression
        # -crf 23: constant rate factor (quality, 18-28 range, 23 is good)
        # -c:a aac: use AAC audio codec (universally supported)
        # -b:a 128k: audio bitrate
        # -movflags +faststart: optimize for web streaming (moov atom at start)
        # -pix_fmt yuv420p: ensure compatibility with all players
        # -y: overwrite output file if exists
        
        cmd = [
            'ffmpeg',
            '-i', input_path,           # Input file
            '-c:v', 'libx264',          # Video codec: H.264
            '-preset', 'fast',          # Encoding speed/quality balance
            '-crf', '23',               # Quality (lower = better, 18-28 range)
            '-c:a', 'aac',              # Audio codec: AAC
            '-b:a', '128k',             # Audio bitrate
            '-movflags', '+faststart',  # Web optimization
            '-pix_fmt', 'yuv420p',      # Pixel format compatibility
            '-y',                       # Overwrite output
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
        print(f"✅ Video transcoded successfully!")
        print(f"   Input:  {input_path} ({input_size:,} bytes)")
        print(f"   Output: {output_path} ({output_size:,} bytes)")
        
        # Delete original file to save space (optional)
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


def should_transcode_video(filename: str) -> bool:
    """
    Check if a video file should be transcoded
    
    Args:
        filename: Name of the video file
        
    Returns:
        True if the file should be transcoded, False otherwise
    """
    ext = filename.split(".")[-1].lower()
    
    # Transcode .mov files (iPhone videos) and other non-MP4 formats
    # Keep .mp4 files as they're likely already web-compatible
    return ext in ["mov", "m4v", "avi", "mkv", "flv", "wmv", "3gp"]


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

