import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# ================================================================
# AWS CLIENTS / ENVIRONMENT
# ================================================================
# Table/bucket names come from environment variables set by CDK
# (see otaku_vault_stack.py) - never hardcoded here, so this same
# code works no matter what CDK names the actual resources.
# ================================================================

dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ["USERS_TABLE_NAME"])
characters_table = dynamodb.Table(os.environ["CHARACTERS_TABLE_NAME"])

s3 = boto3.client("s3")
bucket_name = os.environ["BUCKET_NAME"]

# How long a generated image link stays valid before it expires.
IMAGE_URL_EXPIRY_SECONDS = 3600  # 1 hour
UPLOAD_URL_EXPIRY_SECONDS = 300  # 5 minutes


# ================================================================
# MAIN LAMBDA HANDLER
# ================================================================

def handler(event, context):
    """
    Every route in this API requires a signed-in Cognito user, so the
    very first thing every request does is resolve who that user is.
    If that fails for any reason, nothing below it runs.
    """

    http_method = event.get("httpMethod", "")
    path = event.get("resource", "")

    try:
        user_id = get_authenticated_user(event)

        # ------------------------------------------------------
        # LIST MY CHARACTERS
        # GET /characters
        # ------------------------------------------------------
        if http_method == "GET" and path == "/characters":
            return list_characters(user_id)

        # ------------------------------------------------------
        # GET ONE CHARACTER (only if I own it)
        # GET /characters/{characterId}
        # ------------------------------------------------------
        elif http_method == "GET" and path == "/characters/{characterId}":
            character_id = event["pathParameters"]["characterId"]
            return get_character(user_id, character_id)

        # ------------------------------------------------------
        # CREATE A CHARACTER
        # POST /characters
        # ------------------------------------------------------
        elif http_method == "POST" and path == "/characters":
            body = get_request_body(event)
            return create_character(user_id, body)

        # ------------------------------------------------------
        # UPDATE A CHARACTER (only if I own it)
        # PUT /characters/{characterId}
        # ------------------------------------------------------
        elif http_method == "PUT" and path == "/characters/{characterId}":
            character_id = event["pathParameters"]["characterId"]
            body = get_request_body(event)
            return update_character(user_id, character_id, body)

        # ------------------------------------------------------
        # DELETE A CHARACTER (only if I own it)
        # DELETE /characters/{characterId}
        # ------------------------------------------------------
        elif http_method == "DELETE" and path == "/characters/{characterId}":
            character_id = event["pathParameters"]["characterId"]
            return delete_character(user_id, character_id)

        # ------------------------------------------------------
        # GET A PRE-SIGNED S3 UPLOAD URL
        # POST /upload
        # ------------------------------------------------------
        elif http_method == "POST" and path == "/upload":
            body = get_request_body(event)
            return generate_upload_url(user_id, body)

        return api_response(400, {"error": "Unsupported route"})

    # These three exceptions map cleanly onto HTTP status codes, so
    # the CRUD functions below just raise them and this one place
    # decides the status code - keeps every function's ownership
    # check looking the same.
    except PermissionError as e:
        return api_response(403, {"error": str(e)})
    except LookupError as e:
        return api_response(404, {"error": str(e)})
    except ValueError as e:
        return api_response(400, {"error": str(e)})
    except Exception as e:
        print(f"ERROR: {str(e)}")
        return api_response(500, {"error": "Internal server error"})


# ================================================================
# AUTHENTICATION HELPER
# ================================================================

def get_authenticated_user(event):
    """
    This is the ONLY place a userId comes from - the verified claims
    that API Gateway's Cognito Authorizer already checked before this
    Lambda ever ran. Never trust a userId sent in a request body or
    query string; the frontend never sends one for exactly this reason.
    """

    claims = event["requestContext"]["authorizer"]["claims"]

    user_id = claims["sub"]  # Cognito's stable, unique user identifier
    email = claims.get("email", "")
    name = claims.get("name", "")

    ensure_user_record(user_id, email, name)

    return user_id


