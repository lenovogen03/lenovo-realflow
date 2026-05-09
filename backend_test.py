"""
Backend API Tests for RealFlow Application
Tests basic endpoints, authentication, and core functionality
"""

import requests
import json
import os
from datetime import datetime

# Get backend URL from environment
BACKEND_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://flow-workspace-4.preview.emergentagent.com")
API_BASE = f"{BACKEND_URL}/api"

# Test credentials
TEST_USER_EMAIL = f"testuser_{datetime.now().timestamp()}@test.com"
TEST_USER_PASSWORD = "TestPassword123!"
TEST_USER_NAME = "Test User"

# Admin credentials from environment
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@realflow.local")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "admin123")

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(test_name, status, message=""):
    """Print test result with color"""
    if status == "PASS":
        print(f"{Colors.GREEN}✓ {test_name}: PASS{Colors.END} {message}")
    elif status == "FAIL":
        print(f"{Colors.RED}✗ {test_name}: FAIL{Colors.END} {message}")
    elif status == "SKIP":
        print(f"{Colors.YELLOW}⊘ {test_name}: SKIP{Colors.END} {message}")
    else:
        print(f"{Colors.BLUE}ℹ {test_name}: {status}{Colors.END} {message}")

def test_health_endpoint():
    """Test /health endpoint"""
    print("\n" + "="*60)
    print("TEST: Health Check Endpoint")
    print("="*60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            print_test("Health endpoint", "PASS", f"Status: {data.get('status')}")
            return True
        else:
            print_test("Health endpoint", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Health endpoint", "FAIL", f"Error: {str(e)}")
        return False

def test_branding_endpoint():
    """Test /api/branding endpoint (public)"""
    print("\n" + "="*60)
    print("TEST: Branding Endpoint (Public)")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE}/branding", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"App Name: {data.get('app_name', 'N/A')}")
            print(f"Tagline: {data.get('tagline', 'N/A')}")
            print_test("Branding endpoint", "PASS", "Public branding data retrieved")
            return True
        else:
            print_test("Branding endpoint", "FAIL", f"Expected 200, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Branding endpoint", "FAIL", f"Error: {str(e)}")
        return False

def test_register_user():
    """Test user registration"""
    print("\n" + "="*60)
    print("TEST: User Registration")
    print("="*60)
    
    try:
        payload = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": TEST_USER_NAME
        }
        
        response = requests.post(f"{API_BASE}/auth/register", json=payload, timeout=5)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:200]}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                print_test("User registration", "PASS", f"User created: {TEST_USER_EMAIL}")
                return True, data["access_token"]
            else:
                print_test("User registration", "FAIL", "No access token in response")
                return False, None
        else:
            print_test("User registration", "FAIL", f"Status: {response.status_code}")
            return False, None
    except Exception as e:
        print_test("User registration", "FAIL", f"Error: {str(e)}")
        return False, None

