# Level Configuration Table (Static)
LEVEL_TABLE = [
    {"level": 1, "required_points": 1250, "title": "Reviewer"},
    {"level": 2, "required_points": 2500, "title": "Reviewer"},
    {"level": 3, "required_points": 3750, "title": "Reviewer"},
    {"level": 4, "required_points": 5000, "title": "Reviewer"},
    {"level": 5, "required_points": 5750, "title": "Top Reviewer"},
    {"level": 6, "required_points": 6500, "title": "Top Reviewer"},
    {"level": 7, "required_points": 7250, "title": "Top Reviewer"},
    {"level": 8, "required_points": 8000, "title": "Top Reviewer"},
    {"level": 9, "required_points": 9000, "title": "Influencer"},
    {"level": 10, "required_points": 10000, "title": "Influencer"},
    {"level": 11, "required_points": 11000, "title": "Influencer"},
    {"level": 12, "required_points": 12000, "title": "Influencer"},
]

def get_level_from_total_points(total_points: int) -> dict:
    """
    Calculate user level from TOTAL points accumulated.
    User starts at Level 1 and levels up when crossing thresholds.
    
    Args:
        total_points: Total accumulated points
        
    Returns:
        dict with level, required_points for next level, title
    """
    # Start at Level 1 by default
    current_level = 1
    current_title = "Reviewer"
    required_for_next = 1250
    
    # Find the highest level where total_points >= required_points
    for level_data in LEVEL_TABLE:
        if total_points >= level_data["required_points"]:
            current_level = level_data["level"] + 1  # They've passed this level
            current_title = level_data["title"]
    
    # Cap at Level 12
    if current_level > 12:
        current_level = 12
        current_title = "Influencer"
        required_for_next = 12000  # Max
    else:
        # Get required points for NEXT level
        if current_level <= 12:
            required_for_next = LEVEL_TABLE[current_level - 1]["required_points"]
    
    return {
        "level": current_level,
        "title": current_title,
        "requiredPoints": required_for_next,
    }

def get_level_data(level: int) -> dict:
    """
    Get level data for a specific level.
    Returns dict with level, required_points, and title.
    """
    if level < 1 or level > 12:
        return LEVEL_TABLE[0]  # Default to level 1
    return LEVEL_TABLE[level - 1]

def get_points_for_level(level: int) -> int:
    """
    Get points awarded for uploading a post based on current level.
    - Levels 1-4 (Reviewer): 25 points
    - Levels 5-8 (Top Reviewer): 15 points
    - Levels 9-12 (Influencer): 5 points
    """
    if level >= 1 and level <= 4:
        return 25
    elif level >= 5 and level <= 8:
        return 15
    elif level >= 9 and level <= 12:
        return 5
    return 25  # Default to 25 if level is out of range

def calculateUserLevelAfterPost(user: dict) -> dict:
    """
    Calculate user level after creating a post.
    Awards points based on current level.
    Handles level-up with carry-over points.
    
    Args:
        user: Current user dict with level, currentPoints, total_points
        
    Returns:
        dict with:
        - level: New level
        - currentPoints: New current points (points towards NEXT level)
        - requiredPoints: Points required for next level
        - title: New title
        - leveledUp: Boolean indicating if user leveled up
        - pointsEarned: Points earned from this post
        - total_points: Total accumulated points
    """
    current_level = user.get("level", 1)
    total_points = user.get("total_points", 0)
    
    # Award points based on current level
    points_earned = get_points_for_level(current_level)
    new_total_points = total_points + points_earned
    
    # Calculate level from total points
    level_info = get_level_from_total_points(new_total_points)
    new_level = level_info["level"]
    
    # Determine if leveled up
    leveled_up = new_level > current_level
    
    # Calculate currentPoints (progress towards NEXT level)
    # This is: total_points - threshold_for_current_level
    if new_level > 1:
        threshold_for_current = LEVEL_TABLE[new_level - 2]["required_points"]
        current_points = new_total_points - threshold_for_current
    else:
        current_points = new_total_points
    
    return {
        "level": new_level,
        "currentPoints": current_points,
        "requiredPoints": level_info["requiredPoints"],
        "title": level_info["title"],
        "leveledUp": leveled_up,
        "pointsEarned": points_earned,
        "total_points": new_total_points,
    }

def calculate_level(points: int) -> dict:
    """
    DEPRECATED: Use get_level_from_total_points instead.
    This function is kept for backward compatibility.
    """
    level_info = get_level_from_total_points(points)
    return {
        "level": level_info["level"],
        "badge": level_info["title"],
        "points": points
    }

def add_post_points(current_points: int) -> int:
    """
    DEPRECATED: Use calculateUserLevelAfterPost instead.
    This function is kept for backward compatibility.
    """
    return current_points + 25
