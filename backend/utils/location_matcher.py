from thefuzz import fuzz, process

def normalize_location_name(name: str) -> str:
    """Basic normalization - lowercase, trim, single spaces"""
    if not name:
        return ""
    return " ".join(name.lower().strip().split())

def find_similar_location(user_input: str, existing_locations: list, threshold: int = 80) -> dict | None:
    """
    Find similar location from existing locations using fuzzy matching.
    Returns the best match if similarity >= threshold, else None.
    
    Args:
        user_input: What user typed (e.g., "Troffles Jp nogar")
        existing_locations: List of dicts with 'location_name' and 'normalized_name'
        threshold: Minimum similarity percentage (default 80%)
    
    Returns:
        Best matching location dict or None
    """
    if not user_input or not existing_locations:
        return None
    
    normalized_input = normalize_location_name(user_input)
    
    # Create list of normalized names for matching
    normalized_names = [loc.get('normalized_name', '') for loc in existing_locations]
    
    if not normalized_names:
        return None
    
    # Find best match
    result = process.extractOne(normalized_input, normalized_names, scorer=fuzz.ratio)
    
    if result and result[1] >= threshold:
        # result = (matched_string, score, index)
        matched_name = result[0]
        score = result[1]
        
        # Find the original location dict
        for loc in existing_locations:
            if loc.get('normalized_name') == matched_name:
                return {
                    **loc,
                    'similarity_score': score
                }
    
    return None

def get_location_suggestions(user_input: str, existing_locations: list, limit: int = 5) -> list:
    """
    Get top matching location suggestions for autocomplete.
    
    Args:
        user_input: What user is typing
        existing_locations: List of dicts with 'location_name' and 'normalized_name'
        limit: Max suggestions to return
    
    Returns:
        List of matching locations sorted by similarity
    """
    if not user_input or not existing_locations:
        return []
    
    normalized_input = normalize_location_name(user_input)
    
    if len(normalized_input) < 2:  # Don't search for single characters
        return []
    
    results = []
    
    for loc in existing_locations:
        normalized_name = loc.get('normalized_name', '')
        if not normalized_name:
            continue
        
        # Calculate similarity score
        score = fuzz.ratio(normalized_input, normalized_name)
        
        # Also check partial match (for substring matches)
        partial_score = fuzz.partial_ratio(normalized_input, normalized_name)
        
        # Use the higher score
        best_score = max(score, partial_score)
        
        if best_score >= 50:  # Minimum 50% for suggestions
            results.append({
                **loc,
                'similarity_score': best_score
            })
    
    # Sort by similarity score (highest first)
    results.sort(key=lambda x: x['similarity_score'], reverse=True)
    
    return results[:limit]