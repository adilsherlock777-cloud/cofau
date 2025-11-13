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
        user: Current user dict with level, currentPoints, requiredPoints
        
    Returns:
        dict with:
        - level: New level
        - currentPoints: New current points (after carry-over)
        - requiredPoints: Points required for next level
        - title: New title
        - leveledUp: Boolean indicating if user leveled up
        - pointsEarned: Points earned from this post
    """
    current_level = user.get("level", 1)
    current_points = user.get("currentPoints", 0)
    
    # Award points based on current level
    points_earned = get_points_for_level(current_level)
    new_total_points = current_points + points_earned
    
    # Check if level-up is needed
    leveled_up = False
    new_level = current_level
    
    # Get current level data
    level_data = get_level_data(current_level)
    required_points = level_data["required_points"]
    
    # Handle level-up (can level up multiple times if enough points)
    while new_total_points >= required_points and new_level < 12:
        # Level up
        leveled_up = True
        new_level += 1
        
        # Carry over extra points
        new_total_points = new_total_points - required_points
        
        # Get next level data
        level_data = get_level_data(new_level)
        required_points = level_data["required_points"]
    
    # Get final level data
    final_level_data = get_level_data(new_level)
    
    return {
        "level": new_level,
        "currentPoints": new_total_points,
        "requiredPoints": final_level_data["required_points"],
        "title": final_level_data["title"],
        "leveledUp": leveled_up,
        "pointsEarned": points_earned
    }

def calculate_level(points: int) -> dict:
    """
    DEPRECATED: Use calculateUserLevelAfterPost instead.
    This function is kept for backward compatibility.
    """
    # Find current level based on total points
    current_level = 1
    for i in range(len(LEVEL_TABLE) - 1, -1, -1):
        if points >= LEVEL_TABLE[i]["required_points"]:
            current_level = LEVEL_TABLE[i]["level"]
            break
    
    level_data = get_level_data(current_level)
    
    return {
        "level": current_level,
        "badge": level_data["title"],
        "points": points
    }

def add_post_points(current_points: int) -> int:
    """
    DEPRECATED: Use calculateUserLevelAfterPost instead.
    This function is kept for backward compatibility.
    """
    return current_points + 25