def ensure_user_record(user_id, email, name):
    """
    Cognito is the real identity system - this just mirrors basic
    profile info into UsersTable the first time we see a given user,
    so the app has a DynamoDB-side record to work with if needed later
    (e.g. showing a name without re-parsing the token everywhere).

    The ConditionExpression means this only ever writes ONCE per user;
    it silently does nothing on every request after that.
    """

    try:
        users_table.put_item(
            Item={
                "userId": user_id,
                "email": email,
                "name": name,
                "createdAt": now_iso(),
            },
            ConditionExpression="attribute_not_exists(userId)",
        )
    except ClientError as e:
        if e.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        # User record already exists - nothing to do.


# ================================================================
# REQUEST BODY HELPER
# ================================================================

def get_request_body(event):
    body = event.get("body")

    if not body:
        return {}

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        raise ValueError("Request body must contain valid JSON")


# ================================================================
# CHARACTER CRUD
# ================================================================

def list_characters(user_id):
    """
    Query the UserCharactersIndex GSI, NOT a table scan. The
    partition key on that index is userId, so this only ever
    reads this one user's rows - DynamoDB does the filtering,
    not application code.
    """

    result = characters_table.query(
        IndexName="UserCharactersIndex",
        KeyConditionExpression=Key("userId").eq(user_id),
    )

    items = [attach_image_url(item) for item in result.get("Items", [])]

    return api_response(200, items)


def get_character(user_id, character_id):
    """
    Fetch one character and verify it belongs to the caller before
    returning anything. A character that exists but belongs to
    someone else is treated the same as "not yours" - 403.
    """

    result = characters_table.get_item(Key={"characterId": character_id})
    item = result.get("Item")

    if not item:
        raise LookupError(f"Character {character_id} not found")

    if item["userId"] != user_id:
        raise PermissionError("You do not have access to this character")

    return api_response(200, attach_image_url(item))


def create_character(user_id, body):
    """
    userId is set here, from the authenticated user_id argument -
    never from anything in `body`. Even if the frontend sent a
    userId field, it's simply never read below.
    """

    name = (body.get("name") or "").strip()
    if not name:
        raise ValueError("name is required")

    now = now_iso()

    item = {
        "characterId": str(uuid.uuid4()),  # generated server-side
        "userId": user_id,                 # forced from the verified token
        "name": name,
        "description": body.get("description", ""),
        "createdAt": now,
        "updatedAt": now,
    }

    # Optional - present when the frontend already uploaded an image
    # via /upload before submitting the character form.
    if body.get("imageKey"):
        item["imageKey"] = body["imageKey"]

    characters_table.put_item(Item=item)

    return api_response(201, attach_image_url(item))


def update_character(user_id, character_id, body):
    """
    Ownership is checked BEFORE any write happens. Only name,
    description, and imageKey can ever be changed here -
    characterId, userId, and createdAt are never touched, even
    if the frontend sends them.
    """

    existing = characters_table.get_item(Key={"characterId": character_id}).get("Item")

    if not existing:
        raise LookupError(f"Character {character_id} not found")

    if existing["userId"] != user_id:
        raise PermissionError("You do not have access to this character")

    update_parts = []
    expr_names = {}
    expr_values = {}

    if "name" in body:
        # "name" is a reserved word in DynamoDB's update syntax, so it
        # needs an alias (#n) via ExpressionAttributeNames.
        update_parts.append("#n = :n")
        expr_names["#n"] = "name"
        expr_values[":n"] = body["name"]

    if "description" in body:
        update_parts.append("description = :d")
        expr_values[":d"] = body["description"]

    if "imageKey" in body:
        update_parts.append("imageKey = :ik")
        expr_values[":ik"] = body["imageKey"]

    update_parts.append("updatedAt = :ua")
    expr_values[":ua"] = now_iso()

    update_kwargs = {
        "Key": {"characterId": character_id},
        "UpdateExpression": "SET " + ", ".join(update_parts),
        "ExpressionAttributeValues": expr_values,
        "ReturnValues": "ALL_NEW",
    }
    if expr_names:
        update_kwargs["ExpressionAttributeNames"] = expr_names

    result = characters_table.update_item(**update_kwargs)

    return api_response(200, attach_image_url(result["Attributes"]))


