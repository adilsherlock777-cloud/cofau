"""
Leaderboard Scheduler

Automatically regenerates the leaderboard every 3 days at 10:00 AM.

Uses APScheduler for reliable job scheduling.

Schedule: Every 3 days at 10:00 AM (server local time)
Cron Expression: 0 10 */3 * * (minute=0, hour=10, day=*/3)
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None


async def regenerate_leaderboard_job():
    """
    Scheduled job to regenerate the leaderboard.
    
    This function is called automatically every 3 days at 10:00 AM.
    It imports the leaderboard generation function and executes it.
    """
    try:
        logger.info("🏆 ========================================")
        logger.info("🏆 SCHEDULED LEADERBOARD REGENERATION STARTED")
        logger.info(f"🏆 Time: {datetime.now().isoformat()}")
        logger.info("🏆 ========================================")
        
        # Import here to avoid circular dependencies
        from routers.leaderboard import generate_leaderboard_snapshot
        
        # Generate new leaderboard snapshot
        snapshot = await generate_leaderboard_snapshot()
        
        if snapshot:
            logger.info("✅ ========================================")
            logger.info("✅ LEADERBOARD REGENERATION COMPLETED")
            logger.info(f"✅ Snapshot ID: {snapshot.get('_id')}")
            logger.info(f"✅ Entries: {len(snapshot.get('entries', []))}")
            logger.info(f"✅ Window: {snapshot.get('from_date')} to {snapshot.get('to_date')}")
            logger.info("✅ ========================================")
        else:
            logger.warning("⚠️ No posts available for leaderboard generation")
            
    except Exception as e:
        logger.error(f"❌ ========================================")
        logger.error(f"❌ LEADERBOARD REGENERATION FAILED")
        logger.error(f"❌ Error: {str(e)}")
        logger.error(f"❌ ========================================")
        import traceback
        traceback.print_exc()


def start_scheduler():
    """
    Initialize and start the APScheduler.
    
    Schedule Configuration:
    - Trigger: CronTrigger
    - Schedule: Every 3 days at 10:00 AM
    - Timezone: Server local time
    
    Cron Expression Breakdown:
    - minute=0: Run at minute 0 (top of the hour)
    - hour=10: Run at 10 AM
    - day='*/3': Run every 3 days
    - month='*': Every month
    - day_of_week='*': Any day of the week
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("⚠️ Scheduler already running")
        return
    
    scheduler = AsyncIOScheduler()
    
    # Add the leaderboard regeneration job
    # Schedule: Every 3 days at 10:00 AM
    scheduler.add_job(
        regenerate_leaderboard_job,
        trigger=CronTrigger(
            minute=0,        # At minute 0
            hour=10,         # At 10 AM
            day='*/3',       # Every 3 days
            month='*',       # Every month
            day_of_week='*'  # Any day of week
        ),
        id='leaderboard_regeneration',
        name='Leaderboard Regeneration (Every 3 days at 10:00 AM)',
        replace_existing=True,
        max_instances=1  # Prevent overlapping executions
    )
    
    # Start the scheduler
    scheduler.start()
    
    logger.info("✅ ========================================")
    logger.info("✅ SCHEDULER STARTED")
    logger.info("✅ Job: Leaderboard Regeneration")
    logger.info("✅ Schedule: Every 3 days at 10:00 AM")
    logger.info("✅ Next run: " + str(scheduler.get_job('leaderboard_regeneration').next_run_time))
    logger.info("✅ ========================================")


def stop_scheduler():
    """
    Stop the scheduler gracefully.
    """
    global scheduler
    
    if scheduler is not None:
        scheduler.shutdown(wait=True)
        scheduler = None
        logger.info("🛑 Scheduler stopped")


def get_scheduler_status():
    """
    Get the current status of the scheduler.
    
    Returns:
        dict: Scheduler status information
    """
    global scheduler
    
    if scheduler is None:
        return {
            "running": False,
            "message": "Scheduler not initialized"
        }
    
    job = scheduler.get_job('leaderboard_regeneration')
    
    if job is None:
        return {
            "running": False,
            "message": "Leaderboard job not found"
        }
    
    return {
        "running": True,
        "job_id": job.id,
        "job_name": job.name,
        "next_run_time": str(job.next_run_time),
        "trigger": str(job.trigger),
        "message": "Scheduler is running"
    }


# For testing: Run the job immediately
async def run_job_now():
    """
    Manually trigger the leaderboard regeneration job.
    Useful for testing without waiting for the scheduled time.
    """
    logger.info("🔄 Manual job execution triggered")
    await regenerate_leaderboard_job()

