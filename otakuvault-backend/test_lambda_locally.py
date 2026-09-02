import json
import os
import sys

os.environ["USERS_TABLE_NAME"] = "TestUsersTable"
os.environ["CHARACTERS_TABLE_NAME"] = "TestCharactersTable"
os.environ["BUCKET_NAME"] = "test-otakuvault-bucket"
os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

from moto import mock_aws
import boto3


def make_event(method, resource, user_sub, email="user@example.com", name="Test User",
                path_params=None, body=None):
    return {
        "httpMethod": method,
        "resource": resource,
        "pathParameters": path_params,
        "body": json.dumps(body) if body is not None else None,
        "requestContext": {
            "authorizer": {
                "claims": {
                    "sub": user_sub,
                    "email": email,
                    "name": name,
                }
            }
        },
    }


@mock_aws
def run_tests():
    # Set up the mocked tables/bucket exactly as CDK would create them
    dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
    dynamodb.create_table(
        TableName="TestUsersTable",
        KeySchema=[{"AttributeName": "userId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "userId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )
    dynamodb.create_table(
        TableName="TestCharactersTable",
        KeySchema=[{"AttributeName": "characterId", "KeyType": "HASH"}],
        AttributeDefinitions=[
            {"AttributeName": "characterId", "AttributeType": "S"},
            {"AttributeName": "userId", "AttributeType": "S"},
        ],
        GlobalSecondaryIndexes=[{
            "IndexName": "UserCharactersIndex",
            "KeySchema": [{"AttributeName": "userId", "KeyType": "HASH"}],
            "Projection": {"ProjectionType": "ALL"},
        }],
        BillingMode="PAY_PER_REQUEST",
    )
    s3 = boto3.client("s3", region_name="us-east-1")
    s3.create_bucket(Bucket="test-otakuvault-bucket")

    # Import AFTER mocks are active and tables exist
    sys.path.insert(0, "/home/claude/otakuvault-backend/lambda")
    import index as lam

    USER_A = "sub-user-a-1111"
    USER_B = "sub-user-b-2222"

    print("--- Test 1: User A creates Naruto ---")
    resp = lam.handler(make_event(
        "POST", "/characters", USER_A,
        body={"name": "Naruto Uzumaki", "description": "A young ninja."}
    ), None)
    assert resp["statusCode"] == 201, resp
    naruto = json.loads(resp["body"])
    assert naruto["userId"] == USER_A
    naruto_id = naruto["characterId"]
    print("OK - Naruto created with userId forced to", naruto["userId"])

    print("--- Test 2: User A tries to POST a character claiming a different userId ---")
    resp = lam.handler(make_event(
        "POST", "/characters", USER_A,
        body={"name": "Sneaky", "description": "x", "userId": "someone-else"}
    ), None)
    sneaky = json.loads(resp["body"])
    assert sneaky["userId"] == USER_A, "userId spoofing was NOT prevented!"
    print("OK - spoofed userId in body was ignored, real userId used instead")

    print("--- Test 3: User B creates Gojo ---")
    resp = lam.handler(make_event(
        "POST", "/characters", USER_B,
        body={"name": "Gojo Satoru", "description": "The strongest."}
    ), None)
    gojo = json.loads(resp["body"])
    gojo_id = gojo["characterId"]
    print("OK - Gojo created with userId", gojo["userId"])

    print("--- Test 4: User A lists characters - should see ONLY Naruto + Sneaky, never Gojo ---")
    resp = lam.handler(make_event("GET", "/characters", USER_A), None)
    items = json.loads(resp["body"])
    names = [i["name"] for i in items]
    assert "Gojo Satoru" not in names, f"LEAK: User A can see Gojo! {names}"
    assert "Naruto Uzumaki" in names
    print("OK - User A sees only their own characters:", names)

    print("--- Test 5: User B lists characters - should see ONLY Gojo, never Naruto ---")
    resp = lam.handler(make_event("GET", "/characters", USER_B), None)
    items = json.loads(resp["body"])
    names = [i["name"] for i in items]
    assert "Naruto Uzumaki" not in names, f"LEAK: User B can see Naruto! {names}"
    assert "Gojo Satoru" in names
    print("OK - User B sees only their own characters:", names)

    print("--- Test 6: User B tries to GET Naruto directly by ID - must be blocked ---")
    resp = lam.handler(make_event(
        "GET", "/characters/{characterId}", USER_B,
        path_params={"characterId": naruto_id}
    ), None)
    assert resp["statusCode"] == 403, f"Expected 403, got {resp['statusCode']}"
    print("OK - User B blocked with 403 trying to GET Naruto")

    print("--- Test 7: User B tries to UPDATE Naruto - must be blocked ---")
    resp = lam.handler(make_event(
        "PUT", "/characters/{characterId}", USER_B,
        path_params={"characterId": naruto_id},
        body={"name": "Hacked!"}
    ), None)
    assert resp["statusCode"] == 403, f"Expected 403, got {resp['statusCode']}"
    print("OK - User B blocked with 403 trying to UPDATE Naruto")

    print("--- Test 8: User B tries to DELETE Naruto - must be blocked ---")
    resp = lam.handler(make_event(
        "DELETE", "/characters/{characterId}", USER_B,
        path_params={"characterId": naruto_id}
    ), None)
    assert resp["statusCode"] == 403, f"Expected 403, got {resp['statusCode']}"
    print("OK - User B blocked with 403 trying to DELETE Naruto")

    print("--- Test 9: User A CAN update their own Naruto ---")
    resp = lam.handler(make_event(
        "PUT", "/characters/{characterId}", USER_A,
        path_params={"characterId": naruto_id},
        body={"description": "Now Hokage."}
    ), None)
    assert resp["statusCode"] == 200, resp
    updated = json.loads(resp["body"])
    assert updated["description"] == "Now Hokage."
    assert updated["characterId"] == naruto_id, "characterId must never change"
    print("OK - User A updated their own character successfully")

    print("--- Test 10: User A CAN delete their own character ---")
    resp = lam.handler(make_event(
        "DELETE", "/characters/{characterId}", USER_A,
        path_params={"characterId": naruto_id}
    ), None)
    assert resp["statusCode"] == 200, resp
    print("OK - User A deleted their own character successfully")

    print("--- Test 11: Getting a nonexistent character returns 404 ---")
    resp = lam.handler(make_event(
        "GET", "/characters/{characterId}", USER_A,
        path_params={"characterId": "does-not-exist"}
    ), None)
    assert resp["statusCode"] == 404, f"Expected 404, got {resp['statusCode']}"
    print("OK - nonexistent character returns 404")

    print("--- Test 12: /upload generates a pre-signed URL scoped to the user ---")
    resp = lam.handler(make_event(
        "POST", "/upload", USER_B,
        body={"fileName": "gojo.png", "contentType": "image/png"}
    ), None)
    assert resp["statusCode"] == 200, resp
    upload = json.loads(resp["body"])
    assert upload["imageKey"].startswith(USER_B + "/"), upload["imageKey"]
    assert "uploadUrl" in upload
    print("OK - upload URL generated, key scoped to user:", upload["imageKey"])

    print("--- Test 13: UsersTable got populated on first request ---")
    users = dynamodb.Table("TestUsersTable")
    user_a_record = users.get_item(Key={"userId": USER_A}).get("Item")
    assert user_a_record is not None
    assert user_a_record["email"] == "user@example.com"
    print("OK - UsersTable row created for User A:", user_a_record)

    print("\nALL 13 TESTS PASSED")


run_tests()
