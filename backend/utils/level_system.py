def calculate_level(points: int) -> dict:
    """
    Calculate user level based on points.
    Returns dict with level, required points, and badge.
    """
    # Level thresholds
    levels = [
        {"level": 1, "points": 0, "badge": None},
        {"level": 2, "points": 1250, "badge": None},
        {"level": 3, "points": 2500, "badge": None},
        {"level": 4, "points": 3750, "badge": "Bronze Star"},
        {"level": 5, "points": 5000, "badge": "Bronze Star"},
        {"level": 6, "points": 5750, "badge": "Bronze Star"},
        {"level": 7, "points": 6500, "badge": "Bronze Star"},
        {"level": 8, "points": 7250, "badge": "Silver Star"},
        {"level": 9, "points": 8000, "badge": "Silver Star"},
        {"level": 10, "points": 9000, "badge": "Silver Star"},
        {"level": 11, "points": 10000, "badge": "Silver Star"},
        {"level": 12, "points": 11000, "badge": "Gold Star"},
    ]
    
    current_level = 1
    current_badge = None
    
    for level_data in reversed(levels):
        if points >= level_data["points"]:
            current_level = level_data["level"]
            current_badge = level_data["badge"]
            break
    
    return {
        "level": current_level,
        "badge": current_badge,
        "points": points
    }

def add_post_points(current_points: int) -> int:
    """
    Add points for creating a post.
    Each post = +25 points
    """
    return current_points + 25
