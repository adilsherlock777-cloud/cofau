#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: "Comprehensive backend testing: Validate all endpoints including Auth, Feed, Posts, Comments, Likes, and new Explore endpoints. Ensure image URLs, authentication, and data consistency work correctly."

backend:
  - task: "User Signup API"
    implemented: true
    working: true
    file: "/app/backend/routers/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "POST /api/auth/signup working correctly. Successfully creates user with full_name, email, password. Returns access_token and token_type. Properly handles duplicate email registration with 400 error."

  - task: "User Login API"
    implemented: true
    working: true
    file: "/app/backend/routers/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "POST /api/auth/login working correctly. Uses OAuth2PasswordRequestForm with username/password form data. Returns access_token and token_type. Properly rejects invalid credentials with 401 error."

  - task: "Protected User Profile API"
    implemented: true
    working: true
    file: "/app/backend/routers/auth.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /api/auth/me working correctly. Requires Bearer token authentication. Returns complete user profile including id, full_name, email, points, level, etc. Properly blocks unauthorized access with 401 error."

  - task: "JWT Token Authentication"
    implemented: true
    working: true
    file: "/app/backend/utils/jwt.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "JWT token creation and verification working correctly. Tokens are properly signed and validated. Access tokens have appropriate expiration time."

  - task: "Password Hashing"
    implemented: true
    working: true
    file: "/app/backend/utils/hashing.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "Password hashing using bcrypt working correctly. Passwords are properly hashed during signup and verified during login."

frontend:
  # No frontend testing performed as per instructions

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Authentication flow complete"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

  - task: "Post Creation API"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "POST /api/posts/create working correctly after fixing Form parameter issue. Successfully creates posts with multipart form data including rating, review_text, map_link, and file upload. Returns post_id and updates user points/level. Authentication required and working properly."

  - task: "Feed API"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /api/feed working correctly. Successfully retrieves posts with pagination support (skip/limit). Returns complete post data including user info, media details, ratings, and timestamps. Test post created and verified in feed. Updated: Feed now requires authentication (Bearer token) which is working correctly."

  - task: "Comment Creation API"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "POST /api/posts/{post_id}/comment working correctly. Successfully adds comments using multipart/form-data with comment_text parameter. Requires Bearer token authentication. Returns comment_id and updates post comments_count. Tested with post ID 690fa2cc8a6be6239d38e7e5."

  - task: "Get Comments API"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: true
          agent: "testing"
          comment: "GET /api/posts/{post_id}/comments working correctly. Successfully retrieves all comments for a post sorted by created_at descending. No authentication required. Returns complete comment data including user info, comment text, and timestamps."

frontend:
  # No frontend testing performed as per instructions

metadata:
  created_by: "testing_agent"
  version: "1.0"
  test_sequence: 3
  run_ui: false

test_plan:
  current_focus:
    - "Comment endpoints testing complete"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

  - task: "Like Post API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/posts/{post_id}/like endpoint implemented. Needs testing to verify like toggling, authentication requirement, and response format."

  - task: "Unlike Post API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /api/posts/{post_id}/unlike endpoint implemented. Needs testing to verify unlike functionality and authentication."

  - task: "Explore Trending Posts API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/explore/trending endpoint implemented. Should return posts sorted by recent activity. Needs validation for data structure and image_url consistency."

  - task: "Explore Top Rated Posts API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/explore/top-rated endpoint implemented. Should return posts sorted by rating. Needs validation for data structure and image_url consistency."

  - task: "Explore Reviewers API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/explore/reviewers endpoint implemented. Should return top users by points. Needs validation for data structure."

  - task: "Explore Categories API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /api/explore/categories endpoint implemented. Should return categories with post counts. Needs validation."

  - task: "Static File Serving"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Static files mounted at /api/static for serving uploaded images. Image URLs should follow format /api/static/uploads/{filename}. Needs validation that images are accessible."

agent_communication:
    - agent: "testing"
      message: "Completed comprehensive authentication testing. All core auth endpoints (signup, login, protected access) are working correctly. Backend URL https://meal-snap-4.preview.emergentagent.com/api is accessible and responding properly. Authentication flow is fully functional with proper error handling for edge cases."
    - agent: "testing"
      message: "Completed post creation and feed testing as requested. Fixed backend Form parameter issue in /api/posts/create endpoint. Successfully created test post with rating=8, review_text='Amazing burger! The patty was juicy and perfectly cooked. Highly recommend!', map_link to Times Square, and test image. Feed now populated with test data and working correctly. All backend APIs tested and functional."
    - agent: "testing"
      message: "Completed comment endpoints testing as requested in review. Both POST /api/posts/{post_id}/comment and GET /api/posts/{post_id}/comments are working correctly. Comment creation requires Bearer token authentication and accepts multipart/form-data with comment_text parameter. Get comments endpoint works without authentication. Successfully tested with post ID 690fa2cc8a6be6239d38e7e5. All comment functionality is working as expected."
    - agent: "main"
      message: "Added new backend tasks for comprehensive testing: Like/Unlike endpoints, all Explore endpoints (trending, top-rated, reviewers, categories), and static file serving. User wants to validate all endpoints work correctly with proper image URLs, authentication, and data consistency. Focus on ensuring feed -> comments flow is stable. Testing priority: authentication > feed/posts > comments > likes > explore endpoints > static files."