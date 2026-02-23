"""
Sightengine Quality Scoring Service

This module integrates with Sightengine API to analyze image/video quality
and returns a normalized quality score (0-100) for leaderboard ranking.

Uses POST file upload for secure analysis — files are sent directly to
Sightengine without needing publicly accessible URLs.

Quality Score Components:
- Sharpness (0-1): Image/video clarity
- Contrast (0-1): Visual contrast quality
- Brightness (0-1): Lighting quality
- Colors quality (0-1): Color vibrancy and balance

Final Score = Average of all components * 100 (normalized to 0-100)
"""

import os
import httpx
import logging
import mimetypes
from typing import Dict, Optional
from config import settings

logger = logging.getLogger(__name__)

# Sightengine API Configuration
SIGHTENGINE_API_USER = settings.SIGHTENGINE_API_USER
SIGHTENGINE_API_SECRET = settings.SIGHTENGINE_API_SECRET
SIGHTENGINE_BASE_URL = "https://api.sightengine.com/1.0"

# Default quality score if API fails
DEFAULT_QUALITY_SCORE = 50.0


async def analyze_media_quality(file_path: str, media_type: str = "image", thumbnail_path: str = None) -> float:
    """
    Analyze media quality using Sightengine API via POST file upload.

    Args:
        file_path: Local path to the image/video file
        media_type: Either "image" or "video"
        thumbnail_path: For videos, path to the thumbnail image to analyze

    Returns:
        float: Quality score between 0-100
    """
    try:
        if media_type == "video":
            return await _analyze_video_quality(file_path, thumbnail_path)
        else:
            return await _analyze_image_quality(file_path)
    except Exception as e:
        logger.error(f"❌ Sightengine quality analysis failed for {file_path}: {str(e)}")
        return DEFAULT_QUALITY_SCORE


async def _analyze_image_quality(file_path: str) -> float:
    """
    Analyze image quality by uploading the file directly to Sightengine via POST.
    """
    if not os.path.exists(file_path):
        logger.error(f"❌ File not found for quality analysis: {file_path}")
        return DEFAULT_QUALITY_SCORE

    try:
        content_type = mimetypes.guess_type(file_path)[0] or "image/jpeg"
        filename = os.path.basename(file_path)

        with open(file_path, "rb") as f:
            files = {"media": (filename, f, content_type)}
            data = {
                "models": "properties",
                "api_user": SIGHTENGINE_API_USER,
                "api_secret": SIGHTENGINE_API_SECRET,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{SIGHTENGINE_BASE_URL}/check.json",
                    data=data,
                    files=files,
                )
                response.raise_for_status()
                result = response.json()

        if result.get("status") != "success":
            logger.error(f"❌ Sightengine returned error: {result.get('error', {})}")
            return DEFAULT_QUALITY_SCORE

        quality_metrics = {
            "sharpness": result.get("sharpness"),
            "contrast": result.get("contrast"),
            "brightness": result.get("brightness"),
        }

        quality_score = _calculate_quality_score(quality_metrics, result)
        logger.info(f"✅ Image quality analyzed: {file_path} -> Score: {quality_score}")
        return quality_score

    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error analyzing image quality: {str(e)}")
        return DEFAULT_QUALITY_SCORE
    except Exception as e:
        logger.error(f"❌ Unexpected error analyzing image quality: {str(e)}")
        return DEFAULT_QUALITY_SCORE


async def _analyze_video_quality(file_path: str, thumbnail_path: str = None) -> float:
    """
    Analyze video quality by analyzing its thumbnail image.
    Sightengine's video URL API doesn't support static file URLs,
    so we analyze the already-generated thumbnail as a representative frame.
    """
    # Use the thumbnail if available, otherwise fall back to default
    image_to_analyze = thumbnail_path if thumbnail_path and os.path.exists(thumbnail_path) else None

    if not image_to_analyze:
        logger.warning(f"⚠️ No thumbnail available for video quality analysis: {file_path}")
        return DEFAULT_QUALITY_SCORE

    logger.info(f"🎬 Analyzing video quality via thumbnail: {image_to_analyze}")
    return await _analyze_image_quality(image_to_analyze)


def _calculate_quality_score(quality_metrics: Dict, full_data: Dict) -> float:
    """
    Calculate normalized quality score (0-100) from Sightengine metrics.
    
    Scoring Algorithm:
    1. Sharpness (weight: 30%): Higher is better (0-1)
    2. Contrast (weight: 20%): Moderate is best (0.3-0.7 optimal)
    3. Brightness (weight: 20%): Moderate is best (0.3-0.7 optimal)
    4. Colors quality (weight: 30%): Vibrancy and balance
    
    Args:
        quality_metrics: Quality data from Sightengine
        full_data: Full response data for additional context
    
    Returns:
        float: Quality score between 0-100
    """
    # Default score if no quality data available
    if not quality_metrics:
        return DEFAULT_QUALITY_SCORE
    
    scores = []
    
    # 1. Sharpness Score (0-100)
    sharpness = quality_metrics.get('sharpness', 0.5)
    sharpness_score = sharpness * 100
    scores.append(sharpness_score * 0.30)  # 30% weight
    
    # 2. Contrast Score (0-100) - Normalized around optimal range
    contrast = quality_metrics.get('contrast', 0.5)
    # Optimal contrast is around 0.5, penalty for too low or too high
    contrast_score = 100 - abs(contrast - 0.5) * 200
    contrast_score = max(0, min(100, contrast_score))
    scores.append(contrast_score * 0.20)  # 20% weight
    
    # 3. Brightness Score (0-100) - Normalized around optimal range
    brightness = quality_metrics.get('brightness', 0.5)
    # Optimal brightness is around 0.5, penalty for too dark or too bright
    brightness_score = 100 - abs(brightness - 0.5) * 200
    brightness_score = max(0, min(100, brightness_score))
    scores.append(brightness_score * 0.20)  # 20% weight
    
    # 4. Colors Quality Score (0-100)
    # Sightengine provides color properties like dominant colors, vibrancy
    colors_data = full_data.get('colors', {})
    if colors_data:
        # Score based on color diversity and vibrancy
        dominant_colors = colors_data.get('dominant', {})
        accent_colors = colors_data.get('accent', [])
        
        # More diverse colors = higher quality (up to a point)
        color_diversity_score = min(len(accent_colors) * 20, 80)
        
        # Add vibrancy if available
        if dominant_colors:
            # Assume presence of dominant colors indicates good color balance
            color_diversity_score += 20
        
        scores.append(color_diversity_score * 0.30)  # 30% weight
    else:
        # Default color score if no color data
        scores.append(50 * 0.30)
    
    # Calculate weighted average
    final_score = sum(scores)
    
    # Ensure score is between 0-100
    final_score = max(0, min(100, final_score))
    
    logger.debug(f"Quality calculation - Sharpness: {sharpness}, Contrast: {contrast}, "
                f"Brightness: {brightness}, Final: {final_score}")
    
    return round(final_score, 2)


# Manual quality score for testing (when Sightengine is unavailable)
def calculate_mock_quality_score() -> float:
    """
    Generate a mock quality score for testing purposes.
    Returns a random score between 60-95 (realistic range).
    """
    import random
    return round(random.uniform(60, 95), 2)

