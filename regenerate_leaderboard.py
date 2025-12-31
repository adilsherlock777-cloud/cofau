#!/usr/bin/env python3
"""
Script to regenerate the leaderboard with updated user levels.
This bypasses API authentication and directly calls the generation function.
"""

import asyncio
import sys
import os

# Add backend directory to path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)  # Change to backend directory

from routers.leaderboard import generate_leaderboard_snapshot
from database import get_database, close_mongo_connection, connect_to_mongo
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

async def main():
    """Main function to regenerate leaderboard"""
    try:
        logger.info("🔄 Starting leaderboard regeneration...")
        
        # Initialize database connection
        await connect_to_mongo()
        logger.info("✅ Database connection initialized")
        
        # Generate new snapshot
        snapshot = await generate_leaderboard_snapshot()
        
        if snapshot:
            entries_count = len(snapshot.get("entries", []))
            logger.info(f"✅ Leaderboard regenerated successfully!")
            logger.info(f"📊 Total entries: {entries_count}")
            
            # Check if levels are included
            if entries_count > 0:
                first_entry = snapshot["entries"][0]
                if "user_level" in first_entry or "level" in first_entry:
                    level = first_entry.get("user_level") or first_entry.get("level")
                    logger.info(f"✅ Level field verified: First entry has level {level}")
                else:
                    logger.warning("⚠️ WARNING: Level field not found in entries!")
            
            logger.info("✅ Regeneration complete!")
        else:
            logger.warning("⚠️ No snapshot generated - no posts found in time window")
            
    except Exception as e:
        logger.error(f"❌ Error regenerating leaderboard: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Close database connection
        await close_mongo_connection()

if __name__ == "__main__":
    asyncio.run(main())