def delete_character(user_id, character_id):
    """
    Same ownership check as update - fetch first, verify, only
    then delete. Without the fetch-and-check step, any signed-in
    user could delete any character just by guessing/knowing its ID.
    """

    existing = characters_table.get_item(Key={"characterId": character_id}).get("Item")

    if not existing:
        raise LookupError(f"Character {character_id} not found")

    if existing["userId"] != user_id:
        raise PermissionError("You do not have access to this character")

    characters_table.delete_item(Key={"characterId": character_id})

    return api_response(200, {"message": f"Deleted {character_id}"})


# ================================================================
# S3 IMAGE HELPERS
# ================================================================

def attach_image_url(item):
    """
    Prepare a character object before sending it to the frontend.

    IMPORTANT:
    ---------------------------------------------------------------
    DynamoDB stores `userId` because it is required for ownership
    checks. However, the frontend does NOT need to know the user's
    Cognito ID.

    Therefore, we build a separate response object instead of
    returning the complete DynamoDB item.

    This gives us two layers:

        DynamoDB
        ├── characterId
        ├── userId          <- PRIVATE ownership information
        ├── name
        ├── description
        ├── imageKey
        ├── createdAt
        └── updatedAt

                 ↓

        API response
        ├── characterId
        ├── name
        ├── description
        ├── imageUrl
        ├── createdAt
        └── updatedAt

    The user's `userId` and S3 `imageKey` therefore aren't exposed
    unnecessarily to the React application.

    The S3 bucket is private, so we generate a fresh temporary
    pre-signed GET URL whenever the character is returned.
    """

    # ------------------------------------------------------------
    # Only expose fields that the frontend actually needs.
    # ------------------------------------------------------------

    response_item = {
        "characterId": item["characterId"],
        "name": item.get("name", ""),
        "description": item.get("description", ""),
        "createdAt": item.get("createdAt"),
        "updatedAt": item.get("updatedAt"),
    }

    # ------------------------------------------------------------
    # Generate a temporary URL for the private S3 image.
    #
    # The URL expires after IMAGE_URL_EXPIRY_SECONDS.
    # ------------------------------------------------------------

    if item.get("imageKey"):

        response_item["imageUrl"] = s3.generate_presigned_url(
            ClientMethod="get_object",
            Params={
                "Bucket": bucket_name,
                "Key": item["imageKey"],
            },
            ExpiresIn=IMAGE_URL_EXPIRY_SECONDS,
        )

    else:
        # No image was uploaded for this character.
        response_item["imageUrl"] = None

    return response_item


def generate_upload_url(user_id, body):
    """
    Generates a short-lived pre-signed PUT URL so the browser can
    upload an image straight to S3. The key is prefixed with the
    caller's own user_id, so uploads are naturally namespaced per
    user in the bucket (useful for auditing/cleanup later, though
    the real security boundary is still the ownership check on the
    character record itself, not this prefix).
    """

    file_name = body.get("fileName")
    content_type = body.get("contentType", "application/octet-stream")

    if not file_name:
        raise ValueError("fileName is required")

    file_key = f"{user_id}/{uuid.uuid4()}-{file_name}"

    upload_url = s3.generate_presigned_url(
        ClientMethod="put_object",
        Params={
            "Bucket": bucket_name,
            "Key": file_key,
            "ContentType": content_type,
        },
        ExpiresIn=UPLOAD_URL_EXPIRY_SECONDS,
    )

    return api_response(
        200,
        {
            "message": "Upload URL generated successfully",
            "uploadUrl": upload_url,
            "imageKey": file_key,
        },
    )


# ================================================================
# SMALL HELPERS
# ================================================================

def now_iso():
    return datetime.now(timezone.utc).isoformat()


def api_response(status_code, body):
    """
    Lambda proxy integration means API Gateway does NOT add CORS
    headers to this response automatically - they have to be set
    here, on every response, or the browser blocks it client-side
    even when the actual request succeeded.
    """

    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }
