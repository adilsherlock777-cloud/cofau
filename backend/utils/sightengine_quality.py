"""
Sightengine Quality Scoring Service

This module integrates with Sightengine API to analyze image/video quality
and returns a normalized quality score (0-100) for leaderboard ranking.

Quality Score Components:
- Sharpness (0-1): Image/video clarity
- Contrast (0-1): Visual contrast quality
- Brightness (0-1): Lighting quality
- Colors quality (0-1): Color vibrancy and balance

Final Score = Average of all components * 100 (normalized to 0-100)
"""

import httpx
import logging
from typing import Dict, Optional
from config import settings

logger = logging.getLogger(__name__)

# Sightengine API Configuration
SIGHTENGINE_API_USER = settings.SIGHTENGINE_API_USER
SIGHTENGINE_API_SECRET = settings.SIGHTENGINE_API_SECRET
SIGHTENGINE_BASE_URL = "https://api.sightengine.com/1.0"

# Default quality score if API fails
DEFAULT_QUALITY_SCORE = 50.0


async def analyze_media_quality(media_url: str, media_type: str = "image") -> float:
    """
    Analyze media quality using Sightengine API.
    
    Args:
        media_url: Public URL of the image/video
        media_type: Either "image" or "video"
    
    Returns:
        float: Quality score between 0-100
    """
    try:
        if media_type == "video":
            return await _analyze_video_quality(media_url)
        else:
            return await _analyze_image_quality(media_url)
    except Exception as e:
        logger.error(f"❌ Sightengine quality analysis failed for {media_url}: {str(e)}")
        return DEFAULT_QUALITY_SCORE


async def _analyze_image_quality(image_url: str) -> float:
    """
    Analyze image quality using Sightengine's quality detection endpoint.
    
    Quality metrics analyzed:
    - Sharpness: How sharp/clear the image is
    - Contrast: Visual contrast quality
    - Brightness: Lighting quality
    - Colors: Color quality and vibrancy
    """
    try:
        params = {
            'url': image_url,
            'models': 'properties',  # properties includes quality metrics
            'api_user': SIGHTENGINE_API_USER,
            'api_secret': SIGHTENGINE_API_SECRET
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{SIGHTENGINE_BASE_URL}/check.json", params=params)
            response.raise_for_status()
            data = response.json()
        
        # Extract quality metrics from Sightengine response
        quality_metrics = data.get('quality', {})
        
        # Calculate quality score from available metrics
        quality_score = _calculate_quality_score(quality_metrics, data)
        
        logger.info(f"✅ Image quality analyzed: {image_url} -> Score: {quality_score}")
        return quality_score
        
    except httpx.HTTPError as e:
        logger.error(f"❌ HTTP error analyzing image quality: {str(e)}")
        return DEFAULT_QUALITY_SCORE
    except Exception as e:
        logger.error(f"❌ Unexpected error analyzing image quality: {str(e)}")
        return DEFAULT_QUALITY_SCORE


async def _analyze_video_quality(video_url: str) -> float:
    """
    Analyze video quality using Sightengine's video analysis endpoint.
    
    Note: Video analysis may take longer and might require different pricing tier.
    For MVP, we analyze the first frame as representative of video quality.
    """
    try:
        params = {
            'url': video_url,
            'models': 'properties',
            'api_user': SIGHTENGINE_API_USER,
            'api_secret': SIGHTENGINE_API_SECRET
        }
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(f"{SIGHTENGINE_BASE_URL}/video/check.json", params=params)
            response.raise_for_status()
            data = response.json()
        
        # For videos, Sightengine returns frame-by-frame analysis
        # We'll use the first frame or average of multiple frames
        frames = data.get('data', {}).get('frames', [])
        
        if frames:
            # Average quality across analyzed frames
            frame_scores = []
            for frame in frames[:5]:  # Analyze first 5 frames
                quality_metrics = frame.get('quality', {})
                score = _calculate_quality_score(quality_metrics, frame)
                frame_scores.append(score)
            
            quality_score = sum(frame_scores) / len(frame_scores)
        else:
            # Fallback: analyze as image (first frame)
            quality_score = await _analyze_image_quality(video_url)
        
        logger.info(f"✅ Video quality analyzed: {video_url} -> Score: {quality_score}")
        return quality_score
        
    except Exception as e:
        logger.error(f"❌ Error analyzing video quality: {str(e)}")
        # Fallback: try analyzing as image
        try:
            return await _analyze_image_quality(video_url)
        except:
            return DEFAULT_QUALITY_SCORE


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

