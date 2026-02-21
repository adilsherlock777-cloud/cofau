"""
Script to create an admin user for the Cofau Admin Portal.

Usage:
    python create_admin.py <username> <password> <name>

Example:
    python create_admin.py admin cofau@2024 "Cofau Admin"
"""
import asyncio
import sys
from motor.motor_asyncio import AsyncIOMotorClient
from config import settings
from utils.hashing import hash_password


async def create_admin(username: str, password: str, name: str):
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[settings.DATABASE_NAME]

    existing = await db.admins.find_one({"username": username})
    if existing:
        print(f"Admin '{username}' already exists. Updating password...")
        await db.admins.update_one(
            {"username": username},
            {"$set": {"password_hash": hash_password(password), "name": name}},
        )
        print(f"Admin '{username}' password updated.")
    else:
        await db.admins.insert_one(
            {
                "username": username,
                "password_hash": hash_password(password),
                "name": name,
                "created_at": __import__("datetime").datetime.utcnow(),
            }
        )
        print(f"Admin '{username}' created successfully!")

    client.close()


if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python create_admin.py <username> <password> <name>")
        print('Example: python create_admin.py admin cofau@2024 "Cofau Admin"')
        sys.exit(1)

    username = sys.argv[1]
    password = sys.argv[2]
    name = sys.argv[3]

    asyncio.run(create_admin(username, password, name))