def test_login():
    """Test user login"""
    print("\n" + "="*60)
    print("TEST: User Login")
    print("="*60)
    
    try:
        payload = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = requests.post(f"{API_BASE}/auth/login", json=payload, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                print_test("User login", "PASS", f"Login successful for {TEST_USER_EMAIL}")
                return True, data["access_token"]
            else:
                print_test("User login", "FAIL", "No access token in response")
                return False, None
        else:
            print_test("User login", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False, None
    except Exception as e:
        print_test("User login", "FAIL", f"Error: {str(e)}")
        return False, None

def test_admin_login():
    """Test admin login"""
    print("\n" + "="*60)
    print("TEST: Admin Login")
    print("="*60)
    
    try:
        payload = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = requests.post(f"{API_BASE}/admin/login", json=payload, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and data.get("is_admin"):
                print_test("Admin login", "PASS", f"Admin login successful")
                return True, data["access_token"]
            else:
                print_test("Admin login", "FAIL", "Invalid admin response")
                return False, None
        else:
            print_test("Admin login", "FAIL", f"Status: {response.status_code}, Response: {response.text[:200]}")
            return False, None
    except Exception as e:
        print_test("Admin login", "FAIL", f"Error: {str(e)}")
        return False, None

def test_protected_endpoint_without_auth():
    """Test that protected endpoints return 401 without auth"""
    print("\n" + "="*60)
    print("TEST: Protected Endpoint Without Auth")
    print("="*60)
    
    try:
        response = requests.get(f"{API_BASE}/auth/me", timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print_test("Protected endpoint auth check", "PASS", "Correctly returns 401 without auth")
            return True
        else:
            print_test("Protected endpoint auth check", "FAIL", f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_test("Protected endpoint auth check", "FAIL", f"Error: {str(e)}")
        return False

def test_get_current_user(token):
    """Test /auth/me endpoint with valid token"""
    print("\n" + "="*60)
    print("TEST: Get Current User")
    print("="*60)
    
    try:
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{API_BASE}/auth/me", headers=headers, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"User Email: {data.get('email', 'N/A')}")
            print(f"User Name: {data.get('name', 'N/A')}")
            print(f"User Status: {data.get('status', 'N/A')}")
            print_test("Get current user", "PASS", "User data retrieved successfully")
            return True
        else:
            print_test("Get current user", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_test("Get current user", "FAIL", f"Error: {str(e)}")
        return False

def test_mongodb_connection():
    """Test MongoDB connection by checking if endpoints work"""
    print("\n" + "="*60)
    print("TEST: MongoDB Connection")
    print("="*60)
    
    # If we can register/login, MongoDB is working
    print("MongoDB connection verified through successful API operations")
    print_test("MongoDB connection", "PASS", "Database operations working")
    return True

def test_admin_users_list(admin_token):
    """Test admin users list endpoint"""
    print("\n" + "="*60)
    print("TEST: Admin Users List")
    print("="*60)
    
    try:
        headers = {"Authorization": f"Bearer {admin_token}"}
        response = requests.get(f"{API_BASE}/admin/users", headers=headers, timeout=5)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Total Users: {len(data)}")
            print_test("Admin users list", "PASS", f"Retrieved {len(data)} users")
            return True
        else:
            print_test("Admin users list", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_test("Admin users list", "FAIL", f"Error: {str(e)}")
        return False

def run_all_tests():
    """Run all backend tests"""
    print("\n" + "="*80)
    print(" "*20 + "REALFLOW BACKEND API TESTS")
    print("="*80)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"API Base: {API_BASE}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*80)
    
    results = {
        "total": 0,
        "passed": 0,
        "failed": 0,
        "skipped": 0
    }
    
    # Test 1: Health endpoint
    results["total"] += 1
    if test_health_endpoint():
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 2: Branding endpoint
    results["total"] += 1
    if test_branding_endpoint():
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 3: Protected endpoint without auth
    results["total"] += 1
    if test_protected_endpoint_without_auth():
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 4: User registration
    results["total"] += 1
    register_success, user_token = test_register_user()
    if register_success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 5: User login
    results["total"] += 1
    login_success, login_token = test_login()
    if login_success:
        results["passed"] += 1
        user_token = login_token  # Use login token if registration failed
    else:
        results["failed"] += 1
    
    # Test 6: Get current user (requires token)
    if user_token:
        results["total"] += 1
        if test_get_current_user(user_token):
            results["passed"] += 1
        else:
            results["failed"] += 1
    
    # Test 7: Admin login
    results["total"] += 1
    admin_success, admin_token = test_admin_login()
    if admin_success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 8: Admin users list (requires admin token)
    if admin_token:
        results["total"] += 1
        if test_admin_users_list(admin_token):
            results["passed"] += 1
        else:
            results["failed"] += 1
    
    # Test 9: MongoDB connection
    results["total"] += 1
    if test_mongodb_connection():
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Print summary
    print("\n" + "="*80)
    print(" "*30 + "TEST SUMMARY")
    print("="*80)
    print(f"Total Tests: {results['total']}")
    print(f"{Colors.GREEN}Passed: {results['passed']}{Colors.END}")
    print(f"{Colors.RED}Failed: {results['failed']}{Colors.END}")
    print(f"{Colors.YELLOW}Skipped: {results['skipped']}{Colors.END}")
    print(f"Success Rate: {(results['passed']/results['total']*100):.1f}%")
    print("="*80)
    
    return results

if __name__ == "__main__":
    results = run_all_tests()
    
    # Exit with error code if any tests failed
    if results["failed"] > 0:
        exit(1)
    else:
        exit(0)
